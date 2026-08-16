const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileModule = (filePath, mocks = new Map()) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => (
    mocks.has(request) ? mocks.get(request) : originalRequire(request)
  );
  testModule._compile(transformed, filePath);
  return testModule.exports;
};

const makeStorage = () => {
  const values = new Map();
  const failNextSet = new Set();
  return {
    values,
    failNextSet,
    api: {
      async getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      async setItem(key, value) {
        if (failNextSet.delete(key)) {
          const error = new Error(`Injected write failure: ${key}`);
          error.code = 'test/write-failed';
          throw error;
        }
        values.set(key, value);
      },
      async removeItem(key) {
        values.delete(key);
      },
    },
  };
};

const loadStorageModule = (storage) => {
  const storagePath = path.resolve(__dirname, '../src/utils/storage.js');
  return compileModule(storagePath, new Map([
    ['@react-native-async-storage/async-storage', {
      __esModule: true,
      default: storage.api,
    }],
  ]));
};

const makeData = (name, modified = 1) => ({
  global: { lastModified: modified, lastSynced: 0 },
  schedules: [{ id: 'one', name, lastModified: modified, lastSynced: 0 }],
});

test('interrupted primary write is recovered from the write-ahead journal', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('first', 1), 'user-1');

  fake.failNextSet.add('user_schedule_user-1');
  await assert.rejects(
    () => storage.saveLocalSchedule(makeData('second', 2), 'user-1'),
    (error) => error.code === 'test/write-failed',
  );

  const recovered = await storage.getLocalSchedule('user-1');
  assert.equal(recovered.schedules[0].name, 'second');
  assert.equal(fake.values.has('user_schedule_user-1.pending'), false);
});

test('corrupt primary data is recovered from the verified mirror', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('durable', 3), 'user-2');
  fake.values.set('user_schedule_user-2', 'not-valid-json');

  const recovered = await storage.getLocalSchedule('user-2');
  assert.equal(recovered.schedules[0].name, 'durable');
  assert.deepEqual(
    JSON.parse(fake.values.get('user_schedule_user-2')),
    recovered,
  );
});

test('a failed local write is reported to the caller instead of being swallowed', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.failNextSet.add('guest_schedule.pending');
  await assert.rejects(
    () => storage.saveLocalSchedule(makeData('guest'), null),
    (error) => error.code === 'test/write-failed',
  );
});

test('recovery snapshots retain a bounded history of pre-merge states', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  for (let index = 0; index < 7; index += 1) {
    await storage.saveScheduleRecoverySnapshot(
      makeData(`snapshot-${index}`, index),
      'user-3',
      `reason-${index}`,
    );
  }

  const snapshots = await storage.getScheduleRecoverySnapshots('user-3');
  assert.equal(snapshots.length, 5);
  assert.equal(snapshots[0].data.schedules[0].name, 'snapshot-6');
  assert.equal(snapshots[4].data.schedules[0].name, 'snapshot-2');
});

test('recovery history is the final fallback when every journal slot is corrupt', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveScheduleRecoverySnapshot(makeData('last-known-good', 9), 'user-5', 'test');
  for (const suffix of ['', '.pending', '.mirror', '.backup']) {
    fake.values.set(`user_schedule_user-5${suffix}`, 'corrupt-json');
  }

  const recovered = await storage.getLocalSchedule('user-5');
  assert.equal(recovered.schedules[0].name, 'last-known-good');
});

test('clearing account data removes primary, journal, mirror, backup, and recovery slots', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('private'), 'user-4');
  await storage.saveScheduleRecoverySnapshot(makeData('private'), 'user-4', 'test');
  await storage.clearLocalSchedule('user-4', { throwOnError: true });

  assert.equal(
    [...fake.values.keys()].some((key) => key.startsWith('user_schedule_user-4')),
    false,
  );
});

test('local schedule storage is plain readable JSON without a compression prefix', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  const original = makeData('readable', 12);

  await storage.saveLocalSchedule(original, 'user-readable');
  const raw = fake.values.get('user_schedule_user-readable');

  assert.equal(raw.startsWith('PZ1:'), false);
  assert.deepEqual(JSON.parse(raw), original);
});

test('old compressed local values are not migrated by the plain JSON store', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.values.set('user_schedule_old-user', 'PZ1:old-compressed-value');

  const result = await storage.getLocalSchedule('old-user');

  assert.equal(result, null);
  assert.equal(fake.values.get('user_schedule_old-user'), 'PZ1:old-compressed-value');
});

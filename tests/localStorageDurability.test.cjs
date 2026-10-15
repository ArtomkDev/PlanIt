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
    { ...recovered, _localScopeOwner: 'user:user-2' },
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
  assert.deepEqual(
    JSON.parse(raw),
    { ...original, _localScopeOwner: 'user:user-readable' },
  );
});

test('guest and account stores remain isolated on the same device', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('guest'), null);
  await storage.saveLocalSchedule(makeData('account-a'), 'account-a');
  await storage.saveLocalSchedule(makeData('account-b'), 'account-b');

  assert.equal((await storage.getLocalSchedule(null)).schedules[0].name, 'guest');
  assert.equal((await storage.getLocalSchedule('account-a')).schedules[0].name, 'account-a');
  assert.equal((await storage.getLocalSchedule('account-b')).schedules[0].name, 'account-b');
});

test('a payload marked for another account is never returned from the current scope', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.values.set('user_schedule_account-b', JSON.stringify({
    ...makeData('private-a'),
    _localScopeOwner: 'user:account-a',
  }));
  fake.values.set('guest_schedule', JSON.stringify({
    ...makeData('private-b'),
    _localScopeOwner: 'user:account-b',
  }));

  await assert.rejects(storage.getLocalSchedule('account-b'), { code: 'local-storage/corrupt-data' });
  await assert.rejects(storage.getLocalSchedule(null), { code: 'local-storage/corrupt-data' });
});

test('legacy unmarked data remains readable only from the key where it already lives', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.values.set('guest_schedule', JSON.stringify(makeData('legacy-guest')));

  const legacy = await storage.getLocalSchedule(null);
  assert.equal(legacy.schedules[0].name, 'legacy-guest');
  assert.equal(await storage.getLocalSchedule('another-account'), null);
});

test('old compressed local values are not migrated by the plain JSON store', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.values.set('user_schedule_old-user', 'PZ1:old-compressed-value');

  await assert.rejects(storage.getLocalSchedule('old-user'), { code: 'local-storage/corrupt-data' });
  assert.equal(fake.values.get('user_schedule_old-user'), 'PZ1:old-compressed-value');
});

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('overlapping writes cannot interleave the journal or replace the latest draft', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  const entered = deferred();
  const release = deferred();
  const originalSet = fake.api.setItem;
  fake.api.setItem = async (key, value) => {
    if (key === 'guest_schedule' && JSON.parse(value).schedules[0].name === 'older') {
      entered.resolve();
      await release.promise;
    }
    return originalSet(key, value);
  };

  const older = storage.saveLocalSchedule(makeData('older', 1));
  await entered.promise;
  const newer = storage.saveLocalSchedule(makeData('newer', 2));
  await new Promise(resolve => setImmediate(resolve));
  release.resolve();
  const results = await Promise.allSettled([older, newer]);

  assert.ok(results.every(result => result.status === 'fulfilled'));
  assert.equal((await storage.getLocalSchedule()).schedules[0].name, 'newer');
  assert.equal(fake.values.has('guest_schedule.pending'), false);
  assert.equal(JSON.parse(fake.values.get('guest_schedule.backup')).schedules[0].name, 'older');
});

test('a read waits for the in-flight journal before returning or repairing data', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('old'));
  const entered = deferred();
  const release = deferred();
  const originalSet = fake.api.setItem;
  fake.api.setItem = async (key, value) => {
    if (key === 'guest_schedule.pending') {
      entered.resolve();
      await release.promise;
    }
    return originalSet(key, value);
  };
  const saving = storage.saveLocalSchedule(makeData('new', 2));
  await entered.promise;
  const reading = storage.getLocalSchedule();
  await new Promise(resolve => setImmediate(resolve));
  release.resolve();
  await saving;
  assert.equal((await reading).schedules[0].name, 'new');
});

test('clearing storage waits for earlier writes so deleted account data cannot reappear', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  const entered = deferred();
  const release = deferred();
  const originalSet = fake.api.setItem;
  fake.api.setItem = async (key, value) => {
    if (key === 'user_schedule_deleted') {
      entered.resolve();
      await release.promise;
    }
    return originalSet(key, value);
  };
  const saving = storage.saveLocalSchedule(makeData('private'), 'deleted');
  await entered.promise;
  const clearing = storage.clearLocalSchedule('deleted', { throwOnError: true });
  await new Promise(resolve => setImmediate(resolve));
  release.resolve();
  await Promise.allSettled([saving, clearing]);
  assert.equal(await storage.getLocalSchedule('deleted'), null);
});

test('concurrent recovery snapshots preserve both versions', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await Promise.all([
    storage.saveScheduleRecoverySnapshot(makeData('first'), 'user-history'),
    storage.saveScheduleRecoverySnapshot(makeData('second'), 'user-history'),
  ]);
  assert.deepEqual(
    (await storage.getScheduleRecoverySnapshots('user-history')).map(item => item.data.schedules[0].name),
    ['second', 'first'],
  );
});

test('a failed operation does not block later saves or another account', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.failNextSet.add('guest_schedule.pending');
  const failed = storage.saveLocalSchedule(makeData('fails'));
  const saved = storage.saveLocalSchedule(makeData('survives'));
  await assert.rejects(failed);
  await saved;
  await storage.saveLocalSchedule(makeData('other-account'), 'other');
  assert.equal((await storage.getLocalSchedule()).schedules[0].name, 'survives');
  assert.equal((await storage.getLocalSchedule('other')).schedules[0].name, 'other-account');
});

test('unrecoverable local corruption is reported without creating an empty replacement', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  fake.values.set('guest_schedule', '{broken');
  await assert.rejects(storage.getLocalSchedule(), { code: 'local-storage/corrupt-data' });
  assert.equal(fake.values.get('guest_schedule'), '{broken');
});

test('an invalid draft cannot overwrite any slot of a valid local schedule', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('valid'));
  const before = [...fake.values.entries()];
  await assert.rejects(storage.saveLocalSchedule({ global: 'invalid', schedules: [] }), {
    code: 'local-storage/invalid-data',
  });
  assert.deepEqual([...fake.values.entries()], before);
});

test('account deletion rejects late autosave and unmount backups after clearing private data', async () => {
  const fake = makeStorage();
  const storage = loadStorageModule(fake);
  await storage.saveLocalSchedule(makeData('private'), 'deleted');
  const clearing = storage.clearLocalSchedule('deleted', { throwOnError: true, preventWrites: true });
  const lateWrite = storage.saveLocalSchedule(makeData('late private backup'), 'deleted');
  await clearing;
  await assert.rejects(lateWrite, { code: 'local-storage/account-deleted' });
  await assert.rejects(storage.saveScheduleRecoverySnapshot(makeData('late recovery'), 'deleted'), { code: 'local-storage/account-deleted' });
  assert.equal(await storage.getLocalSchedule('deleted'), null);
  assert.equal(fake.values.size, 0);
  await storage.saveLocalSchedule(makeData('guest'));
  await storage.saveLocalSchedule(makeData('other'), 'other-account');
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileWithMocks = (filename, mocks) => {
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(source, {
    filename,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filename, module);
  testModule.filename = filename;
  testModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = testModule.require.bind(testModule);
  testModule.require = (request) => (
    mocks.has(request) ? mocks.get(request) : originalRequire(request)
  );
  testModule._compile(transformed, filename);
  return { exports: testModule.exports, source };
};

test('installation id is random, persistent, and independent of the account id', async () => {
  const filename = path.resolve(__dirname, '../src/utils/deviceService.js');
  const storage = new Map();
  let randomCalls = 0;
  const asyncStorage = {
    getItem: async (key) => storage.get(key) || null,
    setItem: async (key, value) => storage.set(key, value),
  };
  const { exports: deviceService } = compileWithMocks(filename, new Map([
    ['firebase/firestore', {}],
    ['../config/firebase', { db: {}, auth: {} }],
    ['./storage', { getDevicePrefs: async () => ({}) }],
    ['@react-native-async-storage/async-storage', { __esModule: true, default: asyncStorage }],
    ['expo-device', { modelName: 'Same Phone', brand: 'Brand', deviceName: 'Phone' }],
    ['react-native', { Platform: { OS: 'ios' } }],
    ['expo-crypto', {
      randomUUID: () => {
        randomCalls += 1;
        return '12345678-1234-4123-8123-123456789abc';
      },
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async () => 'fallback',
    }],
    ['firebase/auth', { signOut: async () => {} }],
    ['../services/notificationService', {
      NOTIFICATION_TYPES: { ACCOUNT_LOGIN: 'account_login', LESSON_REMINDER: 'lesson_reminder' },
      createLoginNotification: async () => {},
      getCurrentDevicePushRegistration: async () => null,
      getUserNotificationContext: async () => ({ notificationPreferences: {}, language: 'en' }),
      isNotificationPushEnabled: () => false,
      syncDevicePushRegistration: async () => null,
    }],
  ]));

  const first = await deviceService.getDeviceId('account-a');
  const second = await deviceService.getDeviceId('account-b');

  assert.equal(first, '12345678-1234-4123-8123-123456789abc');
  assert.equal(second, first);
  assert.equal(randomCalls, 1);
  assert.equal(storage.get('planit_installation_id_v1'), first);
});

class FakeTimestamp {
  constructor(ms) {
    this.ms = ms;
  }

  toMillis() {
    return this.ms;
  }

  static now() {
    return new FakeTimestamp(1_700_000_000_000);
  }

  static fromMillis(ms) {
    return new FakeTimestamp(ms);
  }
}

const i18n = compileWithMocks(path.resolve(__dirname, '../src/utils/i18n.js'), new Map([
  ['../locales/en.js', compileWithMocks(path.resolve(__dirname, '../src/locales/en.js'), new Map()).exports],
  ['../locales/uk.js', compileWithMocks(path.resolve(__dirname, '../src/locales/uk.js'), new Map()).exports],
])).exports;

test('device language updates normalize tags without creating or reviving sessions', async () => {
  let device = null;
  const updates = [];
  const { exports: service } = compileWithMocks(path.resolve(__dirname, '../src/utils/deviceService.js'), new Map([
    ['firebase/firestore', {
      doc: (...segments) => segments,
      getDoc: async () => ({ exists: () => device !== null, data: () => device }),
      updateDoc: async (ref, data) => updates.push({ ref, data }),
    }],
    ['../config/firebase', { db: {}, auth: {} }],
    ['./i18n', i18n],
    ['./storage', {}],
    ['@react-native-async-storage/async-storage', { getItem: async () => 'installation-12345678' }],
    ['expo-device', {}],
    ['react-native', { Platform: { OS: 'web' } }],
    ['expo-crypto', {}],
    ['firebase/auth', {}],
    ['../services/notificationService', {}],
  ]));
  await service.syncCurrentDeviceLanguage(null, 'uk');
  await service.syncCurrentDeviceLanguage('user', 'uk');
  for (const status of ['revoked', 'expired']) {
    device = { status, language: 'en' };
    await service.syncCurrentDeviceLanguage('user', 'uk');
  }
  device = { status: 'active', language: 'uk' };
  await service.syncCurrentDeviceLanguage('user', 'uk-UA');
  assert.equal(updates.length, 0);
  device = { status: 'active', language: 'en' };
  await service.syncCurrentDeviceLanguage('user', 'uk-UA');
  device = {};
  await service.syncCurrentDeviceLanguage('user', 'en-GB');
  assert.deepEqual(updates.map(({ data }) => data), [{ language: 'uk' }, { language: 'en' }]);
  assert.equal(updates[0].ref.at(-1), 'installation-12345678');
});

const loadNotificationService = () => {
  const filename = path.resolve(__dirname, '../src/services/notificationService.js');
  const committedBatches = [];
  const addedDocuments = [];
  const subscriptions = [];
  const getDocsHandlers = [];

  const firestore = {
    Timestamp: FakeTimestamp,
    addDoc: async (_collection, data) => {
      addedDocuments.push(data);
      return { id: `notification-${addedDocuments.length}` };
    },
    collection: (...segments) => ({ kind: 'collection', segments }),
    deleteField: () => ({ __deleteField: true }),
    deleteDoc: async () => {},
    doc: (...segments) => ({ kind: 'doc', segments }),
    getDoc: async () => ({ exists: () => false }),
    getDocs: async (request) => {
      const handler = getDocsHandlers.shift();
      return handler ? handler(request) : { empty: true, size: 0, docs: [] };
    },
    limit: (count) => ({ kind: 'limit', count }),
    onSnapshot: (request) => {
      subscriptions.push(request);
      return () => {};
    },
    orderBy: (field, direction) => ({ kind: 'orderBy', field, direction }),
    query: (base, ...constraints) => ({ kind: 'query', base, constraints }),
    updateDoc: async () => {},
    where: (field, operator, value) => ({ kind: 'where', field, operator, value }),
    writeBatch: () => {
      const operations = [];
      return {
        update: (ref, data) => operations.push({ type: 'update', ref, data }),
        delete: (ref) => operations.push({ type: 'delete', ref }),
        commit: async () => committedBatches.push(operations),
      };
    },
  };

  const { exports: service, source } = compileWithMocks(filename, new Map([
    ['react-native', { Platform: { OS: 'web' } }],
    ['@react-native-async-storage/async-storage', {
      __esModule: true,
      default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {} },
    }],
    ['expo-constants', { __esModule: true, default: {} }],
    ['expo', { isRunningInExpoGo: () => false }],
    ['firebase/firestore', firestore],
    ['../config/firebase', { db: {} }],
    ['../utils/i18n', i18n],
    ['../utils/scheduleTime', { buildLessonOccurrences: () => [] }],
    ['../utils/reminderSettings', {
      normalizeScheduleReminder: () => ({ enabled: false }),
      normalizeSubjectReminder: () => null,
    }],
  ]));

  return { service, source, committedBatches, addedDocuments, subscriptions, getDocsHandlers };
};

const snapshotWith = (count) => ({
  empty: count === 0,
  size: count,
  docs: Array.from({ length: count }, (_, index) => ({
    ref: { id: `doc-${index}` },
    data: () => ({ readAt: null }),
  })),
});

test('notification inbox is bounded and unread updates are chunked below Firestore limits', async () => {
  const { service, subscriptions, getDocsHandlers, committedBatches } = loadNotificationService();

  service.subscribeToNotifications('user-1', () => {});
  const inboxLimit = subscriptions[0].constraints.find((item) => item.kind === 'limit');
  assert.equal(inboxLimit.count, 100);

  getDocsHandlers.push(
    () => snapshotWith(450),
    () => snapshotWith(2),
  );
  await service.markAllNotificationsAsRead('user-1');

  assert.equal(committedBatches.length, 2);
  assert.equal(committedBatches[0].length, 450);
  assert.equal(committedBatches[1].length, 2);
  assert.equal(committedBatches.flat().every((operation) => operation.type === 'update'), true);
});

test('login notifications have a 90-day expiry and discard arbitrary metadata', async () => {
  const { service, addedDocuments } = loadNotificationService();

  await service.createLoginNotification('user-1', {
    lang: 'en',
    notificationPreferences: { pushByType: { account_login: false } },
    deviceId: 'installation-1',
    deviceName: 'Phone',
    platform: 'iOS',
    ipAddress: '127.0.0.1',
    metadata: { brand: 'Apple', model: 'Phone', injected: 'blocked' },
  });

  const stored = addedDocuments[0];
  assert.equal(stored.expiresAt.toMillis() - stored.createdAt.toMillis(), 90 * 24 * 60 * 60 * 1000);
  assert.deepEqual(stored.metadata, { brand: 'Apple', model: 'Phone' });
  assert.equal(stored.readAt, null);
});

test('device revocation is durable and every sync path uses the same installation id', () => {
  const deviceSource = fs.readFileSync(path.resolve(__dirname, '../src/utils/deviceService.js'), 'utf8');
  const firestoreSource = fs.readFileSync(path.resolve(__dirname, '../src/config/firestore.js'), 'utf8');
  const rootSource = fs.readFileSync(path.resolve(__dirname, '../src/Root.jsx'), 'utf8');

  assert.match(deviceSource, /status = DEVICE_STATUS\.REVOKED/);
  assert.match(deviceSource, /if \(isBlocked && options\.allowReactivation !== true\)/);
  assert.match(deviceSource, /status !== DEVICE_STATUS\.ACTIVE/);
  assert.doesNotMatch(firestoreSource, /getDeviceId\([^)]/);
  assert.match(firestoreSource, /updateDoc\(deviceRef/);
  assert.match(rootSource, /allowReactivation:\s*shouldCreateLoginNotification/);
  assert.match(rootSource, /error\?\.code === 'device\/revoked'/);
});

test('Firestore rules validate device state transitions and notification schemas', () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');

  assert.match(rules, /function validDeviceDocument\(data\)/);
  assert.match(rules, /function validNotificationDocument\(data\)/);
  assert.match(rules, /resource\.data\.status in \["revoked", "expired"\]/);
  assert.match(rules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\["readAt"\]\)/);
  assert.match(rules, /request\.resource\.data\.expiresAt <= request\.time \+ duration\.value\(91, "d"\)/);
});


test('login pushes use each recipient language, not the sender language', async () => {
  const { service, getDocsHandlers } = loadNotificationService();
  const devices = [
    { id: 'source', language: 'uk', expoPushToken: 'ExponentPushToken[source]' },
    { id: 'uk', language: 'uk-UA', expoPushToken: 'ExponentPushToken[uk]' },
    { id: 'en', language: 'en', expoPushToken: 'ExponentPushToken[en]' },
    { id: 'legacy', expoPushToken: 'ExponentPushToken[legacy]' },
    { id: 'revoked', language: 'uk', status: 'revoked', expoPushToken: 'ExponentPushToken[revoked]' },
  ];
  getDocsHandlers.push(() => ({
    docs: devices.map((device) => ({ id: device.id, ref: { id: device.id }, data: () => device })),
  }));
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    requests.push(...[].concat(JSON.parse(options.body)));
    return { ok: true, json: async () => ({ data: requests.map(() => ({ status: 'ok' })) }) };
  };
  try {
    await service.createLoginNotification('user-1', {
      deviceId: 'source', deviceName: 'Phone $&', lang: 'uk',
      notificationPreferences: { pushByType: { account_login: true } },
    });
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(requests.length, 3);
  assert.equal(requests[0].title, i18n.t('settings.notifications.types.account_login.title', 'uk'));
  assert.equal(requests[1].title, i18n.t('settings.notifications.types.account_login.title', 'en'));
  assert.equal(requests[2].title, requests[1].title);
  assert.match(requests[0].body, /Phone \$&/);
});

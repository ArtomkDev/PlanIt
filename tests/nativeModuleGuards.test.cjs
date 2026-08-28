const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const notificationServicePath = path.resolve(
  __dirname,
  '../src/services/notificationService.js',
);
const navigationMetricsPath = path.resolve(
  __dirname,
  '../src/navigation/navigationMetrics.js',
);

const loadNotificationService = ({ isExpoGo = true } = {}) => {
  let notificationsModuleLoads = 0;
  const notificationHandlers = [];
  const source = fs.readFileSync(notificationServicePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: notificationServicePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(notificationServicePath, module);
  testModule.filename = notificationServicePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(notificationServicePath));

  const asyncStorage = {
    getItem: async () => null,
    multiRemove: async () => {},
    removeItem: async () => {},
    setItem: async () => {},
  };
  const notificationsModule = {
    IosAuthorizationStatus: {
      AUTHORIZED: 2,
      PROVISIONAL: 3,
    },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationHandler: (handler) => {
      notificationHandlers.push(handler);
    },
  };
  const mocks = new Map([
    ['react-native', { Platform: { OS: 'ios' } }],
    ['@react-native-async-storage/async-storage', {
      __esModule: true,
      default: asyncStorage,
    }],
    ['expo-constants', { __esModule: true, default: {} }],
    ['expo', { isRunningInExpoGo: () => isExpoGo }],
    ['firebase/firestore', {}],
    ['../config/firebase', { db: {} }],
    ['../utils/i18n', { t: (key) => key }],
    ['../utils/scheduleTime', { buildLessonOccurrences: () => [] }],
    ['../utils/reminderSettings', {
      normalizeScheduleReminder: () => ({ enabled: false }),
      normalizeSubjectReminder: () => null,
    }],
  ]);

  const originalRequire = testModule.require.bind(testModule);
  testModule.require = function mockedRequire(request) {
    if (request === 'expo-notifications') {
      notificationsModuleLoads += 1;
      if (isExpoGo) {
        throw new Error('expo-notifications must not load in Expo Go');
      }
      return notificationsModule;
    }
    if (mocks.has(request)) return mocks.get(request);
    return originalRequire(request);
  };

  testModule._compile(transformed, notificationServicePath);
  return {
    getNotificationsModuleLoads: () => notificationsModuleLoads,
    notificationHandlers,
    service: testModule.exports,
    source,
  };
};

const loadNavigationMetrics = ({ isExpoGo = true, osVersion = '26.0' } = {}) => {
  const source = fs.readFileSync(navigationMetricsPath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: navigationMetricsPath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(navigationMetricsPath, module);
  testModule.filename = navigationMetricsPath;
  testModule.paths = Module._nodeModulePaths(path.dirname(navigationMetricsPath));

  const mocks = new Map([
    ['react-native', { Platform: { OS: 'ios', Version: osVersion } }],
    ['expo-constants', {
      __esModule: true,
      default: { executionEnvironment: isExpoGo ? 'storeClient' : 'standalone' },
      ExecutionEnvironment: { StoreClient: 'storeClient' },
    }],
  ]);

  const originalRequire = testModule.require.bind(testModule);
  testModule.require = function mockedRequire(request) {
    if (mocks.has(request)) return mocks.get(request);
    return originalRequire(request);
  };

  testModule._compile(transformed, navigationMetricsPath);
  return testModule.exports;
};

test('does not evaluate expo-notifications while running in Expo Go', async () => {
  const {
    getNotificationsModuleLoads,
    service,
    source,
  } = loadNotificationService();

  assert.doesNotMatch(source, /import\s+.*expo-notifications/);
  assert.equal(getNotificationsModuleLoads(), 0);
  assert.equal(await service.getCurrentDevicePushRegistration(), null);

  const permission = await service.ensureNotificationPushPermissionsForType(
    service.NOTIFICATION_TYPES.LESSON_REMINDER,
  );
  assert.deepEqual(permission, {
    granted: false,
    status: 'unsupported_expo_go',
  });
  assert.equal(getNotificationsModuleLoads(), 0);
});

test('keeps native notifications enabled in development and standalone builds', () => {
  const {
    getNotificationsModuleLoads,
    notificationHandlers,
  } = loadNotificationService({ isExpoGo: false });

  assert.equal(getNotificationsModuleLoads(), 1);
  assert.equal(notificationHandlers.length, 1);
});
test('falls back from Liquid Glass navigation in Expo Go', () => {
  const metrics = loadNavigationMetrics({ isExpoGo: true, osVersion: '26.0' });

  assert.equal(metrics.isLiquidGlassNavigationSupported(), false);
  assert.equal(metrics.getDefaultNavigationStyle(), 'classic');
  assert.equal(metrics.resolveNavigationStyle('liquidGlass'), 'classic');
  assert.deepEqual(metrics.getAvailableNavigationStyleKeys(), ['classic', 'floating', 'dot']);
});

test('keeps Liquid Glass navigation available in standalone iOS 26 builds', () => {
  const metrics = loadNavigationMetrics({ isExpoGo: false, osVersion: '26.0' });

  assert.equal(metrics.isLiquidGlassNavigationSupported(), true);
  assert.equal(metrics.getDefaultNavigationStyle(), 'liquidGlass');
  assert.equal(metrics.resolveNavigationStyle('liquidGlass'), 'liquidGlass');
  assert.deepEqual(metrics.getAvailableNavigationStyleKeys(), ['classic', 'floating', 'dot', 'liquidGlass']);
});

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

const tabNavigatorPath = path.resolve(
  __dirname,
  '../src/navigation/TabNavigator.jsx',
);
const scheduleScreenPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/Schedule.jsx',
);
const notificationPanelPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/NotificationInboxPanel.jsx',
);
const notificationHeaderPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/Header.jsx',
);
const notificationWeekStripPath = path.resolve(
  __dirname,
  '../src/pages/Schedule/components/WeekStrip.jsx',
);
const appBlurPath = path.resolve(
  __dirname,
  '../src/components/ui/AppBlur.jsx',
);
const tasksScreenPath = path.resolve(
  __dirname,
  '../src/pages/Tasks/Tasks.jsx',
);
const rootAppPath = path.resolve(
  __dirname,
  '../src/Root.jsx',
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

test('provides safe area context above navigation and attachment modals', () => {
  const source = fs.readFileSync(rootAppPath, 'utf8');
  const safeAreaProviderIndex = source.indexOf('<SafeAreaProvider>');
  const navigationContainerIndex = source.indexOf('<NavigationContainer');
  const safeAreaProviderEndIndex = source.indexOf('</SafeAreaProvider>');

  assert.ok(
    source.includes('import { SafeAreaProvider } from "react-native-safe-area-context";'),
    'Root must import SafeAreaProvider',
  );
  assert.ok(safeAreaProviderIndex >= 0, 'SafeAreaProvider must be rendered');
  assert.ok(
    safeAreaProviderIndex < navigationContainerIndex,
    'SafeAreaProvider must wrap the navigation tree',
  );
  assert.ok(
    safeAreaProviderEndIndex > navigationContainerIndex,
    'SafeAreaProvider must remain mounted around modal descendants',
  );
});

test('keeps notification movement and corner radius on the Reanimated UI thread', () => {
  const source = fs.readFileSync(tabNavigatorPath, 'utf8');

  assert.match(source, /from 'react-native-reanimated'/);
  assert.match(source, /useSharedValue\(0\)/);
  assert.match(source, /drawerProgress\.value\s*=\s*withTiming\(toValue/);
  assert.match(source, /drawerProgress\.value\s*=\s*nextProgress/);
  assert.match(source, /borderRadius:\s*interpolate\(drawerProgress\.value,\s*\[0,\s*1\],\s*\[0,\s*20\]\)/);
  assert.doesNotMatch(source, /Animated\.timing\(drawerProgress/);
  assert.doesNotMatch(source, /drawerMotionProgress/);
  assert.doesNotMatch(source, /DRAWER_VISUAL_/);
});

test('does not shadow the runtime global in components with Reanimated worklets', () => {
  const workletSources = [
    tabNavigatorPath,
    scheduleScreenPath,
    notificationHeaderPath,
    notificationWeekStripPath,
    appBlurPath,
  ].map((sourcePath) => fs.readFileSync(sourcePath, 'utf8'));

  workletSources.forEach((source) => {
    assert.doesNotMatch(source, /\bglobal\s*[,}]/);
    assert.match(source, /global:\s*globalSettings/);
  });
});

test('keeps notifications transparent and underneath the moving app shell', () => {
  const navigatorSource = fs.readFileSync(tabNavigatorPath, 'utf8');
  const scheduleSource = fs.readFileSync(scheduleScreenPath, 'utf8');
  const notificationPanelSource = fs.readFileSync(notificationPanelPath, 'utf8');
  const appShellIndex = navigatorSource.indexOf('styles.appShellMotion');
  const notificationLayerIndex = navigatorSource.indexOf('styles.notificationLayer');

  assert.doesNotMatch(navigatorSource, /renderToHardwareTextureAndroid/);
  assert.doesNotMatch(navigatorSource, /shouldRasterizeIOS/);
  assert.doesNotMatch(navigatorSource, /opacity:\s*drawerOpacity/);
  assert.doesNotMatch(navigatorSource, /styles\.notificationUnderlay/);
  assert.doesNotMatch(navigatorSource, /styles\.notificationDrawerSurface/);
  assert.doesNotMatch(navigatorSource, /styles\.notificationDrawerClip/);
  assert.doesNotMatch(navigatorSource, /drawerBackgroundColor|drawerCardBackgroundColor/);
  assert.doesNotMatch(notificationPanelSource, /cardBackgroundColor|Animated\.createAnimatedComponent/);
  assert.match(navigatorSource, /drawerContentInset:\s*0/);
  assert.match(navigatorSource, /styles\.notificationLayer,\s*\{\s*width:\s*drawerWidth\s*\}/);
  assert.match(navigatorSource, /NotificationInboxPanel backgroundColor="transparent"/);
  assert.doesNotMatch(navigatorSource, /notificationsMounted\s*&&\s*\(\s*<View[\s\S]*?styles\.notificationLayer/);
  assert.ok(notificationLayerIndex >= 0, 'the notification layer must be rendered');
  assert.ok(appShellIndex >= 0, 'the moving app shell must be rendered');
  assert.ok(notificationLayerIndex < appShellIndex, 'notifications must be rendered before and underneath the native app shell');
  assert.match(scheduleSource, /interpolateColor\([\s\S]*?\[themeColors\.backgroundColor,\s*themeColors\.backgroundColor2\]/);
});

test('matches Tasks colors exactly and only swaps colors on the main interface', () => {
  const tasksSource = fs.readFileSync(tasksScreenPath, 'utf8');
  const scheduleSource = fs.readFileSync(scheduleScreenPath, 'utf8');
  const headerSource = fs.readFileSync(notificationHeaderPath, 'utf8');
  const weekStripSource = fs.readFileSync(notificationWeekStripPath, 'utf8');
  const blurSource = fs.readFileSync(appBlurPath, 'utf8');
  const notificationPanelSource = fs.readFileSync(notificationPanelPath, 'utf8');

  assert.match(tasksSource, /styles\.container,\s*\{\s*backgroundColor:\s*themeColors\.backgroundColor\s*\}/);
  assert.match(tasksSource, /backgroundColor:\s*themeColors\.backgroundColor2/);
  assert.match(scheduleSource, /\[themeColors\.backgroundColor,\s*themeColors\.backgroundColor2\]/);
  assert.match(headerSource, /\[themeColors\.backgroundColor2,\s*themeColors\.backgroundColor\]/);
  assert.match(weekStripSource, /\[themeColors\.backgroundColor2,\s*themeColors\.backgroundColor\]/);
  assert.match(blurSource, /interpolateColor/);
  assert.doesNotMatch(notificationPanelSource, /interpolateColor|drawerProgress/);
});

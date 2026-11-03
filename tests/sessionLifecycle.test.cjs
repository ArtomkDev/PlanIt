const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = callback => setImmediate(callback);
global.cancelAnimationFrame = frame => clearImmediate(frame);

const compiled = new Map();
function load(relative, mocks) {
  const filename = path.resolve(__dirname, '..', relative);
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}

function gate() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function mountRoot(t, options = {}) {
  let onAuth;
  const auth = { currentUser: null };
  const signouts = [];
  const listeners = [];
  const host = name => ({ children, ...props }) => React.createElement(name, props, children);
  const noop = () => {};
  const wrapper = host('wrapper');
  const scheduleState = { isDevicePrefsReady: options.prefsReady ?? true, isLangLoading: false, lang: 'uk' };
  const colors = { backgroundColor: '#F2F4F7' };
  const mocks = {
    'react-native': { View: host('View'), StyleSheet: { absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } } },
    'react-native-gesture-handler': { GestureHandlerRootView: wrapper },
    '@react-navigation/native': { NavigationContainer: host('navigation'), DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } },
    './hooks/useAppTheme': () => ({ colorScheme: 'light', colors }),
    './hooks/useSystemThemeColors': () => ({ colors }),
    './components/ui/MorphingLoader': 'Loader',
    './utils/i18n': { t: key => key },
    './components/ui/NativeThemeStyles': wrapper,
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({
      Navigator: ({ screenLayout, children }) => screenLayout({ children }),
      Screen: ({ name }) => React.createElement('screen', { name }),
    }) },
    'firebase/auth': { onIdTokenChanged: (_auth, callback) => { onAuth = callback; return noop; }, signOut: async () => { signouts.push(auth.currentUser?.uid); } },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hideAsync: options.hideSplash || (async () => {}) },
    'expo-status-bar': { StatusBar: () => null },
    'react-native-safe-area-context': { SafeAreaProvider: wrapper },
    'expo-linking': { createURL: () => 'planit://', getInitialURL: async () => null },
    './config/firebase': { auth },
    './utils/analytics/analytics': { trackScreenView: noop },
    './utils/analytics/crashlytics': { setCrashlyticsUser: noop, initGlobalErrorHandling: noop },
    './utils/authFlags': { consumeManualLogin: () => false, setManualLogin: noop },
    './hooks/useAppLanguage': () => ({ lang: 'uk', isLangLoading: false }),
    './utils/storage': { getLocalSchedule: options.readGuest || (async () => null) },
    './services/attachmentService': { releaseAttachmentObjectUrls() {} },
    './widgets/widgetService': {
      clearWidgetScheduleData: options.clearWidget || (async () => {}),
      syncWidgetPushSubscription: options.syncWidget || (async () => {}),
    },
    './utils/deviceService': {
      registerDevice: options.register || (async () => {}),
      listenForDeviceRemoval: options.listen || (async (uid, callback) => {
        const listener = { uid, callback, disposed: false };
        listeners.push(listener);
        return () => { listener.disposed = true; };
      }),
    },
    './context/BottomSheetPresentationContext': { BottomSheetPresentationProvider: wrapper },
    './context/AppDialogContext': { AppDialogProvider: wrapper },
    './context/ScheduleProvider': { ScheduleProvider: host('schedule-provider'), useScheduleData: () => scheduleState },
    './context/EditorProvider': { EditorProvider: wrapper },
    './context/AttachmentImagePreviewContext': { AttachmentImagePreviewProvider: wrapper },
    './context/AdsContext': { AdsProvider: wrapper },
    './auth/accountEmailService': { createPasswordResetNavigationUrl: value => value },
    './navigation/mainLayoutLinking': {},
  };
  for (const name of ['./auth/AuthScreen', './layouts/MainLayout', './pages/Settings/components/LegalDocumentScreen', './components/privacy/CookieConsentBanner', './components/ui/WebThemeStyles', './auth/PasswordResetScreen']) mocks[name] = wrapper;
  const Root = load('src/Root.jsx', mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Root)); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return {
    tree, signouts, listeners,
    emit(user) { auth.currentUser = user; return onAuth(user); },
    user(uid) { return { uid, emailVerified: true }; },
    async updateScheduleState(patch) {
      Object.assign(scheduleState, patch);
      await act(async () => tree.update(React.createElement(Root)));
    },
    async layout() {
      await act(async () => tree.root.findAllByType('View').find(node => node.props.onLayout).props.onLayout());
    },
  };
}

test('startup keeps the splash until session restoration, navigation and the themed layout are ready', async t => {
  const frames = [];
  t.mock.method(global, 'requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  t.mock.method(global, 'cancelAnimationFrame', () => {});
  const reading = gate();
  let hides = 0;
  const env = await mountRoot(t, {
    readGuest: () => reading.promise,
    hideSplash: async () => { hides++; },
  });
  let restoring;
  await act(async () => { restoring = env.emit(null); });
  const startup = env.tree.root.findByProps({ accessibilityRole: 'progressbar' });
  assert.equal(startup.props.style[0].backgroundColor, '#F2F4F7');
  assert.equal(env.tree.root.findAllByType('Loader').length, 1);
  assert.equal(hides, 0);

  await act(async () => { reading.resolve(null); await restoring; });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(hides, 0);

  await act(async () => env.tree.root.findByType('navigation').props.onReady());
  assert.equal(hides, 0, 'navigation readiness alone cannot expose an unpainted surface');
  assert.equal(env.tree.root.findAllByType('Loader').length, 1, 'the startup surface covers the first native screen while it lays out');
  await env.layout();
  assert.equal(env.tree.root.findAllByType('Loader').length, 1);
  assert.equal(hides, 0, 'the themed frame is committed before dismissing the native splash');
  await act(async () => frames.shift()());
  assert.equal(env.tree.root.findAllByType('Loader').length, 0);
  assert.equal(hides, 1);
});

test('saved theme and language are restored before mounting any navigation screen', async t => {
  const env = await mountRoot(t, { prefsReady: false });
  await act(async () => env.emit(null));
  assert.equal(env.tree.root.findAllByType('navigation').length, 0);
  assert.equal(env.tree.root.findAllByType('Loader').length, 1);
  await env.updateScheduleState({ isDevicePrefsReady: true, isLangLoading: true });
  assert.equal(env.tree.root.findAllByType('navigation').length, 0);
  await env.updateScheduleState({ isLangLoading: false });
  assert.equal(env.tree.root.findAllByType('navigation').length, 1);
});

test('a delayed guest read cannot replace a newly authenticated session', async t => {
  const reading = gate();
  const env = await mountRoot(t, { readGuest: () => reading.promise });
  let restoring;
  await act(async () => { restoring = env.emit(null); });
  await act(async () => env.emit(env.user('account')));
  await act(async () => { reading.resolve({ global: {}, schedules: [] }); await restoring; });
  const provider = env.tree.root.findByType('schedule-provider');
  assert.equal(provider.props.user.uid, 'account');
  assert.equal(provider.props.guest, false);
});

test('leaving an authenticated session clears its widget without clearing a guest startup', async t => {
  let clears = 0;
  const env = await mountRoot(t, { clearWidget: async () => { clears++; } });
  await act(async () => env.emit(null));
  assert.equal(clears, 0);
  await act(async () => env.emit({ uid: 'owner', emailVerified: true }));
  await act(async () => env.emit(null));
  assert.equal(clears, 1);
});

test('a registered installation retries the widget push subscription after account startup', async t => {
  const events = [];
  const env = await mountRoot(t, {
    register: async () => events.push('registered'),
    syncWidget: async () => events.push('widget'),
  });
  await act(async () => env.emit(env.user('owner')));
  assert.deepEqual(events, ['registered', 'widget']);
});

test('device registration finishing after unmount cannot attach listeners', async t => {
  const registration = gate();
  const env = await mountRoot(t, { register: () => registration.promise });
  let registering;
  await act(async () => { registering = env.emit(env.user('account')); });
  await act(async () => env.tree.unmount());
  await act(async () => { registration.resolve(); await registering; });
  assert.equal(env.listeners.length, 0);
});

test('late listener setup from the same account is disposed after a token refresh', async t => {
  const firstListener = gate();
  let calls = 0, firstDisposed = false, secondDisposed = false;
  const env = await mountRoot(t, { listen: async () => {
    calls++;
    if (calls === 1) return firstListener.promise;
    return () => { secondDisposed = true; };
  } });
  let first;
  await act(async () => { first = env.emit(env.user('account')); });
  await act(async () => env.emit(env.user('account')));
  await act(async () => { firstListener.resolve(() => { firstDisposed = true; }); await first; });
  assert.equal(firstDisposed, true);
  assert.equal(secondDisposed, false);
  await act(async () => env.tree.unmount());
  assert.equal(secondDisposed, true);
});

test('revocation from an old registration cannot sign out a different account', async t => {
  const registration = gate();
  const env = await mountRoot(t, { register: uid => uid === 'old' ? registration.promise : Promise.resolve() });
  let first;
  await act(async () => { first = env.emit(env.user('old')); });
  await act(async () => env.emit(env.user('new')));
  await act(async () => { registration.reject(Object.assign(new Error('Revoked'), { code: 'device/revoked' })); await first; });
  assert.deepEqual(env.signouts, []);
  assert.equal(env.tree.root.findByType('schedule-provider').props.user.uid, 'new');
});

test('an in-flight email check cannot end a new session and transient offline errors keep the current one', async t => {
  const callbacks = [];
  let intervalCallback, signouts = 0;
  t.mock.method(global, 'setInterval', callback => { intervalCallback = callback; return 1; });
  t.mock.method(global, 'clearInterval', () => {});
  const reading = gate();
  const auth = { currentUser: { uid: 'old', email: 'target@example.com', reload: () => reading.promise } };
  const service = load('src/utils/deviceService.js', {
    'firebase/firestore': { doc: () => ({}), onSnapshot: (_ref, callback) => { callbacks.push(callback); return () => {}; } },
    '../config/firebase': { db: {}, auth },
    '@react-native-async-storage/async-storage': { getItem: async () => 'installation-12345678' },
    'expo-device': {}, 'react-native': { Platform: { OS: 'ios' } }, 'expo-crypto': {},
    'firebase/auth': { signOut: async () => { signouts++; } },
    '../services/notificationService': {}, './i18n': {}, './storage': {},
  });
  const unsubscribe = await service.listenForDeviceRemoval('old', () => { signouts++; });
  callbacks[1]({ exists: () => true, data: () => ({ pendingEmail: 'target@example.com' }) });
  const checking = intervalCallback();
  auth.currentUser = { uid: 'new' };
  reading.resolve();
  await checking;
  assert.equal(signouts, 0);
  callbacks[0]({ exists: () => true, data: () => ({ status: 'revoked' }) });
  assert.equal(signouts, 0);
  auth.currentUser = { uid: 'old', reload: async () => { throw Object.assign(new Error('Offline'), { code: 'auth/network-request-failed' }); } };
  await intervalCallback();
  assert.equal(signouts, 0);
  unsubscribe();
});

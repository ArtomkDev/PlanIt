const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
const tinycolor = require('tinycolor2');

global.IS_REACT_ACT_ENVIRONMENT = true;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}

const themes = load('src/config/themes.js').default;
for (const mode of ['light', 'dark', 'oled']) {
  test(`${mode} themes preserve readable accent text and button labels, including custom colors`, () => {
    for (const accent of [...Object.keys(themes.accentColors), '#FFFFFF', '#000000', '#808080', '#ffcc00']) {
      const colors = themes.getColors(mode, accent);
      assert.ok(tinycolor.readability(colors.textOnAccent, colors.accentColor) >= 4.5, `${accent}: button label`);
      for (const background of [colors.backgroundColor, colors.backgroundColor2]) {
        assert.ok(tinycolor.readability(colors.accentTextColor, background) >= 4.5, `${accent}: accent text on ${background}`);
        assert.ok(tinycolor.readability(colors.textColor2, background) >= 4.5, `${mode}: secondary text on ${background}`);
        assert.ok(tinycolor.readability(colors.textColor3, background) >= 4.5, `${mode}: muted text on ${background}`);
      }
    }
  });
}

const fixture = () => ({
  global: { language: 'uk', theme: ['light', 'blue'], currentScheduleId: 'existing', version: 1, baseVersion: 1, lastModified: 1, lastSynced: 1 },
  schedules: [{ id: 'existing', name: 'Existing schedule', days: [], version: 1, baseVersion: 1, lastModified: 1, lastSynced: 1 }],
  deletedSchedules: [],
});

async function mountProvider(t, options = {}) {
  const writes = [], prefsWrites = [];
  const mocks = {
    'react-native': { Platform: { OS: 'ios' }, useColorScheme: () => 'light', AppState: { addEventListener: () => ({ remove() {} }) } },
    '@react-native-community/netinfo': { addEventListener(callback) { callback({ isConnected: false }); return () => {}; } },
    'firebase/auth': { signOut: async () => {} },
    '@react-native-async-storage/async-storage': { removeItem: async () => {} },
    'expo-crypto': { randomUUID: () => 'generated-id' },
    '../config/firebase': { app: { options: {} }, auth: {} },
    '../config/firestore': {
      getScheduleFromServer: (...args) => options.readCloud?.(...args) ?? Promise.resolve(null),
      subscribeToSchedule: () => () => {},
      saveSchedule: async () => {}, resetUserSchedules: async () => {}, updateDeviceSyncTimeAndCleanUp: async () => {},
    },
    '../utils/storage': {
      getDevicePrefs: async () => ({ language: 'uk', theme: ['light', 'blue'], blur: true, navigationStyle: 'classic', navigationLabels: true, navigationAnimations: true, hapticsEnabled: true, currentScheduleId: 'existing' }),
      saveDevicePrefs: async prefs => { prefsWrites.push(prefs); },
      getLocalSchedule: (...args) => options.readLocal?.(...args) ?? Promise.resolve(null),
      saveLocalSchedule: async (data, scope) => {
        writes.push({ data, scope });
        if (options.failWrite) throw new Error('Disk unavailable');
      },
      clearLocalSchedule: async () => {}, saveScheduleRecoverySnapshot: async () => {},
    },
    '../hooks/useAppLanguage': () => ({ lang: 'uk', isLangLoading: false }),
    '../utils/deviceService': { syncCurrentDeviceLanguage: async () => {} },
    '../utils/haptics': { setHapticsEnabled() {} },
    '../widgets/widgetService': { getWidgetSelectedScheduleId: async () => null, setWidgetSelectedScheduleId: async () => {}, syncScheduleToWidget: async () => {} },
    '../services/notificationService': { cancelLessonRemindersForSchedule: async () => {}, reconcileLessonRemindersForSchedule: async () => {} },
    '../navigation/navigationMetrics': { getDefaultNavigationStyle: () => 'classic', resolveNavigationStyle: value => value || 'classic' },
  };
  const { ScheduleProvider, useSchedule } = load('src/context/ScheduleProvider.jsx', mocks);
  let snapshot, tree;
  function Probe() { snapshot = useSchedule(); return null; }
  await act(async () => {
    tree = create(React.createElement(ScheduleProvider, { guest: options.guest, user: options.guest ? null : { uid: 'user-1' } }, React.createElement(Probe)));
  });
  t.after(async () => act(async () => tree.unmount()));
  return { state: () => snapshot, writes, prefsWrites };
}

test('a failed guest read exposes recovery without overwriting existing storage; retry loads the original schedule', async t => {
  let recovered = false;
  const provider = await mountProvider(t, { guest: true, readLocal: async () => {
    if (!recovered) throw new Error('Read unavailable');
    return fixture();
  } });
  assert.equal(provider.state().isLoading, false);
  assert.equal(provider.state().error, 'Read unavailable');
  assert.equal(provider.state().schedules.length, 0);
  assert.deepEqual(provider.writes, []);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
  assert.ok(provider.writes.every(write => write.data.schedules.length === 1));
});

test('an unreadable account cache is preserved until retry, including unsynced changes', async t => {
  let recovered = false, cloudReads = 0;
  const provider = await mountProvider(t, {
    readLocal: async () => {
      if (!recovered) throw new Error('Read unavailable');
      return fixture();
    },
    readCloud: async () => { cloudReads++; return null; },
  });
  assert.equal(provider.state().error, 'Read unavailable');
  assert.deepEqual(provider.writes, []);
  assert.equal(cloudReads, 0);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
});

test('a failed cloud read cannot persist an empty replacement, and retry restores the server schedule', async t => {
  let recovered = false;
  const provider = await mountProvider(t, { readCloud: async () => {
    if (!recovered) throw new Error('Offline');
    return fixture();
  } });
  assert.equal(provider.state().error, 'Offline');
  assert.equal(provider.state().isDirty, false);
  assert.deepEqual(provider.writes, []);
  recovered = true;
  await act(async () => provider.state().retryInitialization());
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().schedule.id, 'existing');
  assert.equal(provider.writes.length, 1);
  assert.equal(provider.writes[0].scope, 'user-1');
});

test('a disk failure after receiving cloud data retains the fetched schedule instead of creating empty data', async t => {
  const provider = await mountProvider(t, { readCloud: async () => fixture(), failWrite: true });
  assert.equal(provider.state().error, 'Disk unavailable');
  assert.equal(provider.state().schedule.id, 'existing');
  assert.ok(provider.writes.length > 0);
  assert.ok(provider.writes.every(write => write.data.schedules[0]?.id === 'existing'));
});

test('a successful empty read still permits first-run onboarding', async t => {
  const provider = await mountProvider(t, { guest: true });
  assert.equal(provider.state().error, null);
  assert.equal(provider.state().isLoading, false);
  assert.deepEqual(provider.state().schedules, []);
});

test('device theme changes use the provider and preserve unrelated preferences', async t => {
  const provider = await mountProvider(t, { guest: true, readLocal: async () => fixture() });
  await act(async () => {
    provider.state().setGlobalDraft(prev => ({ ...prev, theme: ['dark', 'pastelBlue'] }));
    provider.state().setGlobalDraft(prev => ({ ...prev, theme: ['oled', 'yellow'] }));
  });
  assert.deepEqual(provider.state().global.theme, ['oled', 'yellow']);
  const lastPrefs = provider.prefsWrites.at(-1);
  assert.deepEqual(lastPrefs.theme, ['oled', 'yellow']);
  assert.equal(lastPrefs.language, 'uk');
  assert.equal(lastPrefs.navigationStyle, 'classic');
  assert.equal(lastPrefs.currentScheduleId, 'existing');
});

const i18n = load('src/utils/i18n.js');
const tr = key => i18n.t(key, 'uk');
async function mountImport(t, fetchSharedSchedule, initialCode = '') {
  const added = [], active = [];
  let closed = 0, tree;
  const Component = load('src/components/modals/ImportScheduleModal.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Keyboard: { dismiss() {} } },
    '@gorhom/bottom-sheet': { BottomSheetTextInput: 'Input' },
    'phosphor-react-native': { DownloadSimple: 'Download', X: 'Close' },
    '../../context/ScheduleProvider': {
      useScheduleData: () => ({ global: {}, lang: 'uk' }),
      useScheduleActions: () => ({ addSchedule: value => added.push(value), setGlobalDraft: updater => active.push(updater({}).currentScheduleId) }),
    },
    '../../services/shareService': { fetchSharedSchedule },
    '../../utils/scheduleValidation': { sanitizeImportedSchedule: data => ({ ...data, id: 'imported' }) },
    '../../utils/haptics': { triggerHaptic() {} },
    '../ui/BottomSheet': { __esModule: true, default: 'Sheet', SheetScrollView: 'Scroll' },
    '../ui/MorphingLoader': 'Loader',
  }).default;
  const render = visible => React.createElement(Component, { visible, initialCode, onClose: () => closed++ });
  await act(async () => { tree = create(render(true)); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, added, active, closed: () => closed, update: async visible => act(async () => tree.update(render(visible))) };
}
const button = (root, key) => root.findAllByType('Button').find(node => node.props.accessibilityLabel === tr(key));

test('import ignores a late response after closing and reopening the sheet', async t => {
  let resolve;
  const modal = await mountImport(t, () => new Promise(done => { resolve = done; }));
  await act(async () => modal.root().findByType('Input').props.onChangeText('ABCDE'));
  await act(async () => button(modal.root(), 'share.find_btn').props.onPress());
  assert.equal(button(modal.root(), 'share.find_btn').props.disabled, true);
  await act(async () => modal.root().findByType('Sheet').props.onClose());
  await modal.update(false);
  await modal.update(true);
  await act(async () => resolve({ scheduleName: 'Old response', scheduleData: {} }));
  assert.equal(modal.root().findByType('Input').props.value, '');
  assert.equal(button(modal.root(), 'share.add_to_account_btn'), undefined);
  assert.deepEqual(modal.added, []);
});

test('repeated presses import a schedule once and select the imported schedule', async t => {
  const modal = await mountImport(t, async () => ({ scheduleName: 'Shared', ownerName: 'Teacher', scheduleData: {} }), 'ABCDE');
  const importButton = button(modal.root(), 'share.add_to_account_btn');
  await act(async () => { importButton.props.onPress(); importButton.props.onPress(); });
  assert.equal(modal.added.length, 1);
  assert.deepEqual(modal.active, ['imported']);
  assert.equal(modal.closed(), 1);
});

test('import errors retain the code and restore the search action', async t => {
  const modal = await mountImport(t, async () => { throw new Error('Offline'); }, 'ABCDE');
  assert.equal(modal.root().findByType('Input').props.value, 'ABCDE');
  assert.equal(button(modal.root(), 'share.find_btn').props.disabled, false);
  assert.ok(modal.root().findAllByType('Text').some(node => node.props.children === tr('common.action_failed')));
});

class AnimatedValue {
  constructor(value) { this.value = value; this.listeners = new Map(); }
  setValue(value) { this.value = value; for (const callback of this.listeners.values()) callback({ value }); }
  addListener(callback) { const id = String(this.listeners.size); this.listeners.set(id, callback); return id; }
  removeListener(id) { this.listeners.delete(id); }
  stopAnimation() {}
  interpolate({ inputRange, outputRange }) {
    const index = Math.max(0, inputRange.findIndex((value, i) => this.value <= value && i > 0) - 1);
    if (this.value >= inputRange.at(-1)) return outputRange.at(-1);
    if (typeof outputRange[index] !== 'number') return outputRange[index];
    const fraction = Math.max(0, (this.value - inputRange[index]) / (inputRange[index + 1] - inputRange[index]));
    return outputRange[index] + (outputRange[index + 1] - outputRange[index]) * fraction;
  }
}

test('segmented controls use readable labels for both default and explicitly supplied accent backgrounds', async t => {
  const Component = load('src/components/ui/TabSwitcher.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Animated: { Value: AnimatedValue }, Easing: {} },
    '../../utils/haptics': { triggerHaptic() {} }, '../../hooks/useReducedMotionPreference': () => true,
  }).default;
  const colors = themes.getColors('dark', 'pastelYellow');
  let tree;
  for (const background of [undefined, colors.accentColor, colors.backgroundColor2, 'transparent']) {
    await act(async () => {
      const element = React.createElement(Component, { tabs: [{ id: 'first', label: 'First' }], activeTab: 'first', onTabPress() {}, themeColors: colors, activeTabBackgroundColor: background });
      if (tree) tree.update(element);
      else tree = create(element);
    });
    const labelColor = Object.assign({}, ...tree.root.findByType('Text').props.style).color;
    assert.equal(labelColor, !background || background === colors.accentColor ? colors.textOnAccent : colors.textColor);
  }
  t.after(async () => act(async () => tree.unmount()));
});

async function mountOnboarding(t) {
  const added = [], alerts = [], scrolls = [];
  let gestures, back, tree;
  const Component = load('src/pages/Onboarding/OnboardingWizard.jsx', {
    'react-native': {
      View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', KeyboardAvoidingView: 'Keyboard',
      StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390 }), useColorScheme: () => 'light',
      Alert: { alert: (...args) => alerts.push(args) },
      Keyboard: { dismiss() {} },
      BackHandler: { addEventListener(_, callback) { back = callback; return { remove() {} }; } },
      PanResponder: { create(callbacks) { gestures = callbacks; return { panHandlers: {} }; } },
      Animated: { Value: AnimatedValue, View: 'AnimatedView', ScrollView: 'Scroll', createAnimatedComponent: x => x, event: () => () => {} },
    },
    'expo-crypto': { randomUUID: () => 'onboarded' },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    '../../context/ScheduleProvider': {
      useScheduleData: () => ({ lang: 'uk', global: {} }),
      useScheduleActions: () => ({ addSchedule: data => added.push(data), setGlobalDraft() {} }),
    },
    '../../components/ui/GradientBackground': props => React.createElement(props.component || 'View', props),
    '../../components/ui/TabSwitcher': 'Tabs',
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row', '../utils/haptics': { triggerHaptic() {} },
    '../../components/CalendarSheet/CalendarSheet': 'Calendar',
    '../../components/ui/AppBlur': 'Blur', '../../components/ui/AppSwitch': 'Switch',
    '../../components/ui/SettingsKit/SettingsGroup': 'Group', '../../components/ui/SettingsKit/SettingsRow': 'Row', '../../components/ui/SettingsKit/SettingsActionRow': 'Action',
    '../../utils/haptics': { triggerHaptic() {} },
    '../../hooks/useReducedMotionPreference': () => true,
    '../../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component), { createNodeMock: node => node.type === 'Scroll' ? { scrollTo: options => scrolls.push(options) } : null }); });
  t.after(async () => act(async () => tree.unmount()));
  return { root: () => tree.root, gestures: () => gestures, back: () => back(), added, alerts, scrolls };
}

test('leaving a long timing step resets scrolling and restores the next step’s own height on Android', async t => {
  const wizard = await mountOnboarding(t);
  const steps = wizard.root().findAllByType('AnimatedView').filter(node => node.props.onLayout && 'pointerEvents' in node.props);
  await act(async () => steps[3].props.onLayout({ nativeEvent: { layout: { height: 1600 } } }));
  for (let i = 0; i < 3; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  const height = () => wizard.root().findAllByType('AnimatedView').map(node => Object.assign({}, ...(Array.isArray(node.props.style) ? node.props.style : [node.props.style]))).find(style => typeof style.height === 'number' && style.width === 390).height;
  assert.equal(height(), 1600);
  await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  assert.equal(height(), 400);
  assert.deepEqual(wizard.scrolls.at(-1), { y: 0, animated: false });
});

test('onboarding exposes navigation immediately, Android Back returns a step, and swiping past the last step cannot create a schedule', async t => {
  const wizard = await mountOnboarding(t);
  assert.equal(button(wizard.root(), 'onboarding.next').props.disabled, false);
  await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => assert.equal(wizard.back(), true));
  assert.equal(button(wizard.root(), 'common.back').props.disabled, true);
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => {
    wizard.gestures().onPanResponderGrant();
    wizard.gestures().onPanResponderMove({}, { dx: -400 });
    wizard.gestures().onPanResponderRelease({}, { dx: -400, vx: -1 });
  });
  assert.deepEqual(wizard.added, []);
  const done = button(wizard.root(), 'common.done');
  await act(async () => { done.props.onPress(); done.props.onPress(); });
  assert.equal(wizard.added.length, 1);
});

test('onboarding preserves a zero-minute break when committing the schedule', async t => {
  const wizard = await mountOnboarding(t);
  const input = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === `${tr('schedule.day_schedule.break')} 1`);
  await act(async () => input.props.onChangeText('0'));
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.equal(wizard.added[0].breaks[0], 0);
});

test('onboarding saves independently edited lesson durations and the requested number of slots', async t => {
  const wizard = await mountOnboarding(t);
  const duration = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === i18n.t('settings.schedule_editor.timing.lesson_duration', 'uk', { number: 2 }));
  await act(async () => duration.props.onChangeText('45'));
  await act(async () => button(wizard.root(), 'settings.schedule_editor.timing.add').props.onPress());
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.deepEqual(wizard.added[0].slotDurations, [80, 45, 80, 80, 80, 80, 80]);
  assert.equal(wizard.added[0].breaks.length, 6);
});

for (const duration of ['999', '0', '']) {
test(`onboarding refuses an invalid lesson duration: ${duration || 'empty'}`, async t => {
  const wizard = await mountOnboarding(t);
  const row = wizard.root().findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title'));
  await act(async () => row.props.onPress());
  const input = wizard.root().findAllByType('Input').find(node => node.props.accessibilityLabel === tr('schedule.main_screen.duration'));
  await act(async () => input.props.onChangeText(duration));
  for (let i = 0; i < 4; i++) await act(async () => button(wizard.root(), 'onboarding.next').props.onPress());
  await act(async () => button(wizard.root(), 'common.done').props.onPress());
  assert.deepEqual(wizard.added, []);
  assert.equal(wizard.alerts.length, 1);
  assert.ok(button(wizard.root(), 'onboarding.next'));
});
}

test('the theme picker renders selected colors and commits changes through the schedule provider', async t => {
  const updates = [];
  const Component = load('src/pages/Settings/components/preferences/ThemeSettings.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Platform: { OS: 'ios', select: x => x.default } },
    'phosphor-react-native': { PencilSimple: 'Pencil', Check: 'Check' },
    '../../../../context/ScheduleProvider': {
      useScheduleData: () => ({ global: { theme: ['light', 'blue'] }, lang: 'uk' }),
      useScheduleActions: () => ({ setGlobalDraft: updater => updates.push(updater({})) }),
    },
    '../../../../layouts/SettingsScreenLayout': 'Layout',
    '../../../../components/ui/AdvancedColorPicker': 'Picker', '../../../../components/ui/AppSwitch': 'Switch',
    '../../../../utils/haptics': { triggerHaptic() {} },
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => act(async () => tree.unmount()));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'pastelYellow' }).props.onPress());
  assert.deepEqual(updates.at(-1).theme, ['light', 'pastelYellow']);
  assert.equal(tree.root.findByType('Check').props.color, themes.getColors('light', 'pastelYellow').textOnAccent);
});

test('the schedule editor protects an unsaved draft and allows leaving after a successful save', async t => {
  let guard, tree, wentBack = 0;
  const alerts = [], dispatched = [], added = [];
  const navigation = { dispatch: action => dispatched.push(action), canGoBack: () => true, goBack() { assert.equal(guard.enabled, false); wentBack++; } };
  const Component = load('src/pages/Settings/components/ScheduleEditorScreen.jsx', {
    'react-native': {
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', TextInput: 'Input', KeyboardAvoidingView: 'Keyboard',
      StyleSheet: { create: x => x }, Platform: { OS: 'ios' }, LayoutAnimation: {}, UIManager: {},
      useWindowDimensions: () => ({ height: 844 }), Alert: { alert: (...args) => alerts.push(args) },
      Animated: { Value: AnimatedValue, ScrollView: 'Scroll', event: () => () => {} },
    },
    '@react-navigation/native': {
      useNavigation: () => navigation, useRoute: () => ({ params: { isNew: true } }),
      usePreventRemove: (enabled, callback) => { guard = { enabled, callback }; },
    },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    'expo-crypto': { randomUUID: () => 'new-schedule' },
    '../../../context/ScheduleProvider': {
      useScheduleData: () => ({ schedules: [], global: {}, lang: 'uk' }),
      useScheduleActions: () => ({ setData() {}, setGlobalDraft() {}, addSchedule: data => added.push(data) }),
      useScheduleLayout: () => ({ tabBarHeight: 80 }),
    },
    '../../../components/ui/SettingsHeader': props => React.createElement('Header', {}, props.rightButton),
    '../../../components/ui/TabSwitcher': 'Tabs', '../../../components/CalendarSheet/CalendarSheet': 'Calendar',
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row', '../utils/haptics': { triggerHaptic() {} },
    '../../../components/ui/AdvancedColorPicker': 'Picker', '../../../components/ui/AppSwitch': 'Switch',
    '../../../components/ui/SettingsKit/SettingsGroup': 'Group', '../../../components/ui/SettingsKit/SettingsRow': 'Row', '../../../components/ui/SettingsKit/SettingsActionRow': 'Action',
    '../../../components/ScheduleIcon': 'ScheduleIcon', './ScheduleIconPickerSheet': 'IconPicker',
    '../../../utils/haptics': { triggerHaptic() {} }, '../../../hooks/useReducedMotionPreference': () => true,
    '../../../services/notificationService': { NOTIFICATION_TYPES: {}, ensureNotificationPushPermissionsForType: async () => ({ granted: true }) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => act(async () => tree.unmount()));
  assert.equal(guard.enabled, false);
  const name = tree.root.findAllByType('Input').find(node => node.props.accessibilityLabel === tr('settings.schedule_editor.enter_name'));
  await act(async () => name.props.onChangeText('Changed draft'));
  assert.equal(guard.enabled, true);
  const action = { type: 'GO_BACK' };
  await act(async () => guard.callback({ data: { action } }));
  assert.deepEqual(dispatched, []);
  assert.equal(alerts[0][2][0].style, 'cancel');
  alerts[0][2][1].onPress();
  assert.deepEqual(dispatched, [action]);
  await act(async () => tree.root.findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title')).props.onPress());
  const duration = tree.root.findAllByType('Input').find(node => node.props.accessibilityLabel === tr('schedule.main_screen.duration'));
  await act(async () => duration.props.onChangeText('0'));
  await act(async () => button(tree.root, 'common.save').props.onPress());
  assert.deepEqual(added, []);
  assert.equal(wentBack, 0);
  await act(async () => duration.props.onChangeText('45'));
  await act(async () => button(tree.root, 'common.save').props.onPress());
  assert.equal(added.length, 1);
  assert.equal(added[0].name, 'Changed draft');
  assert.equal(wentBack, 1);
});

async function mountTimeEditor(t, platform = 'android', options = {}) {
  const Component = load('src/components/ScheduleTimeEditor.jsx', {
    'react-native': { View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Platform: { OS: platform } },
    '@react-native-community/datetimepicker': 'TimePicker',
    'phosphor-react-native': new Proxy({}, { get: (_, key) => key }),
    './ui/TabSwitcher': 'Tabs', './ui/SettingsKit/SettingsGroup': 'Group', './ui/SettingsKit/SettingsRow': 'Row',
    '../utils/haptics': { triggerHaptic() {} },
  }).default;
  const time = load('src/utils/scheduleTime.js');
  let tree, value = { start_time: '08:30', duration: 45, breaks: [10, 20], slotDurations: [45, 60, 80] }, active = true;
  const render = () => React.createElement(Component, {
    value, onChange(next) { value = next; tree.update(render()); }, themeColors: themes.getColors('dark', 'pastelYellow'), lang: 'uk', mode: 'dark', active, ...options,
  });
  await act(async () => { tree = create(render()); });
  t.after(async () => act(async () => tree.unmount()));
  return {
    root: () => tree.root, value: () => value,
    slots: () => time.buildScheduleSlots(value.start_time, value.duration, value.breaks, value.slotDurations),
    async setActive(next) { await act(async () => { active = next; tree.update(render()); }); },
    async open(number, field) {
      const label = i18n.t('settings.schedule_editor.timing.lesson_time', 'uk', { number, field: i18n.t(`settings.schedule_editor.timing.${field}`, 'uk'), time: this.slots()[number - 1][field] });
      await act(async () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === label).props.onPress());
    },
  };
}
const clockDate = (hours, minutes) => { const date = new Date(); date.setHours(hours, minutes, 0, 0); return date; };

test('Android time edits derive breaks and resize lessons, while cancel preserves the draft', async t => {
  const editor = await mountTimeEditor(t);
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(9, 30)));
  assert.deepEqual(editor.value().breaks, [15, 20]);
  assert.equal(editor.slots()[2].start, '10:50');
  await editor.open(2, 'end');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(10, 45)));
  assert.deepEqual(editor.value().slotDurations, [45, 75, 80]);
  const before = JSON.stringify(editor.value());
  await editor.open(1, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'dismissed' }));
  assert.equal(JSON.stringify(editor.value()), before);
});

test('invalid Android edits keep the previous time and display an inline explanation', async t => {
  const editor = await mountTimeEditor(t);
  const before = JSON.stringify(editor.value());
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({ type: 'set' }, clockDate(8, 0)));
  assert.equal(JSON.stringify(editor.value()), before);
  assert.equal(editor.root().findAllByType('Text').filter(node => node.props.accessibilityRole === 'alert').length, 1);
});

test('iOS spinner edits apply immediately and leaving onboarding closes the picker', async t => {
  const editor = await mountTimeEditor(t, 'ios');
  await editor.open(1, 'end');
  await act(async () => editor.root().findByType('TimePicker').props.onChange({}, clockDate(9, 30)));
  assert.equal(editor.value().slotDurations[0], 60);
  await act(async () => button(editor.root(), 'common.done').props.onPress());
  assert.equal(editor.value().slotDurations[0], 60);
  await editor.open(2, 'start');
  await editor.setActive(false);
  await editor.setActive(true);
  assert.equal(editor.root().findAllByType('TimePicker').length, 0);
});

test('web time editing commits a validated time through the same adjustment logic', async t => {
  const editor = await mountTimeEditor(t, 'web');
  await editor.open(2, 'start');
  await act(async () => editor.root().findByType('input').props.onChange({ target: { value: '09:30' } }));
  await act(async () => button(editor.root(), 'common.done').props.onPress());
  assert.equal(editor.value().breaks[0], 15);
  assert.equal(editor.slots()[2].start, '10:50');
});

test('slot count changes preserve previous numbers and protect assigned slots', async t => {
  const editor = await mountTimeEditor(t, 'android', { minimumSlots: 3 });
  assert.equal(button(editor.root(), 'settings.schedule_editor.timing.remove').props.disabled, true);
  await act(async () => button(editor.root(), 'settings.schedule_editor.timing.add').props.onPress());
  assert.deepEqual(editor.value().slotDurations, [45, 60, 80, 80]);
  assert.deepEqual(editor.value().breaks, [10, 20, 20]);
  await act(async () => button(editor.root(), 'settings.schedule_editor.timing.remove').props.onPress());
  assert.deepEqual(editor.value().slotDurations, [45, 60, 80]);
  assert.equal(button(editor.root(), 'settings.schedule_editor.timing.remove').props.disabled, true);
});

test('bulk presets and individual gap edits update the same timeline, including zero-minute gaps', async t => {
  const editor = await mountTimeEditor(t);
  await act(async () => editor.root().findAllByType('Row').find(node => node.props.label === tr('settings.menu.duration.title')).props.onPress());
  await act(async () => editor.root().findByType('Tabs').props.onTabPress('45'));
  assert.deepEqual(editor.value().slotDurations, ['45', '45', '45']);
  const gap = editor.root().findAllByType('Input').find(node => node.props.accessibilityLabel === `${tr('schedule.day_schedule.break')} 1`);
  await act(async () => gap.props.onChangeText('0'));
  assert.equal(editor.slots()[1].start, '09:15');
  assert.equal(editor.slots()[2].start, '10:20');
});

test('a failed reset cannot report success or delete guest schedules, and duplicate confirmations are ignored', async t => {
  let tree, confirm, resolve, calls = 0, guestDeletes = 0;
  const haptics = [];
  const Component = load('src/pages/Settings/components/ResetDB.jsx', {
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: x => x }, Platform: { OS: 'ios' }, Alert: { alert(_, __, actions) { confirm = actions[1].onPress; } } },
    'phosphor-react-native': { Warning: 'Warning' },
    '../../../context/ScheduleProvider': {
      useScheduleData: () => ({ guest: false, global: {}, isLoading: false, lang: 'uk' }),
      useScheduleActions: () => ({ resetApplication() { calls++; return new Promise(done => { resolve = done; }); }, deleteGuestSchedules: async () => guestDeletes++ }),
    },
    '../../../layouts/SettingsScreenLayout': 'Layout', '../../../components/ui/MorphingLoader': 'Loader',
    '../../../utils/haptics': { triggerHaptic: value => haptics.push(value) },
  }).default;
  await act(async () => { tree = create(React.createElement(Component)); });
  t.after(async () => act(async () => tree.unmount()));
  await act(async () => button(tree.root, 'common.wipe').props.onPress());
  let first, duplicate;
  await act(async () => { first = confirm(); duplicate = confirm(); });
  assert.equal(calls, 1);
  assert.equal(button(tree.root, 'common.wipe').props.disabled, true);
  await act(async () => { resolve(false); await first; await duplicate; });
  assert.equal(guestDeletes, 0);
  assert.ok(!haptics.includes('success'));
  assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === tr('common.action_failed')));
  assert.equal(button(tree.root, 'common.wipe').props.disabled, false);
});

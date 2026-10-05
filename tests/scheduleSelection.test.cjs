const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const compiled = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name.endsWith('.js') ? name : name + '.js')), mocks)
    : original(name);
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}
const i18n = load('src/utils/i18n.js');
const ownership = load('src/utils/scheduleOwnership.js');
let nextId = 0;
const ids = { generateId: () => `copy-${++nextId}` };
const copyUtils = load('src/utils/scheduleCopy.js', { './idGenerator': ids });
const colors = { backgroundColor: '#fff', backgroundColor2: '#eee', textColor: '#111', textColor2: '#666', accentColor: '#2458ad', borderColor: '#ddd' };
function nativeMock() {
  const calls = { animations: [], stops: 0, alerts: [] };
  class Value { constructor(value) { this.value = value; } setValue(v) { this.value = v; } stopAnimation() {} }
  return { calls, native: {
    View: 'View', Text: 'Text', TouchableOpacity: 'Button', Pressable: 'Button',
    StyleSheet: { create: s => s, hairlineWidth: 1 }, Platform: { OS: 'ios' },
    Alert: { alert: (...args) => calls.alerts.push(args) }, Easing: { out: x => x, cubic: 1, quad: 2 },
    Animated: { View: 'AnimatedView', Value, timing: (_, config) => {
      calls.animations.push(config);
      return { start() {}, stop() { calls.stops++; } };
    } },
  } };
}

async function renderTabs(t, overrides = {}, reduced = false) {
  const { calls, native } = nativeMock();
  const Component = load('src/components/ui/TabSwitcher.jsx', {
    'react-native': native,
    '../../utils/haptics': { triggerHaptic() {} },
    '../../hooks/useReducedMotionPreference': () => reduced,
  }).default;
  let props = { tabs: [{ id: 0, label: 'Start', colorDot: 'red' }, { id: 1, label: 'End' }], activeTab: 1, themeColors: colors, onTabPress: id => calls.pressed = id, ...overrides };
  let tree;
  await act(async () => { tree = create(React.createElement(Component, props)); });
  t.after(async () => act(async () => tree.unmount()));
  return { tree, calls,
    async update(patch) { props = { ...props, ...patch }; await act(async () => tree.update(React.createElement(Component, props))); },
    async measure(index, x, width = 100) { await act(async () => tree.root.findAllByType('Button')[index].props.onLayout({ nativeEvent: { layout: { x, width } } })); },
    indicator: () => tree.root.findAllByType('AnimatedView'),
  };
}

test('tabs position the initial non-first selection immediately and ignore repeated measurements', async t => {
  const ui = await renderTabs(t);
  assert.equal(ui.indicator().length, 0);
  await ui.measure(1, 104);
  const style = Object.assign({}, ...ui.indicator()[0].props.style);
  assert.equal(style.left, 0);
  assert.equal(style.width, 100);
  assert.equal(style.transform[0].translateX.value, 104);
  assert.equal(ui.calls.animations.length, 0);
  await ui.measure(0, 4);
  await ui.measure(1, 104);
  assert.equal(ui.calls.animations.length, 0);
  await act(async () => ui.tree.root.findAllByType('Button')[0].props.onPress());
  assert.equal(ui.calls.pressed, 0);
});

test('tab motion is interruptible and native; resizing snaps without a width animation', async t => {
  const ui = await renderTabs(t);
  await ui.measure(0, 4);
  await ui.measure(1, 104);
  await ui.update({ activeTab: 0 });
  await ui.update({ activeTab: 1 });
  assert.equal(ui.calls.stops, 1);
  assert.equal(ui.calls.animations.length, 2);
  assert.ok(ui.calls.animations.every(a => a.useNativeDriver && a.duration === 180));
  await ui.measure(1, 164, 160);
  assert.equal(ui.calls.stops, 2);
  assert.equal(ui.calls.animations.length, 2);
  assert.equal(Object.assign({}, ...ui.indicator()[0].props.style).width, 160);
});

test('custom values, dynamic tabs, transparent colors and reduced motion remain supported', async t => {
  const ui = await renderTabs(t, { activeTabBackgroundColor: 'transparent', activeTextColor: 'purple', withShadow: true }, true);
  await ui.measure(0, 4);
  await ui.measure(1, 104);
  assert.equal(Object.assign({}, ...ui.indicator()[0].props.style).backgroundColor, 'transparent');
  await ui.update({ activeTab: 0 });
  assert.equal(ui.calls.animations.length, 0);
  await ui.update({ activeTab: 'custom' });
  assert.equal(ui.indicator().length, 0);
  await ui.update({ tabs: [{ id: 'account', label: 'Account' }, { id: 'local', label: 'Local' }], activeTab: 'local' });
  assert.equal(ui.indicator().length, 0);
  await ui.measure(1, 104);
  assert.equal(ui.indicator().length, 1);
  await ui.update({ tabs: [] });
  assert.equal(ui.indicator().length, 0);
});

test('schedule copy is independent, uniquely named, resets sync and keeps internal references consistent', () => {
  const source = { id: 'original', nameKey: 'common.default_schedule', name: 'old', version: 8, baseVersion: 7, lastSynced: 99, deletedAt: 1,
    subjects: [{ id: 'math', name: 'Math' }], schedule: [{ week1: [{ subjectId: 'math' }] }],
    tasks: [{ id: 'task', lessonRef: { scheduleId: 'original', subjectId: 'math' }, attachments: [{ id: 'file' }] }] };
  const copy = copyUtils.createScheduleCopy(source, [{ name: 'Основний розклад — копія' }], 'uk');
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.name, 'Основний розклад — копія (2)');
  assert.equal(copy.nameKey, undefined);
  assert.equal(copy.deletedAt, undefined);
  assert.equal(copy.version, 0);
  assert.equal(copy.lastSynced, 0);
  assert.equal(copy.tasks[0].lessonRef.scheduleId, copy.id);
  assert.equal(copy.tasks[0].lessonRef.subjectId, copy.subjects[0].id);
  copy.subjects[0].name = 'Changed';
  copy.tasks[0].attachments[0].id = 'changed';
  assert.equal(source.subjects[0].name, 'Math');
  assert.equal(source.tasks[0].attachments[0].id, 'file');
  assert.equal(source.tasks[0].lessonRef.scheduleId, 'original');
  assert.equal(copyUtils.createScheduleCopy({ id: 'empty', name: 'Empty' }, [], 'en').name, 'Empty — copy');
});

async function renderScreen(t, options = {}) {
  const { calls, native } = nativeMock();
  Object.assign(calls, { added: [], saved: [], selected: [], navigated: [] });
  const state = { user: { uid: 'user' }, guest: false, global: { currentScheduleId: 'one' }, lang: 'uk', schedules: [
    { id: 'one', name: 'Навчання', subjects: [] }, { id: 'two', name: 'Робота', subjects: [] },
  ], ...options.state };
  const local = { global: { currentScheduleId: 'local' }, schedules: [{ id: 'local', name: 'Локальний', subjects: [] }] };
  const Screen = load('src/pages/Settings/components/ScheduleSwitcher.jsx', {
    'react-native': native, 'phosphor-react-native': new Proxy({}, { get: (_, name) => name }),
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => calls.navigated.push(args) }) },
    '../../../hooks/useReducedMotionPreference': () => !!options.reduced,
    '../../../context/ScheduleProvider': { useScheduleData: () => state, useScheduleActions: () => ({
      setGlobalDraft: update => { state.global = update(state.global); calls.selected.push(state.global.currentScheduleId); },
      addSchedule: async s => { if (options.failCopy) throw new Error('failed'); calls.added.push(s); }, removeSchedule: async () => {},
    }) },
    '../../../layouts/SettingsScreenLayout': 'Layout', '../../../components/ui/MorphingLoader': 'Loader',
    '../../../components/ScheduleIcon': 'ScheduleIcon', '../../../config/themes': { getColors: () => colors, accentColors: {} },
    '../../../utils/i18n': i18n, '../../../utils/idGenerator': ids, '../../../utils/scheduleCopy': copyUtils,
    '../../../utils/storage': { getLocalSchedule: async () => structuredClone(local), saveLocalSchedule: async data => calls.saved.push(data) },
    '../../../utils/haptics': { triggerHaptic() {} }, '../../../utils/scheduleDisplay': { getScheduleDisplayName: s => s.name },
    '../../../utils/scheduleOwnership': ownership,
    '../../../utils/scheduleColors': { resolveScheduleColor: () => '#2458ad', scheduleColorWithAlpha: () => '#eef' },
    '../../../components/ui/TabSwitcher': 'Tabs', '../../../components/ui/SettingsKit/SettingsRow': 'Action',
    '../../../components/modals/ShareScheduleModal': 'ShareModal', '../../../components/modals/ImportScheduleModal': 'ImportModal',
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Screen)); });
  t.after(async () => act(async () => tree.unmount()));
  return { tree, calls, local,
    text: () => tree.root.findAllByType('Text').map(n => n.props.children).flat().join(' '),
    async tab(id) { await act(async () => tree.root.findByType('Tabs').props.onTabPress(id)); },
    async menu(name) { await act(async () => tree.root.findByProps({ accessibilityLabel: `Дії з розкладом «${name}»` }).props.onPress()); },
    action: label => tree.root.findAllByType('Action').find(n => n.props.label === label),
  };
}

test('screen uses shared tabs and separate selection/menu; copying account schedule is deduplicated', async t => {
  const ui = await renderScreen(t);
  assert.equal(ui.tree.root.findAllByType('Tabs').length, 1);
  await ui.menu('Робота');
  assert.deepEqual(ui.calls.selected, []);
  const copy = ui.action('Створити копію').props.onPress;
  await act(async () => { copy(); copy(); });
  assert.equal(ui.calls.added.length, 1);
  assert.equal(ui.calls.added[0].name, 'Робота — копія');
  assert.equal(ui.calls.saved.length, 0);
  const radio = ui.tree.root.findByProps({ accessibilityLabel: 'Робота' });
  await act(async () => radio.props.onPress());
  assert.deepEqual(ui.calls.selected, ['two']);
});

test('local copy stays local and retains original; tabs clear expanded actions', async t => {
  const ui = await renderScreen(t);
  await ui.menu('Навчання');
  await ui.tab('guest');
  assert.equal(ui.tree.root.findAllByType('Action').length, 0);
  await ui.menu('Локальний');
  await act(async () => ui.action('Створити копію').props.onPress());
  assert.equal(ui.calls.added.length, 0);
  assert.equal(ui.calls.saved.length, 1);
  assert.equal(ui.calls.saved[0].schedules.length, 2);
  assert.deepEqual(ui.calls.saved[0].schedules[0], ui.local.schedules[0]);
  assert.equal(ui.calls.saved[0].schedules[1].name, 'Локальний — копія');
  assert.equal(ui.calls.saved[0].schedules[1].cloudMigrationOfferHandled, true);
  assert.equal(ui.calls.saved[0].global.currentScheduleId, 'local');
});

test('guest copies use provider; copy failure unlocks UI and displays an error', async t => {
  const guest = await renderScreen(t, { state: { guest: true, user: null }, reduced: true });
  await guest.menu('Навчання');
  await act(async () => guest.action('Створити копію').props.onPress());
  assert.equal(guest.calls.added.length, 1);
  assert.equal(guest.calls.animations.length, 0);
  const failed = await renderScreen(t, { failCopy: true });
  await failed.menu('Навчання');
  await act(async () => failed.action('Створити копію').props.onPress());
  assert.match(failed.text(), /Не вдалося завершити дію/);
  assert.ok(failed.tree.root.findAllByType('Button').every(n => !n.props.disabled));
});

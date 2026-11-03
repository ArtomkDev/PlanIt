const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
const filename = path.resolve(__dirname, '../src/navigation/PlanItTabBar.jsx');
const code = babel.transformFileSync(filename, {
  configFile: false, babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
}).code;

async function mountBar(t, platform = 'android') {
  const timers = new Map(), idle = new Map(), animations = [], calls = [];
  let sequence = 0, reduced = false, prevented = false;
  const schedule = (map, callback, delay) => { const id = ++sequence; map.set(id, { callback, delay }); return id; };
  t.mock.method(global, 'setTimeout', (callback, delay) => schedule(timers, callback, delay));
  t.mock.method(global, 'clearTimeout', id => timers.delete(id));
  const oldIdle = global.requestIdleCallback, oldCancel = global.cancelIdleCallback;
  global.requestIdleCallback = callback => schedule(idle, callback);
  global.cancelIdleCallback = id => idle.delete(id);
  let state = {
    key: 'tabs', index: 0, preloadedRouteKeys: [],
    routes: [
      { name: 'ScheduleTab', key: 'schedule' },
      { name: 'TasksTab', key: 'tasks', params: { filter: 'study' } },
      { name: 'SettingsTab', key: 'settings' },
    ],
  };
  const navigation = {
    getState: () => state,
    preload: (name, params) => {
      calls.push(['preload', name, params]);
      state = { ...state, preloadedRouteKeys: [...state.preloadedRouteKeys, state.routes.find(route => route.name === name).key] };
    },
    emit: event => { calls.push(['emit', event]); return { defaultPrevented: prevented }; },
    navigate: (name, params) => calls.push(['navigate', name, params]),
  };
  class Value {
    constructor(value) { this.value = value; }
    stopAnimation() {}
    setValue(value) { this.value = value; }
    interpolate() { return this.value; }
  }
  const colors = { accentTextColor: '#00bcd4', accentColor: '#00bcd4', textColor2: '#999', backgroundColor2: '#222', borderColor: '#333' };
  const mocks = {
    react: React,
    'react-native': {
      Animated: {
        View: 'AnimatedView', Value, multiply: () => 1,
        timing: (value, config) => ({ start() { animations.push(config); value.setValue(config.toValue); }, stop() {} }),
      },
      Easing: { out: fn => fn, cubic: value => value ** 3 },
      Keyboard: { isVisible: () => false, addListener: () => ({ remove() {} }) },
      Platform: { OS: platform, select: values => values[platform] ?? values.default }, Pressable: 'Pressable', View: 'View', Text: 'Text',
      StyleSheet: { create: value => value },
    },
    '../context/ScheduleProvider': { useScheduleData: () => ({ global: { theme: ['dark', 'cyan'] } }) },
    '../config/themes': { __esModule: true, default: { getColors: () => colors } },
    '../components/ui/AppBlur': 'Blur',
    './navigationMetrics': {
      resolveNavigationStyle: () => 'classic',
      NAVIGATION_METRICS: { classic: { heightWithLabels: 64, heightIconsOnly: 52, iconSize: 24, indicator: { width: 30, height: 3, radius: 2 } } },
    },
    '../utils/haptics': { triggerHaptic: event => calls.push(['haptic', event]) },
    '../hooks/useReducedMotionPreference': { __esModule: true, default: () => reduced },
  };
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = name => { assert.ok(name in mocks, name); return mocks[name]; };
  loaded._compile(code, filename);
  const Bar = loaded.exports.default;
  const descriptors = Object.fromEntries(state.routes.map(route => [route.key, { options: { tabBarLabel: route.name } }]));
  const element = () => React.createElement(Bar, { state, descriptors, navigation, insets: { bottom: 20 } });
  let tree;
  await act(async () => { tree = create(element()); });
  t.after(async () => {
    await act(async () => tree.unmount());
    if (oldIdle === undefined) delete global.requestIdleCallback;
    else global.requestIdleCallback = oldIdle;
    if (oldCancel === undefined) delete global.cancelIdleCallback;
    else global.cancelIdleCallback = oldCancel;
  });
  const run = async map => {
    const [id, entry] = map.entries().next().value || [];
    assert.ok(entry, 'a scheduled callback exists');
    map.delete(id);
    await act(async () => entry.callback({ timeRemaining: () => 50 }));
  };
  return {
    tree, calls, animations, timers, idle,
    button: index => tree.root.findAllByType('Pressable')[index],
    runTimer: () => run(timers), runIdle: () => run(idle),
    prevent: value => { prevented = value; },
    async focus(index) { state = { ...state, index }; await act(async () => tree.update(element())); },
    async reduceMotion() { reduced = true; await act(async () => tree.update(element())); },
  };
}

test('tabs respond on touch down and dispatch navigation before secondary feedback', async t => {
  const bar = await mountBar(t);
  assert.equal(bar.animations.length, 0, 'initial tabs do not animate from their existing state');
  await act(async () => bar.button(1).props.onPressIn());
  assert.deepEqual(bar.animations.at(-1), { toValue: 0.96, duration: 80, useNativeDriver: true });
  await act(async () => bar.button(1).props.onPressOut());
  assert.equal(bar.calls.length, 0, 'cancelled touches cannot navigate');
  await act(async () => bar.button(1).props.onPress());
  assert.deepEqual(bar.calls.map(call => call[0]), ['emit', 'navigate', 'haptic']);
  assert.deepEqual(bar.calls[1], ['navigate', 'TasksTab', { filter: 'study' }]);
  await bar.focus(1);
  assert.equal(bar.button(1).props.accessibilityState.selected, true);
  assert.equal(bar.animations.filter(animation => animation.duration === 160).length, 2);
  await bar.reduceMotion();
  const count = bar.animations.length;
  await act(async () => bar.button(2).props.onPressIn());
  await act(async () => bar.button(2).props.onPressOut());
  assert.equal(bar.animations.length, count);
});

test('prevented presses, reselection and long presses retain navigation event semantics', async t => {
  const bar = await mountBar(t);
  bar.prevent(true);
  await act(async () => bar.button(1).props.onPress());
  assert.equal(bar.calls.filter(call => call[0] === 'navigate').length, 0);
  bar.prevent(false);
  await act(async () => bar.button(0).props.onPress());
  assert.equal(bar.calls.filter(call => call[0] === 'navigate').length, 0);
  await act(async () => bar.button(1).props.onLongPress());
  assert.deepEqual(bar.calls.at(-1), ['emit', { type: 'tabLongPress', target: 'tasks' }]);
});

test('Android warms only inactive destinations in idle time without changing the selected route', async t => {
  const bar = await mountBar(t);
  assert.equal([...bar.timers.values()][0].delay, 500);
  assert.equal(bar.calls.length, 0);
  await bar.runTimer();
  await bar.runIdle();
  assert.deepEqual(bar.calls[0], ['preload', 'TasksTab', { filter: 'study' }]);
  assert.equal(bar.button(0).props.accessibilityState.selected, true);
  await bar.runTimer();
  await bar.runIdle();
  assert.deepEqual(bar.calls[1], ['preload', 'SettingsTab', undefined]);
  assert.equal(bar.timers.size, 0);
  assert.equal(bar.idle.size, 0);
  assert.equal(bar.calls.filter(call => call[0] === 'navigate').length, 0);
});

test('preloading rechecks the active route and cancels outstanding idle work on unmount', async t => {
  const bar = await mountBar(t);
  await bar.focus(1);
  await bar.runTimer();
  await bar.runIdle();
  assert.equal(bar.calls.length, 0, 'the user already opened the queued destination');
  await bar.runTimer();
  const pending = [...bar.idle.values()][0].callback;
  await act(async () => bar.tree.unmount());
  assert.equal(bar.idle.size, 0);
  await act(async () => pending());
  assert.equal(bar.calls.length, 0);
});

for (const platform of ['ios', 'web']) {
  test(`${platform} retains its current screen-loading policy`, async t => {
    const bar = await mountBar(t, platform);
    assert.equal(bar.timers.size, 0);
    assert.equal(bar.idle.size, 0);
  });
}

async function mountSchedule(t, initialData = {}, initialIntent) {
  let focused = true, headerRenders = 0, calendarRenders = 0;
  const listeners = new Set();
  const data = { schedule: null, schedules: [], global: { theme: ['dark', 'cyan'] }, lang: 'uk', ...initialData };
  const selections = [], params = [], moves = [];
  const frames = new Map();
  let frameId = 0;
  const originalRequestFrame = global.requestAnimationFrame;
  const originalCancelFrame = global.cancelAnimationFrame;
  global.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  global.cancelAnimationFrame = id => frames.delete(id);
  const navigation = { setParams: value => params.push(value) };
  let route = { params: { lessonViewIntent: initialIntent } };
  const setGlobalDraft = update => selections.push(update({}));
  const shared = { value: 0 };
  const filename = path.resolve(__dirname, '../src/pages/Schedule/Schedule.jsx');
  const mocks = {
    react: React,
    'react-native': { View: 'View', TouchableOpacity: 'Button', StyleSheet: { create: value => value } },
    '@react-navigation/native': { useIsFocused: () => React.useSyncExternalStore(
      listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => focused,
    ) },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: initial => React.useRef({ value: initial }).current,
      useAnimatedStyle: callback => callback(), interpolateColor: () => '#111',
    },
    'phosphor-react-native': { Plus: 'Plus' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
    'expo-linking': { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    './components/Header': { __esModule: true, default: props => { headerRenders++; return React.createElement('Header', props); } },
    './components/WeekStrip': 'Weeks', './components/DayPager': React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ navigateToDate: (...args) => moves.push(args) }));
      return React.createElement('Pager', props);
    }), './components/DaySchedule': 'Day',
    './components/LessonViewer': 'Viewer', '../../components/ui/AppBlur': 'Blur',
    '../../components/CalendarSheet/CalendarSheet': { __esModule: true, default: () => { calendarRenders++; return React.createElement('Calendar'); } },
    '../../context/DayScheduleProvider': { DayScheduleProvider: 'DayProvider' },
    '../../context/NotificationDrawerContext': { useNotificationDrawer: () => ({ drawerProgress: shared }) },
    '../../context/ScheduleProvider': {
      useScheduleData: () => data, useScheduleActions: () => ({ setGlobalDraft }), useScheduleLayout: () => ({ tabBarHeight: 80 }),
    },
    '../../hooks/useNowTick': { NowTickProvider: ({ enabled, children }) => React.createElement('Clock', { enabled }, children) },
    '../../config/themes': { __esModule: true, default: { getColors: () => ({ backgroundColor: '#111', backgroundColor2: '#222' }) } },
    '../../utils/scheduleTime': { prepareScheduleDays: () => () => ({}), getScheduleDayLessons: () => [] },
    '../../utils/taskLessonLinking': {
      normalizeLessonRef: ref => ref,
      resolveOccurrenceFromLessonRef: (schedule, ref) => schedule.occurrences?.[ref.lessonIndex],
      createTaskDraftFromLesson: () => null,
    }, '../../utils/haptics': {}, '../../utils/i18n': { t: key => key },
    '../../config/layoutMetrics': { getScheduleHeaderHeight: () => 100 },
    './dayNavigation': { normalizeCalendarDate: date => new Date(date), getCalendarDayNumber: () => 1, getCalendarDayKey: date => date.toDateString() },
  };
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = name => { assert.ok(name in mocks, name); return mocks[name]; };
  loaded._compile(babel.transformFileSync(filename, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  }).code, filename);
  let tree;
  const element = () => React.createElement(loaded.exports.default, { navigation, route });
  await act(async () => { tree = create(element()); });
  t.after(async () => {
    await act(async () => tree.unmount());
    global.requestAnimationFrame = originalRequestFrame;
    global.cancelAnimationFrame = originalCancelFrame;
  });
  return {
    tree, data, selections, params, moves,
    counts: () => ({ headerRenders, calendarRenders }),
    focus: async value => { await act(async () => { focused = value; listeners.forEach(listener => listener()); }); },
    update: async changes => { Object.assign(data, changes); await act(async () => tree.update(element())); },
    intent: async value => { route = { params: { lessonViewIntent: value } }; await act(async () => tree.update(element())); },
    frame: async () => { const callbacks = [...frames.values()]; frames.clear(); await act(async () => callbacks.forEach(callback => callback())); },
    frames,
  };
}

test('tab focus updates the schedule clock without rendering the schedule header and calendar again', async t => {
  const screen = await mountSchedule(t);
  for (const value of [false, true, false, true]) {
    await screen.focus(value);
    assert.equal(screen.tree.root.findByType('Clock').props.enabled, value);
    assert.deepEqual(screen.counts(), { headerRenders: 1, calendarRenders: 1 });
  }
});

test('lesson navigation waits for data, switches schedules once and commits the day before presenting the viewer', async t => {
  const intent = { requestId: 'widget-1', scheduleId: 'widget-schedule', lessonRef: { scheduleId: 'widget-schedule', date: '2026-10-30', lessonIndex: 1 } };
  const screen = await mountSchedule(t, {}, intent);
  const viewer = () => screen.tree.root.findByType('Viewer').props;
  assert.equal(viewer().visible, false);
  assert.deepEqual(screen.params, [{ lessonViewIntent: undefined }]);
  const target = { id: 'widget-schedule', occurrences: [null, { subjectId: 'physics', lessonIndex: 1, lessonData: { room: '301' } }] };
  await screen.update({ schedule: { id: 'other' }, schedules: [{ id: 'other' }, target] });
  assert.deepEqual(screen.selections, [{ currentScheduleId: 'widget-schedule' }]);
  await screen.update({ schedule: { id: 'other' } });
  assert.equal(screen.selections.length, 1);
  await screen.update({ schedule: target });
  assert.equal(viewer().visible, false);
  assert.equal(viewer().lesson.subjectId, 'physics');
  assert.equal(viewer().lesson.index, 1);
  assert.equal(screen.tree.root.findByType('Header').props.currentDate.toDateString(), new Date(2026, 9, 30).toDateString());
  assert.equal(screen.tree.root.findByType('Pager').props.date.toDateString(), new Date(2026, 9, 30).toDateString());
  assert.equal(screen.moves[0][1].animated, false);
  await screen.frame();
  assert.equal(viewer().visible, true);
  await act(async () => viewer().onClose());
  await screen.intent({ ...intent, requestId: 'widget-2' });
  await screen.frame();
  assert.equal(viewer().visible, true, 'the same row can be opened again after closing the viewer');
});

test('a newer lesson request replaces an unpresented viewer and unmount cancels its frame', async t => {
  const schedule = { id: 'active', occurrences: [
    { subjectId: 'math', lessonIndex: 0 }, { subjectId: 'physics', lessonIndex: 1 },
  ] };
  const screen = await mountSchedule(t, { schedule, schedules: [schedule] });
  for (const lessonIndex of [0, 1]) {
    await screen.intent({ requestId: `request-${lessonIndex}`, scheduleId: 'active', lessonRef: { date: '2026-10-30', lessonIndex } });
  }
  assert.equal(screen.frames.size, 1);
  assert.equal(screen.tree.root.findByType('Viewer').props.lesson.subjectId, 'physics');
  await act(async () => screen.tree.unmount());
  assert.equal(screen.frames.size, 0);
});

test('lesson navigation safely ignores removed schedules and missing lesson slots', async t => {
  const schedule = { id: 'active' };
  const screen = await mountSchedule(t, { schedule, schedules: [schedule] });
  for (const scheduleId of ['removed', 'active']) {
    await screen.intent({ requestId: scheduleId, scheduleId, lessonRef: { scheduleId, date: '2026-10-30', lessonIndex: 99 } });
    assert.equal(screen.tree.root.findByType('Viewer').props.visible, false);
  }
  assert.equal(screen.selections.length, 0);
});

async function mountNavigator(t, platform = 'android') {
  const filename = path.resolve(__dirname, '../src/navigation/TabNavigator.jsx');
  const data = { global: { theme: ['dark', 'cyan'] }, lang: 'uk', isLoading: false };
  const environment = {
    insets: { top: 24, bottom: 20, left: 0, right: 0 },
    colors: { backgroundColor: '#111', backgroundColorTabNavigator: '#222' },
  };
  const visibilityChanges = [];
  const animations = [];
  let inboxImports = 0, inboxMounts = 0;
  const Inbox = props => {
    const [identity] = React.useState(() => ++inboxMounts);
    return React.createElement('Inbox', { ...props, identity });
  };
  const onNotificationsVisibilityChange = value => visibilityChanges.push(value);
  const mocks = {
    react: React,
    '@react-navigation/bottom-tabs': { createBottomTabNavigator: () => ({ Navigator: 'Tabs', Screen: 'Tab' }) },
    '@react-navigation/bottom-tabs/unstable': { createNativeBottomTabNavigator: () => ({ Navigator: 'NativeTabs', Screen: 'NativeTab' }) },
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({ Navigator: 'Stack', Screen: 'StackScreen' }) },
    'react-native': {
      View: 'View', TouchableOpacity: 'Button', Platform: { OS: platform },
      StyleSheet: { create: value => value }, PanResponder: { create: handlers => ({ panHandlers: { onMoveShouldSetResponder: handlers.onMoveShouldSetPanResponder } }) },
      useWindowDimensions: () => ({ width: 360 }),
    },
    'phosphor-react-native': {},
    'react-native-safe-area-context': { useSafeAreaInsets: () => environment.insets },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: initial => React.useRef({ value: initial }).current,
      useAnimatedStyle: callback => callback(), interpolate: () => 0,
      Easing: { bezier: () => value => value },
      cancelAnimation() {},
      withTiming: (value, options, complete) => {
        animations.push({ value, complete });
        return value;
      },
      runOnJS: callback => callback,
    },
    '../config/themes': { __esModule: true, default: { getColors: () => environment.colors } },
    '../context/ScheduleProvider': {
      useScheduleData: () => data, useScheduleLayout: () => ({ tabBarHeight: 80, setTabBarHeight() {} }),
    },
    '../context/NotificationDrawerContext': { NotificationDrawerProvider: 'Drawer' },
    '../components/ui/MorphingLoader': 'Loader', './PlanItTabBar': 'Bar',
    './navigationMetrics': { resolveNavigationStyle: () => 'classic', LIQUID_GLASS_NAVIGATION_STYLE: 'liquid-glass' },
    '../utils/i18n': { t: key => key }, '../utils/haptics': { triggerHaptic() {} },
    '../pages/Schedule/Schedule': 'Schedule',
    '../pages/Schedule/components/NotificationInboxPanel': { __esModule: true, default: Inbox },
    '../hooks/useReducedMotionPreference': { __esModule: true, default: () => false },
  };
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.require = name => {
    assert.ok(name in mocks, name);
    if (name === '../pages/Schedule/components/NotificationInboxPanel') inboxImports++;
    return mocks[name];
  };
  loaded._compile(babel.transformFileSync(filename, {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', '@babel/plugin-transform-react-jsx'],
  }).code, filename);
  const element = () => React.createElement(loaded.exports.default, { screenProps: {}, onNotificationsVisibilityChange });
  let tabs;
  await act(async () => { tabs = create(element()); });
  t.after(async () => act(async () => tabs.unmount()));
  return {
    tabs,
    visibilityChanges,
    animations,
    inboxCounts: () => ({ imports: inboxImports, mounts: inboxMounts }),
    async update(next) {
      Object.assign(environment, next);
      await act(async () => tabs.update(element()));
    },
  };
}

test('widget and schedule entry defer the inbox until first use and retain it across drawer closes', async t => {
  const { tabs, inboxCounts, animations } = await mountNavigator(t);
  const drawer = () => tabs.root.findByType('Drawer').props.value;
  const responders = () => tabs.root.findAllByType('View').filter(view => view.props.onMoveShouldSetResponder);
  assert.deepEqual(inboxCounts(), { imports: 0, mounts: 0 });
  assert.equal(tabs.root.findAllByType('Inbox').length, 0);
  assert.equal(responders().length, 0);
  await act(async () => drawer().openNotifications());
  const identity = tabs.root.findByType('Inbox').props.identity;
  assert.equal(inboxCounts().mounts, 1);
  assert.ok(inboxCounts().imports > 0);
  assert.equal(responders().length, 1);
  await act(async () => drawer().closeNotifications());
  assert.equal(tabs.root.findByType('Inbox').props.identity, identity, 'closing animation retains its content');
  assert.equal(responders().length, 0, 'hidden content must not intercept schedule gestures');
  await act(async () => animations.at(-1).complete(true));
  await act(async () => drawer().openNotifications());
  assert.equal(tabs.root.findByType('Inbox').props.identity, identity, 'reopening preserves scroll and expanded notification state');
  assert.equal(inboxCounts().mounts, 1);
});

test('notification drawer hides banners until its closing animation finishes, including interrupted closes', async t => {
  const { tabs, visibilityChanges, animations } = await mountNavigator(t);
  const drawer = () => tabs.root.findByType('Drawer').props.value;
  await act(async () => drawer().openNotifications());
  assert.deepEqual(visibilityChanges, [true]);
  await act(async () => animations.at(-1).complete(true));
  assert.deepEqual(visibilityChanges, [true]);
  await act(async () => drawer().closeNotifications());
  const closing = animations.at(-1);
  assert.deepEqual(visibilityChanges, [true]);
  await act(async () => drawer().openNotifications());
  await act(async () => closing.complete(false));
  assert.deepEqual(visibilityChanges, [true, true]);
  await act(async () => drawer().closeNotifications());
  await act(async () => animations.at(-1).complete(true));
  assert.deepEqual(visibilityChanges, [true, true, false]);
  await act(async () => tabs.unmount());
  assert.equal(visibilityChanges.at(-1), false);
});

test('hidden tabs detach without freezing while settings screens stay live under pushed pages', async t => {
  const { tabs } = await mountNavigator(t);
  const navigator = tabs.root.findByType('Tabs');
  assert.equal(navigator.props.detachInactiveScreens, true);
  assert.equal(navigator.props.screenOptions.freezeOnBlur, false);
  assert.equal(navigator.props.screenOptions.animation, 'none');
  const Settings = tabs.root.findAllByType('Tab').find(tab => tab.props.name === 'SettingsTab').props.component;
  let settings;
  await act(async () => { settings = create(React.createElement(Settings)); });
  t.after(async () => act(async () => settings.unmount()));
  assert.equal(settings.root.findByType('Stack').props.screenOptions.freezeOnBlur, false);
});

test('Android keeps system navigation covered outside the transformed shell as insets and themes change', async t => {
  const { tabs, update } = await mountNavigator(t);
  const flattenStyle = styles => Object.assign({}, ...styles.flat(Infinity).filter(Boolean));
  for (const bottom of [48, 24, 16.5, 0, 48]) {
    await update({ insets: { top: 24, bottom, left: 0, right: 0 } });
    const background = tabs.root.findByProps({ testID: 'system-navigation-background' });
    const style = flattenStyle(background.props.style);
    assert.equal(style.height, bottom);
    assert.equal(style.bottom, 0);
    assert.equal(style.left, 0);
    assert.equal(style.right, 0);
    assert.equal(style.backgroundColor, '#222');
    assert.equal(background.props.pointerEvents, 'none');
    const shell = background.parent.findAllByType('AnimatedView')[0];
    assert.equal(shell.parent, background.parent, 'the system bar is a sibling of the animated shell');
    assert.ok(style.zIndex > flattenStyle(shell.props.style).zIndex);
  }
  await update({ colors: { backgroundColor: '#f2f4f7', backgroundColorTabNavigator: '#fff' } });
  assert.equal(flattenStyle(tabs.root.findByProps({ testID: 'system-navigation-background' }).props.style).backgroundColor, '#fff');
  await update({ colors: { backgroundColor: '#000', backgroundColorTabNavigator: '#000' } });
  assert.equal(flattenStyle(tabs.root.findByProps({ testID: 'system-navigation-background' }).props.style).backgroundColor, '#000');
});

for (const platform of ['ios', 'web']) {
  test(`${platform} retains its existing system navigation background`, async t => {
    const { tabs } = await mountNavigator(t, platform);
    assert.equal(tabs.root.findAllByProps({ testID: 'system-navigation-background' }).length, 0);
  });
}

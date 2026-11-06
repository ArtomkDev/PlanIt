const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const React = require('react');
const { act, create } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : originalRequire(name);
  mod._compile(babel.transformFileSync(filename).code, filename);
  return mod.exports;
}
const time = load('src/utils/scheduleTime.js');
const date = (day, hour = 0, minute = 0) => new Date(2026, 8, day, hour, minute);
const lesson = { subjectId: 'math', startTime: '09:00', endTime: '10:00' };
const fixture = () => ({
  id: 'schedule', repeat: 2, starting_week: date(21).toISOString(),
  start_time: '08:30', duration: 45, breaks: [10],
  schedule: Array.from({ length: 7 }, () => ({ week1: [], week2: [] })),
});

test('keeps today before, during, and between lessons; advances at the exact end', () => {
  const s = fixture();
  s.schedule[4].week1 = [lesson, { ...lesson, startTime: '12:00', endTime: '13:00' }];
  s.schedule[0].week2 = [lesson];
  for (const [hour, minute] of [[8, 0], [9, 30], [11, 0], [12, 59]]) {
    assert.equal(+time.getInitialScheduleDate(s, date(25, hour, minute)), +date(25));
  }
  assert.equal(+time.getInitialScheduleDate(s, date(25, 13)), +date(28));
});

test('skips weekends and empty weeks, including a full twelve-week cycle', () => {
  const s = fixture();
  s.schedule[0].week1 = [lesson];
  assert.equal(+time.getInitialScheduleDate(s, date(25, 18)), +date(35));
  s.repeat = 12;
  s.schedule[0].week12 = [lesson];
  s.schedule[0].week1 = [];
  const expected = date(21);
  expected.setDate(expected.getDate() + 77);
  assert.equal(+time.getInitialScheduleDate(s, date(21, 18)), +expected);
});

test('uses custom and slot times, ignores empty placeholders, handles overnight lessons', () => {
  const s = fixture();
  s.slotDurations = [45, 80];
  s.schedule[0].week1 = [null, { subjectId: 'math', timeMode: 'slot', slotNumber: 2 }];
  assert.equal(+time.getInitialScheduleDate(s, date(21, 10)), +date(21));
  assert.equal(+time.getInitialScheduleDate(s, date(21, 11)), +date(35));
  s.schedule[0].week1 = [{ ...lesson, startTime: '23:00', endTime: '00:30' }];
  assert.equal(+time.getInitialScheduleDate(s, date(21, 23, 59)), +date(21));
});

test('disabled and empty schedules fall back to today without mutating inputs', () => {
  const s = fixture();
  s.schedule[0].week2 = [lesson];
  const before = JSON.stringify(s), now = date(25, 18);
  assert.equal(+time.getInitialScheduleDate(s, now, false), +date(25));
  assert.equal(+now, +date(25, 18));
  assert.equal(JSON.stringify(s), before);
  assert.equal(+time.getInitialScheduleDate(fixture(), now), +date(25));
});

test('calendar search keeps the correct week across daylight saving and year boundaries', () => {
  const s = fixture();
  s.starting_week = new Date(2026, 2, 23).toISOString();
  s.schedule[0].week2 = [lesson];
  assert.equal(+time.getInitialScheduleDate(s, new Date(2026, 2, 27, 18)), +new Date(2026, 2, 30));
  s.starting_week = new Date(2026, 11, 28).toISOString();
  assert.equal(+time.getInitialScheduleDate(s, new Date(2027, 0, 1, 18)), +new Date(2027, 0, 4));
});

test('startup mounts header and pager only after hydration, already on the chosen day', async t => {
  const RealDate = Date;
  t.mock.method(global, 'Date', class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [2026, 8, 25, 18])); }
  });
  const s = fixture();
  s.schedule[0].week2 = [lesson];
  let state = { isLoading: true, isDevicePrefsReady: false, schedule: null, global: {} };
  const seen = [], listeners = new Set();
  const mocks = {
    'react-native': { StyleSheet: { create: value => value }, View: 'View', TouchableOpacity: 'Button',
      AppState: { currentState: 'active', addEventListener: (_, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: value => React.useRef({ value }).current, useAnimatedStyle: () => ({}) },
    'phosphor-react-native': { Plus: 'Plus' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@react-navigation/native': { useIsFocused: () => true },
    'expo-linking': { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    '../../context/ScheduleProvider': { useScheduleData: () => state, useScheduleActions: () => ({}), useScheduleLayout: () => ({}) },
    '../../context/NotificationDrawerContext': { useNotificationDrawer: () => ({}) },
    '../../context/DayScheduleProvider': { DayScheduleProvider: ({ children }) => children },
    '../../hooks/useNowTick': { NowTickProvider: ({ children }) => children },
    '../../config/themes': { __esModule: true, default: { getColors: () => ({}) } },
    '../../utils/scheduleTime': time,
    '../../utils/taskLessonLinking': {},
    '../../utils/haptics': { triggerHaptic() {} },
    '../../utils/i18n': { t: key => key },
    './components/Header': props => { seen.push(+props.currentDate); return React.createElement('Header', props); },
    './components/DayPager': props => React.createElement('Pager', props),
  };
  for (const name of ['./components/WeekStrip', './components/DaySchedule', './components/LessonViewer', '../../components/CalendarSheet/CalendarSheet', '../../components/ui/AppBlur']) mocks[name] = () => null;
  const Schedule = load('src/pages/Schedule/Schedule.jsx', mocks).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Schedule)); });
  t.after(async () => act(async () => tree.unmount()));
  assert.deepEqual(seen, []);
  state = { ...state, isDevicePrefsReady: true };
  await act(async () => tree.update(React.createElement(Schedule)));
  assert.deepEqual(seen, []);
  state = { ...state, isLoading: false, schedule: s };
  await act(async () => tree.update(React.createElement(Schedule)));
  assert.ok(seen.length > 0);
  assert.ok(seen.every(value => value === +date(28)));
  assert.equal(+tree.root.findByType('Pager').props.date, +date(28));
  await act(async () => tree.root.findByType('Pager').props.onDateChange(date(29)));
  state = { ...state, schedule: { ...s, name: 'Synced' } };
  await act(async () => tree.update(React.createElement(Schedule)));
  assert.equal(+tree.root.findByType('Pager').props.date, +date(29), 'sync must preserve manual navigation');
  await act(async () => { for (const fn of listeners) { fn('background'); fn('active'); } });
  assert.equal(+tree.root.findByType('Pager').props.date, +date(28));
  state = { ...state, global: { autoSelectLessonDay: false } };
  await act(async () => tree.update(React.createElement(Schedule)));
  await act(async () => tree.root.findByType('Pager').props.onDateChange(date(29)));
  await act(async () => { for (const fn of listeners) { fn('background'); fn('active'); } });
  assert.equal(+tree.root.findByType('Pager').props.date, +date(29));
  await act(async () => tree.unmount());
  seen.length = 0;
  await act(async () => { tree = create(React.createElement(Schedule)); });
  assert.ok(seen.every(value => value === +date(25)), 'disabled startup opens today immediately');
});

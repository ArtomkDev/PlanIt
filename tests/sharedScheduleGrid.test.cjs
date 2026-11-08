const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith('.')) return original(name);
    const target = path.resolve(path.dirname(filename), name);
    const resolved = [target, target + '.js', target + '.jsx', target + '.json'].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (resolved.endsWith('.json')) return original(name);
    return load(path.relative(path.resolve(__dirname, '..'), resolved), mocks);
  };
  if (!compiled.has(filename)) compiled.set(filename, babel.transformFileSync(filename).code);
  mod._compile(compiled.get(filename), filename);
  return mod.exports;
}
const model = load('src/components/schedule/sharedSchedulePreviewModel.js');
const { buildScheduleExport } = load('src/utils/scheduleExport.js');
const date = (day, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute);
const slot = number => ({ subjectId: 'math', timeMode: 'slot', slotNumber: number });
const nextOf = (schedule, now) => {
  const { next } = model.getSharedSchedulePreviewLiveLessons(schedule, buildScheduleExport(schedule, 'en'), now);
  return next && { week: next.week, day: next.day, date: next.date };
};
const fixture = () => {
  const schedule = { name: 'University', repeat: 2, starting_week: date(2).toISOString(),
    start_time: '08:30', duration: 80, slotDurations: [80, 80, 80, 80], breaks: [10, 20, 10],
    subjects: [{ id: 'math', name: 'Math' }], schedule: Array.from({ length: 7 }, () => ({ week1: [], week2: [] })) };
  schedule.schedule[1].week1 = [slot(1), slot(2), slot(3), slot(4)];
  schedule.schedule[3].week1 = [slot(4)];
  schedule.schedule[0].week2 = [slot(2)];
  return schedule;
};

test('a lone fourth lesson stays in the fourth row with the first three cells empty', () => {
  const schedule = fixture();
  const before = JSON.stringify(schedule);
  const week = buildScheduleExport(schedule, 'en').weeks[0];
  const rows = model.getSharedSchedulePreviewRows(schedule, week);
  const thursday = week.days.findIndex(day => day.index === 3);
  assert.deepEqual(rows.map(row => row.number), [1, 2, 3, 4]);
  assert.deepEqual(rows.map(row => row.cells[thursday].length), [0, 0, 0, 1]);
  assert.equal(rows[3].start, '13:10');
  assert.equal(rows[3].end, '14:30');
  assert.equal(rows[3].cells[thursday][0].number, 4);
  assert.equal(JSON.stringify(schedule), before);
});

test('empty leading slots are retained even when no day has an earlier occupied slot', () => {
  const schedule = fixture();
  schedule.schedule[1].week1 = [];
  const week = buildScheduleExport(schedule, 'en').weeks[0];
  const rows = model.getSharedSchedulePreviewRows(schedule, week);
  assert.equal(rows.length, 4);
  assert.ok(rows.slice(0, 3).every(row => row.cells.every(cell => cell.length === 0)));
});

test('custom times keep their real time and do not acquire a false lesson number', () => {
  const schedule = fixture();
  schedule.schedule[3].week1 = [{ subjectId: 'math', timeMode: 'custom', startTime: '12:10', endTime: '12:50' }];
  const week = buildScheduleExport(schedule, 'en').weeks[0];
  const rows = model.getSharedSchedulePreviewRows(schedule, week);
  const custom = rows.find(row => row.start === '12:10');
  assert.equal(custom.number, null);
  assert.equal(custom.cells.find(cell => cell.length)?.[0].number, null);
  assert.deepEqual(rows.map(row => row.start), ['08:30', '10:00', '11:40', '12:10', '13:10']);
});

test('legacy empty positions and overlapping lessons in one slot remain intact', () => {
  const schedule = fixture();
  schedule.schedule[3].week1 = [null, null, null, 'math'];
  schedule.schedule[1].week1.push(slot(4));
  const week = buildScheduleExport(schedule, 'en').weeks[0];
  const rows = model.getSharedSchedulePreviewRows(schedule, week);
  assert.equal(rows[3].cells[week.days.findIndex(day => day.index === 3)][0].number, 4);
  assert.equal(rows[3].cells[week.days.findIndex(day => day.index === 1)].length, 2);
  assert.deepEqual(model.getSharedSchedulePreviewRows(schedule, { days: [{ lessons: [] }] }), []);
});

test('auto selection retains a week before and during its last lesson and advances at its exact end', () => {
  const schedule = fixture();
  for (const now of [date(5, 12), date(5, 14, 29)]) {
    const selected = model.getSharedSchedulePreviewSelection(schedule, now);
    assert.equal(selected.week, '1');
    assert.equal(selected.day, 3);
  }
  const next = model.getSharedSchedulePreviewSelection(schedule, date(5, 14, 30));
  assert.equal(next.week, '2');
  assert.equal(next.day, 0);
  assert.equal(+next.date, +date(9));
});

test('later weekend lessons prevent an early week switch and an empty next week is shown, not skipped', () => {
  const schedule = fixture();
  schedule.schedule[6].week1 = [slot(1)];
  const sunday = model.getSharedSchedulePreviewSelection(schedule, date(6, 18));
  assert.equal(sunday.week, '1');
  assert.equal(sunday.day, 6);
  assert.deepEqual(nextOf(schedule, date(6, 18)), { week: '1', day: 6, date: date(8) });
  schedule.schedule[6].week1 = [];
  schedule.schedule[0].week2 = [];
  const emptyWeek = model.getSharedSchedulePreviewSelection(schedule, date(6, 18));
  assert.equal(emptyWeek.week, '2');
  assert.equal(+emptyWeek.date, +date(9));
  assert.deepEqual(nextOf(schedule, date(6, 18)), { week: '1', day: 1, date: date(17) });
});

test('lessons on Saturday and Sunday get their own columns, day tabs and automatic selection', async t => {
  const schedule = fixture();
  schedule.schedule[5].week1 = [slot(1)];
  schedule.schedule[6].week1 = [slot(2)];
  const saturday = model.getSharedSchedulePreviewSelection(schedule, date(7, 7));
  assert.deepEqual([saturday.week, saturday.day], ['1', 5]);
  const sunday = model.getSharedSchedulePreviewSelection(schedule, date(7, 18));
  assert.deepEqual([sunday.week, sunday.day], ['1', 6]);
  const desktop = await mountPreview(t, schedule);
  await act(async () => desktop.tree.root.findAllByType('View').find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 1280 } } }));
  const headers = desktop.tree.root.findAllByType('View').filter(node => node.props.accessibilityRole === 'columnheader')
    .map(node => (node.findAll(child => child.props.accessibilityRole === 'header')[0] || node.findAllByType('Text')[0]).props.children);
  assert.deepEqual(headers, ['Time', 'Monday', 'Tuesday', 'Thursday', 'Saturday', 'Sunday']);
  const mobile = await mountPreview(t, schedule);
  const dayTabs = mobile.tree.root.findAllByType('Button').filter(node => node.props.onLayout).map(node => node.findByType('Text').props.children);
  assert.deepEqual(dayTabs, ['Monday', 'Tuesday', 'Thursday', 'Saturday', 'Sunday']);
});

test('the last cycle week wraps around and empty weeks of a twelve-week cycle stay selected', () => {
  const schedule = fixture();
  const nextCycle = model.getSharedSchedulePreviewSelection(schedule, date(9, 11, 20));
  assert.equal(nextCycle.week, '1');
  assert.equal(+nextCycle.date, +date(17));
  schedule.repeat = 12;
  schedule.schedule.forEach(day => { day.week1 = []; day.week2 = []; });
  schedule.schedule[0].week12 = [slot(1)];
  const current = model.getSharedSchedulePreviewSelection(schedule, date(4, 18));
  assert.deepEqual([current.week, +current.date], ['1', +date(4)]);
  assert.deepEqual(nextOf(schedule, date(4, 18)), { week: '12', day: 0, date: new Date(2027, 0, 18) });
  assert.equal(model.getSharedSchedulePreviewSelection(schedule, new Date(2027, 0, 18, 7)).week, '12');
  schedule.schedule[0].week12 = [];
  assert.equal(nextOf(schedule, date(4, 18)), null);
});

test('an overnight Sunday lesson keeps its original week until it ends on Monday', () => {
  const schedule = fixture();
  schedule.schedule[6].week1 = [{ subjectId: 'math', timeMode: 'custom', startTime: '23:00', endTime: '00:30' }];
  const during = model.getSharedSchedulePreviewSelection(schedule, date(9, 0, 15));
  assert.equal(during.week, '1');
  assert.equal(during.day, 6);
  assert.equal(model.getSharedSchedulePreviewRefreshAt(schedule, date(9, 0, 15)), +date(9, 0, 30));
  assert.equal(model.getSharedSchedulePreviewSelection(schedule, date(9, 0, 30)).week, '2');
});

test('empty schedules fall back to today and refresh uses local calendar midnight', () => {
  const schedule = fixture();
  schedule.schedule.forEach(day => { day.week1 = []; day.week2 = []; });
  const now = date(6, 18);
  assert.equal(+model.getSharedSchedulePreviewSelection(schedule, now).date, +date(6));
  assert.equal(model.getSharedSchedulePreviewRefreshAt(schedule, now), +date(7));
  assert.equal(+now, +date(6, 18));
});

test('auto selection respects calendar dates across daylight saving and year boundaries', () => {
  const schedule = fixture();
  schedule.starting_week = new Date(2026, 2, 23).toISOString();
  assert.equal(+model.getSharedSchedulePreviewSelection(schedule, new Date(2026, 2, 27, 18)).date, +new Date(2026, 2, 30));
  schedule.starting_week = new Date(2026, 11, 28).toISOString();
  assert.equal(+model.getSharedSchedulePreviewSelection(schedule, new Date(2027, 0, 1, 18)).date, +new Date(2027, 0, 4));
});

async function mountPreview(t, schedule) {
  const appListeners = new Set();
  const Component = load('src/components/schedule/SharedSchedulePreview.jsx', {
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'Scroll', TouchableOpacity: 'Button', Pressable: 'WeekButton', Platform: { OS: 'web' },
      StyleSheet: { create: value => value, hairlineWidth: 1 }, Linking: {},
      AppState: { addEventListener: (_type, listener) => { appListeners.add(listener); return { remove: () => appListeners.delete(listener) }; } } },
    'phosphor-react-native': new Proxy({}, { get: (_target, name) => name }),
  }).default;
  let tree;
  await act(async () => { tree = create(React.createElement(Component, { schedule, lang: 'en', themeColors: {} })); });
  t.after(async () => act(async () => tree.unmount()));
  const weekName = node => node.props.accessibilityLabel.split(',')[0];
  return { tree, appListeners,
    selectedWeek: () => weekName(tree.root.findAllByType('WeekButton').find(node => node.props.accessibilityState.selected)),
    pickWeek: number => tree.root.findAllByType('WeekButton').find(node => weekName(node) === 'Week ' + number).props.onPress(),
    auto: () => tree.root.findAllByType('Button').find(node => node.props.accessibilityLabel === 'Auto select') };
}

test('the desktop preview renders aligned rows with accessible empty Thursday cells and visible lesson numbers', async t => {
  const screen = await mountPreview(t, fixture());
  await act(async () => screen.pickWeek(1));
  await act(async () => screen.tree.root.findAllByType('View').find(node => node.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 1280 } } }));
  const rows = screen.tree.root.findAllByType('View').filter(node => node.props.accessibilityRole === 'row');
  assert.equal(rows.length, 5);
  const emptyThursday = screen.tree.root.findAllByType('View').filter(node => /^Thursday,.*Free$/.test(node.props.accessibilityLabel || ''));
  assert.equal(emptyThursday.length, 3);
  assert.ok(rows[4].findAllByType('Text').some(node => node.props.children === 'Class 4'));
  assert.equal(rows[1].findAllByType('Button').some(node => /13:10/.test(node.props.accessibilityLabel || '')), false);
  assert.equal(rows[4].findAllByType('Button').filter(node => /13:10/.test(node.props.accessibilityLabel || '')).length, 2);
});

test('automatic selection updates at the final lesson end, preserves manual browsing and can be restored', async t => {
  const RealDate = Date;
  let current = new RealDate(2026, 10, 5, 14, 29).getTime(), boundary;
  t.mock.method(global, 'Date', class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [current])); }
    static now() { return current; }
  });
  const nativeSetTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (callback, delay, ...args) => {
    if (delay === 60000) { boundary = callback; return 123; }
    return nativeSetTimeout(callback, delay, ...args);
  });
  const screen = await mountPreview(t, fixture());
  assert.equal(screen.selectedWeek(), 'Week 1');
  current = new RealDate(2026, 10, 5, 14, 30).getTime();
  await act(async () => boundary());
  assert.equal(screen.selectedWeek(), 'Week 2');
  await act(async () => screen.pickWeek(1));
  assert.equal(screen.auto().props.accessibilityState.selected, false);
  await act(async () => screen.appListeners.forEach(listener => listener('active')));
  assert.equal(screen.selectedWeek(), 'Week 1');
  await act(async () => screen.auto().props.onPress());
  assert.equal(screen.selectedWeek(), 'Week 2');
  assert.equal(screen.auto().props.accessibilityState.selected, true);
});

test('the live model finds the class in progress, the next one today and an overnight class from yesterday', () => {
  const schedule = fixture();
  const document = buildScheduleExport(schedule, 'en');
  const during = model.getSharedSchedulePreviewLiveLessons(schedule, document, date(3, 9));
  assert.deepEqual([during.current.week, during.current.day, during.current.lesson.start, during.current.lesson.end], ['1', 1, '08:30', '09:50']);
  assert.deepEqual([during.next.day, during.next.lesson.start, +during.next.date], [1, '10:00', +date(3)]);
  const tuesday = document.weeks[0].days.find(day => day.index === 1);
  assert.equal(during.current.lesson, tuesday.lessons[0]);
  const breakTime = model.getSharedSchedulePreviewLiveLessons(schedule, document, date(3, 9, 55));
  assert.equal(breakTime.current, null);
  assert.equal(breakTime.next.lesson.start, '10:00');
  schedule.schedule[6].week1 = [{ subjectId: 'math', timeMode: 'custom', startTime: '23:00', endTime: '00:30' }];
  const overnight = model.getSharedSchedulePreviewLiveLessons(schedule, buildScheduleExport(schedule, 'en'), date(9, 0, 15));
  assert.deepEqual([overnight.current.week, overnight.current.day, +overnight.current.end], ['1', 6, +date(9, 0, 30)]);
});

test('the preview marks the class in progress, the next class and today', async t => {
  const RealDate = Date;
  const current = new RealDate(2026, 10, 3, 9).getTime();
  t.mock.method(global, 'Date', class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [current])); }
    static now() { return current; }
  });
  const screen = await mountPreview(t, fixture());
  const buttons = () => screen.tree.root.findAllByType('Button');
  const status = screen.tree.root.findAll(node => /^Now, Math, /.test(node.props.accessibilityLabel || ''))[0];
  assert.equal(status.props.accessibilityLabel, 'Now, Math, 08:30 – 09:50 · 50 min left, Then Math at 10:00');
  assert.ok(buttons().some(node => (node.props.accessibilityLabel || '').startsWith('Now · 50 min left, Class 1, 08:30 – 09:50')));
  assert.ok(buttons().some(node => (node.props.accessibilityLabel || '').startsWith('Next, Class 2, 10:00 – 11:20')));
  assert.ok(buttons().some(node => node.props.accessibilityLabel === 'Tuesday, Today'));
});

test('the live status shows the single subject icon of the class in progress', async t => {
  const RealDate = Date;
  const current = new RealDate(2026, 10, 3, 9).getTime();
  t.mock.method(global, 'Date', class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [current])); }
    static now() { return current; }
  });
  const schedule = fixture();
  schedule.subjects[0].icon = 'math';
  const screen = await mountPreview(t, schedule);
  const status = screen.tree.root.findAll(node => /^Now, Math, /.test(node.props.accessibilityLabel || ''))[0];
  assert.equal(status.findAllByType('Sigma').length, 1);
});

test('the page widens one column at a time for weekend days and keeps the site width otherwise', () => {
  const schedule = fixture();
  assert.equal(model.getSharedSchedulePreviewPageWidth(schedule), 1280);
  schedule.schedule[5].week1 = [slot(1)];
  schedule.schedule[6].week2 = [slot(1)];
  schedule.schedule[2].week1 = [slot(1)];
  schedule.schedule[4].week1 = [slot(1)];
  assert.equal(model.getSharedSchedulePreviewPageWidth(schedule), 1680);
  schedule.schedule.forEach(day => { day.week1 = []; day.week2 = []; });
  assert.equal(model.getSharedSchedulePreviewPageWidth(schedule), 1280);
});

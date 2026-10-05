const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = request => request.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), path.extname(request) ? request : request + '.js')))
    : originalRequire(request);
  mod._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code, filename);
  return mod.exports;
}
const time = load('src/utils/scheduleTime.js');
const { deleteScheduleLesson } = load('src/utils/scheduleDeletion.js');
const { applyLessonRecurrence } = load('src/utils/lessonRecurrence.js');
const { parseRealSchedule } = load('src/widgets/scheduleCore.js');
const slot = number => ({ subjectId: 'math', timeMode: 'slot', slotNumber: number });
const schedule = lessons => ({
  id: 's', repeat: 2, start_time: '08:30', duration: 80, breaks: [10, 20],
  starting_week: '2026-09-21T00:00:00', subjects: [{ id: 'math', name: 'Math' }],
  schedule: [{ week1: lessons, week2: lessons }],
});
const times = (s, lessons = s.schedule[0].week1) => time.buildLessonTimes(s.start_time, s.duration, s.breaks, lessons);

test('occupied slot preview excludes the edited series and detects custom overlaps in selected weeks', () => {
  const s = schedule([slot(1), { subjectId: 'other', timeMode: 'custom', startTime: '10:05', endTime: '10:40' }]);
  const before = JSON.stringify(s);
  const options = { dayIndex: 0, weekNumber: 1, lessonIndex: 0, lesson: slot(2), selection: { mode: 'all' }, previousSelection: { mode: 'all' }, swapTiming: slot(1), preview: true };
  const result = applyLessonRecurrence(s, options);
  assert.deepEqual(result.conflicts.map(item => item.week), [1, 2]);
  assert.equal(result.canSwap, true);
  assert.equal(applyLessonRecurrence(s, { ...options, lesson: slot(1) }).conflicts.length, 0);
  assert.equal(JSON.stringify(s), before);
});

test('swapping retains lesson metadata and task references while replacing detaches only removed lessons', () => {
  const s = schedule([slot(1), { ...slot(2), subjectId: 'other', room: '42', attachments: [{ fileId: 'f' }] }]);
  s.tasks = [0, 1].map(index => ({ id: String(index), lessonRef: { scheduleId: 's', dayIndex: 0, weekKey: 'week1', lessonIndex: index } }));
  const options = { dayIndex: 0, weekNumber: 1, lessonIndex: 0, lesson: slot(2), selection: { mode: 'selected', weeks: [1] }, previousSelection: { mode: 'selected', weeks: [1] }, swapTiming: slot(1) };
  const swapped = applyLessonRecurrence(s, { ...options, conflictAction: 'swap' });
  assert.deepEqual(swapped.schedule[0].week1.map(item => [item.subjectId, item.slotNumber]), [['other', 1], ['math', 2]]);
  assert.equal(swapped.schedule[0].week1[0].room, '42');
  assert.deepEqual(swapped.schedule[0].week1[0].attachments, [{ fileId: 'f' }]);
  assert.deepEqual(swapped.tasks.map(task => task.lessonRef.lessonIndex), [1, 0]);
  assert.deepEqual(swapped.schedule[0].week2.map(item => item.slotNumber), [1, 2]);
  const replaced = applyLessonRecurrence(s, { ...options, conflictAction: 'replace' });
  assert.equal(replaced.schedule[0].week1.length, 1);
  assert.equal(replaced.schedule[0].week1[0].slotNumber, 2);
  assert.ok(replaced.tasks[0].lessonRef);
  assert.equal(replaced.tasks[1].lessonRef, undefined);
  assert.equal(s.schedule[0].week1.length, 2);
});

test('new sessions can swap into their initially free time but multiple overlaps cannot swap', () => {
  const s = schedule([slot(2)]);
  const options = { dayIndex: 0, weekNumber: 1, lessonIndex: null, lesson: { ...slot(2), subjectId: 'new' }, selection: { mode: 'selected', weeks: [1] }, swapTiming: slot(1) };
  assert.equal(applyLessonRecurrence(s, { ...options, preview: true }).canSwap, true);
  assert.deepEqual(applyLessonRecurrence(s, { ...options, conflictAction: 'swap' }).schedule[0].week1.map(item => [item.subjectId, item.slotNumber]), [['math', 1], ['new', 2]]);
  const blocked = schedule([slot(2), { subjectId: 'other', timeMode: 'custom', startTime: '10:10', endTime: '10:20' }]);
  assert.equal(applyLessonRecurrence(blocked, { ...options, preview: true }).canSwap, false);
  assert.equal(applyLessonRecurrence(blocked, { ...options, conflictAction: 'swap' }), blocked);
  assert.equal(applyLessonRecurrence(blocked, { ...options, conflictAction: 'replace' }).schedule[0].week1.length, 1);
  assert.equal(applyLessonRecurrence(schedule([slot(1), slot(2)]), { ...options, preview: true }).canSwap, false);
});

test('third period retains its number and exposes the entire free morning', () => {
  const s = schedule([slot(3)]);
  const timeline = time.buildDayTimeline(s, s.schedule[0].week1);
  assert.deepEqual(timeline[0], { type: 'free', start: '08:30', end: '11:40', duration: 190, missingSlots: [1, 2] });
  assert.equal(timeline[1].lesson.slotNumber, 3);
  assert.deepEqual(timeline[1].lesson.timeInfo, { start: '11:40', end: '13:00' });
  assert.equal(timeline[1].lesson.index, 0);
});

test('mixed custom and numbered lessons stay chronological without numbering custom times', () => {
  const lessons = [
    { subjectId: 'math', timeMode: 'custom', startTime: '23:01', endTime: '23:57' },
    slot(8),
    { subjectId: 'math', timeMode: 'custom', slotNumber: 3, startTime: '21:02', endTime: '22:22' },
    slot(1),
  ];
  const cards = time.buildDayTimeline(schedule(lessons), lessons)
    .filter(item => item.type === 'lesson').map(item => item.lesson);
  assert.deepEqual(cards.map(card => card.index), [3, 1, 2, 0]);
  assert.deepEqual(cards.map(card => card.slotNumber), [1, 8, null, null]);
  assert.deepEqual(cards.map(card => card.timeInfo.start), ['08:30', '19:30', '21:02', '23:01']);
});

test('legacy null slots and explicit third-period times resolve identically', () => {
  const s = schedule([]);
  const sparse = time.buildDayTimeline(s, [null, null, 'math']);
  const explicit = time.buildDayTimeline(s, [{ subjectId: 'math', startTime: '11:40', endTime: '13:00' }]);
  assert.deepEqual(sparse[0], explicit[0]);
  assert.equal(sparse[1].lesson.slotNumber, 3);
  assert.equal(explicit[1].lesson.slotNumber, 3);
});

test('deleting a legacy first lesson preserves following times and task references', () => {
  const s = { ...schedule(['math', 'math', 'math']), tasks: [{ id: 't', lessonRef: { scheduleId: 's', dayIndex: 0, weekKey: 'week1', lessonIndex: 2 } }] };
  const result = deleteScheduleLesson(s, 0, 'week1', 0);
  assert.deepEqual(times(result), times(s).slice(1));
  assert.deepEqual(result.schedule[0].week1.map(x => x.slotNumber), [2, 3]);
  assert.equal(result.tasks[0].lessonRef.lessonIndex, 1);
  assert.deepEqual(s.schedule[0].week1, ['math', 'math', 'math']);
});

test('slot times follow timetable settings while custom times stay fixed', () => {
  const s = time.normalizeScheduleTiming(schedule([slot(3), { subjectId: 'math', timeMode: 'custom', startTime: '15:00', endTime: '15:40' }]));
  const changed = { ...s, start_time: '09:00', duration: 45 };
  assert.deepEqual(times(changed), [{ start: '11:00', end: '11:45' }, { start: '15:00', end: '15:40' }]);
  assert.deepEqual(time.normalizeScheduleTiming(s), s);
});

test('timeline distinguishes normal breaks, free periods, and custom times', () => {
  const s = schedule([slot(1), slot(2), slot(4), { subjectId: 'math', timeMode: 'custom', startTime: '15:00', endTime: '15:20' }]);
  const timeline = time.buildDayTimeline(s, s.schedule[0].week1);
  assert.equal(timeline[1].type, 'break');
  assert.equal(timeline[1].duration, 10);
  assert.equal(timeline[3].type, 'free');
  assert.deepEqual(timeline[3].missingSlots, [3]);
  assert.equal(timeline.at(-1).lesson.slotNumber, null);
});

test('overlapping custom lessons do not produce negative gaps or renumber cards', () => {
  const s = schedule([{ subjectId: 'math', timeMode: 'custom', startTime: '09:00', endTime: '11:00' },
    { subjectId: 'math', timeMode: 'custom', startTime: '10:00', endTime: '10:30' }, slot(3)]);
  const timeline = time.buildDayTimeline(s, s.schedule[0].week1);
  assert.deepEqual(timeline.filter(x => x.type !== 'lesson').map(x => [x.start, x.end]), [['08:30', '09:00'], ['11:00', '11:40']]);
});

test('repeated slot lessons and notifications use the same resolved time', () => {
  const s = schedule([]);
  const result = applyLessonRecurrence(s, { dayIndex: 0, weekNumber: 1, lessonIndex: null, lesson: slot(3), selection: { mode: 'all' } });
  assert.equal(result.schedule[0].week2[0].slotNumber, 3);
  const occurrences = time.buildLessonOccurrences(result, { from: new Date(2026, 8, 21, 7), horizonDays: 8 });
  assert.equal(occurrences.length, 2);
  assert.ok(occurrences.every(x => x.timeInfo.start === '11:40'));
});

test('widget numbers and deep-link indices stay independent of chronological order', () => {
  const s = schedule([slot(4), slot(3)]);
  const date = new Date(2026, 8, 21, 12);
  const lessons = parseRealSchedule(s, date, 0, date).items.filter(x => x.type === 'lesson');
  assert.deepEqual(lessons.map(x => [x.slotNumber, x.lessonIndex, x.startTime]), [[3, 1, '11:40'], [4, 0, '13:10']]);
});

test('empty days stay empty and generated slots never wrap into another day', () => {
  assert.deepEqual(time.buildDayTimeline(schedule([]), []), []);
  assert.deepEqual(time.buildScheduleSlots('23:00', 80, [10]), []);
  assert.deepEqual(time.buildScheduleSlots('bad', 45, [10]), []);
});

test('a limited occurrence query returns the earliest period regardless of storage order', () => {
  const s = schedule([slot(4), slot(3)]);
  const result = time.buildLessonOccurrences(s, { from: new Date(2026, 8, 21, 7), maxOccurrences: 1 });
  assert.equal(result[0].timeInfo.start, '11:40');
  assert.equal(result[0].lessonIndex, 1);
});

test('widget shows free morning before the third period and hides it after it ends', () => {
  const s = schedule([slot(3)]);
  const morning = new Date(2026, 8, 21, 9);
  const during = new Date(2026, 8, 21, 12);
  const free = parseRealSchedule(s, morning, 0, morning).items[0];
  assert.equal(free.isFree, true);
  assert.equal(free.startTime, '08:30');
  assert.equal(free.endTime, '11:40');
  assert.equal(parseRealSchedule(s, during, 0, during).items[0].slotNumber, 3);
});

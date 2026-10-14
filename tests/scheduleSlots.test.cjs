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
const times = (s, lessons = s.schedule[0].week1) => time.buildLessonTimes(s.start_time, s.duration, s.breaks, lessons, s.slotDurations);

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

const flexibleSchedule = lessons => ({ ...schedule(lessons), duration: 45, slotDurations: [45, 60, 80], breaks: [0, 20] });
const slotsFor = s => time.buildScheduleSlots(s.start_time, s.duration, s.breaks, s.slotDurations);

test('individual durations resolve numbered and legacy positional lessons without cycling the template', () => {
  const s = flexibleSchedule([slot(3), slot(1), slot(2)]);
  assert.deepEqual(slotsFor(s), [
    { number: 1, start: '08:30', end: '09:15' },
    { number: 2, start: '09:15', end: '10:15' },
    { number: 3, start: '10:35', end: '11:55' },
  ]);
  const legacy = time.materializeScheduleLessons(s, [null, 'math', 'math']);
  assert.deepEqual(legacy.slice(1).map(lesson => lesson.slotNumber), [2, 3]);
  assert.deepEqual(times(s), [{ start: '10:35', end: '11:55' }, { start: '08:30', end: '09:15' }, { start: '09:15', end: '10:15' }]);
});

test('changing a lesson end adjusts its duration and moves later lessons while retaining their breaks', () => {
  const s = flexibleSchedule([slot(1), slot(2), slot(3)]);
  const before = JSON.stringify(s);
  const changed = time.updateScheduleSlotTime(s, 1, 'end', '10:30');
  assert.deepEqual(changed.slotDurations, [45, 75, 80]);
  assert.deepEqual(changed.breaks, [0, 20]);
  assert.deepEqual(times(changed), [{ start: '08:30', end: '09:15' }, { start: '09:15', end: '10:30' }, { start: '10:50', end: '12:10' }]);
  assert.equal(JSON.stringify(s), before);
});

test('changing an intermediate start derives the preceding break and preserves lesson lengths', () => {
  const s = flexibleSchedule([slot(1), slot(2), slot(3)]);
  const changed = time.updateScheduleSlotTime(s, 1, 'start', '09:25');
  assert.deepEqual(changed.breaks, [10, 20]);
  assert.deepEqual(changed.slotDurations, [45, 60, 80]);
  assert.deepEqual(times(changed).slice(1), [{ start: '09:25', end: '10:25' }, { start: '10:45', end: '12:05' }]);
  const shifted = time.updateScheduleSlotTime(changed, 0, 'start', '09:00');
  assert.equal(times(shifted).at(-1).end, '12:35');
  assert.deepEqual(shifted.breaks, changed.breaks);
});

test('overlapping, backwards and overnight edits are rejected without truncating slots', () => {
  const s = flexibleSchedule([]);
  for (const [index, field, value] of [[1, 'start', '09:14'], [1, 'end', '09:15'], [0, 'start', '23:00'], [0, 'end', '08:29'], [1, 'start', 'bad']]) {
    assert.equal(time.updateScheduleSlotTime(s, index, field, value), null);
  }
  for (const durations of [[], [0, 60], [45, ''], [601], Array(49).fill(1), [45, 600, 600]]) {
    assert.deepEqual(slotsFor({ ...s, slotDurations: durations }), []);
  }
  assert.deepEqual(slotsFor({ ...s, breaks: ['', 20] }), []);
  assert.deepEqual(time.buildScheduleSlots('23:58', 1, [], [1]), [{ number: 1, start: '23:58', end: '23:59' }]);
});

test('opening legacy timing in the editor preserves every generated slot and its nonuniform gaps', () => {
  const legacy = schedule([slot(3)]);
  const draft = time.createScheduleTimingDraft(legacy);
  assert.deepEqual(slotsFor(draft), slotsFor(legacy));
  assert.deepEqual(draft.breaks.slice(0, 4), [10, 20, 10, 20]);
  assert.deepEqual(time.createScheduleTimingDraft({ ...flexibleSchedule([]), breaks: [] }).breaks, [0, 0]);
  const noBreaks = { ...legacy, breaks: undefined };
  assert.deepEqual(slotsFor(time.createScheduleTimingDraft(noBreaks)), slotsFor(noBreaks));
  assert.equal(time.createScheduleTimingDraft().slotDurations.length, 6);
});

test('an overflowing timetable can be repaired by moving the first start earlier', () => {
  const s = { ...flexibleSchedule([]), start_time: '21:00' };
  assert.deepEqual(slotsFor(s), []);
  const repaired = time.updateScheduleSlotTime(s, 0, 'start', '20:00');
  assert.equal(slotsFor(repaired).at(-1).end, '23:25');
  assert.deepEqual(repaired.slotDurations, [45, 60, 80]);
});

test('notifications, widgets, prepared days and recurrence conflicts use the same flexible times', () => {
  const s = flexibleSchedule([slot(3), slot(2)]);
  const date = new Date(2026, 8, 21, 7);
  const expected = [{ start: '09:15', end: '10:15' }, { start: '10:35', end: '11:55' }];
  assert.deepEqual(time.buildLessonOccurrences(s, { from: date, horizonDays: 1 }).map(item => item.timeInfo), expected);
  assert.deepEqual(time.prepareScheduleDays(s)(date).timeline.filter(item => item.type === 'lesson').map(item => item.lesson.timeInfo), expected);
  assert.deepEqual(parseRealSchedule(s, date, 0, date).items.filter(item => item.type === 'lesson').map(item => ({ start: item.startTime, end: item.endTime })), expected);
  const conflict = applyLessonRecurrence(s, { dayIndex: 0, weekNumber: 1, lessonIndex: null, lesson: { subjectId: 'other', timeMode: 'custom', startTime: '10:00', endTime: '10:10' }, selection: { mode: 'all' }, preview: true });
  assert.deepEqual(conflict.conflicts.map(item => item.week), [1, 2]);
});

test('custom lesson times remain fixed when the numbered timetable changes', () => {
  const s = flexibleSchedule([slot(3), { subjectId: 'math', timeMode: 'custom', startTime: '16:00', endTime: '16:30' }]);
  const changed = time.updateScheduleSlotTime(s, 0, 'end', '09:30');
  assert.deepEqual(times(changed), [{ start: '10:50', end: '12:10' }, { start: '16:00', end: '16:30' }]);
  const normalized = time.normalizeScheduleTiming(changed);
  assert.deepEqual(time.normalizeScheduleTiming(normalized), normalized);
});

import {
  buildLessonTimes, buildScheduleSlots, calculateScheduleWeek, createDateAtTime,
  getInitialScheduleDate, getLessonSubjectId, getScheduleDayIndex, getScheduleDayLessons,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
import { getScheduleExportRows } from '../../utils/scheduleExport';

const dayLessonTimes = (schedule, date) => {
  const lessons = getScheduleDayLessons(schedule, date);
  const times = buildLessonTimes(schedule?.start_time || '08:30', schedule?.duration || 45,
    schedule?.breaks || [], lessons, schedule?.slotDurations);
  return lessons.flatMap((lesson, index) => {
    if (!getLessonSubjectId(lesson) && lesson?.subjectDeleted !== true) return [];
    const start = createDateAtTime(date, times[index]?.start);
    const end = createDateAtTime(date, times[index]?.end);
    if (!start || !end) return [];
    if (end < start) end.setDate(end.getDate() + 1);
    return [{ start, end }];
  });
};

export const getSharedSchedulePreviewSelection = (schedule, now = new Date()) => {
  const previous = normalizeScheduleDate(now);
  previous.setDate(previous.getDate() - 1);
  const overnight = dayLessonTimes(schedule, previous).some(({ start, end }) => start <= now && end > now);
  const date = overnight ? previous : getInitialScheduleDate(schedule, now);
  return { week: String(calculateScheduleWeek(schedule, date)), day: getScheduleDayIndex(date), date };
};

export const getSharedSchedulePreviewRefreshAt = (schedule, now = new Date()) => {
  const tomorrow = normalizeScheduleDate(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const previous = normalizeScheduleDate(now);
  previous.setDate(previous.getDate() - 1);
  const ends = [...dayLessonTimes(schedule, previous), ...dayLessonTimes(schedule, now)]
    .map(({ end }) => end.getTime()).filter(end => end > now.getTime());
  return Math.min(tomorrow.getTime(), ...ends);
};

export const getSharedSchedulePreviewRows = (schedule, week) => {
  const slots = buildScheduleSlots(schedule?.start_time || '08:30', schedule?.duration || 45,
    schedule?.breaks || [], schedule?.slotDurations);
  const occupied = getScheduleExportRows(week);
  if (!occupied.length) return [];
  const latestStart = occupied[occupied.length - 1].start;
  const rows = new Map(slots.filter(slot => slot.start <= latestStart).map(slot => [
    slot.start + '/' + slot.end, { key: 'slot:' + slot.number, ...slot, cells: week.days.map(() => []) },
  ]));
  occupied.forEach(row => {
    const key = row.start + '/' + row.end;
    rows.set(key, { ...row, key: rows.get(key)?.key || 'time:' + key,
      number: rows.get(key)?.number ?? row.cells.flat().find(lesson => lesson.number)?.number ?? null });
  });
  return [...rows.values()].sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end));
};

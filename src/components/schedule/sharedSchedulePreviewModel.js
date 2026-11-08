import {
  buildLessonTimes, buildScheduleSlots, calculateScheduleWeek, createDateAtTime,
  getLessonSubjectId, getScheduleDayIndex, getScheduleDayLessons,
  normalizeScheduleDate, normalizeScheduleRepeat,
} from '../../utils/scheduleTime';
import { buildScheduleExport, getScheduleExportRows } from '../../utils/scheduleExport';

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

const selectDate = (schedule, date) => ({ week: String(calculateScheduleWeek(schedule, date)), day: getScheduleDayIndex(date), date });

const daysFromToday = (now, start, count) => {
  const today = normalizeScheduleDate(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + start + index);
    return date;
  });
};

const hasUnfinishedLesson = (schedule, date, now) => dayLessonTimes(schedule, date).some(({ end }) => end > now);

const ongoingOvernightDay = (schedule, now) => {
  const [previous] = daysFromToday(now, -1, 1);
  return dayLessonTimes(schedule, previous).some(({ start, end }) => start <= now && end > now) ? previous : null;
};

export const getSharedSchedulePreviewSelection = (schedule, now = new Date()) => {
  const overnight = ongoingOvernightDay(schedule, now);
  if (overnight) return selectDate(schedule, overnight);
  const dayIndex = getScheduleDayIndex(now);
  const upcoming = daysFromToday(now, 0, 7 - dayIndex).find(date => hasUnfinishedLesson(schedule, date, now));
  if (upcoming) return selectDate(schedule, upcoming);
  // An empty week is part of the author's cycle, so it is shown rather than skipped. Only after this
  // week's lessons have ended does the preview move on, and then by one week at most.
  if (!daysFromToday(now, -dayIndex, 7).some(date => dayLessonTimes(schedule, date).length)) return selectDate(schedule, normalizeScheduleDate(now));
  const nextWeek = daysFromToday(now, 7 - dayIndex, 7);
  return selectDate(schedule, nextWeek.find(date => dayLessonTimes(schedule, date).length) || nextWeek[0]);
};

// The class in progress and the next one at any distance, as lesson objects of the export document so the
// preview can mark exactly those cards. Yesterday is included for a class that runs past midnight, and the
// search reaches the same weekday of the next cycle when today's classes have ended.
export const getSharedSchedulePreviewLiveLessons = (schedule, document, now = new Date()) => {
  let current = null;
  for (const date of daysFromToday(now, -1, normalizeScheduleRepeat(schedule?.repeat) * 7 + 2)) {
    const { week, day } = selectDate(schedule, date);
    const lessons = document.weeks.find(item => String(item.number) === week)?.days.find(item => item.index === day)?.lessons || [];
    const timed = lessons.flatMap(lesson => {
      const start = createDateAtTime(date, lesson.start);
      const end = createDateAtTime(date, lesson.end);
      if (!start || !end) return [];
      if (end <= start) end.setDate(end.getDate() + 1);
      return [{ week, day, date, lesson, start, end }];
    }).sort((left, right) => left.start - right.start);
    if (!current) current = timed.find(item => item.start <= now && item.end > now) || null;
    const next = timed.find(item => item.start > now);
    if (next) return { current, next };
  }
  return { current, next: null };
};

const PAGE_WIDTH = 1280;
const FIVE_DAY_COLUMNS = 5;
const EXTRA_COLUMN_WIDTH = 200;

// A Saturday or Sunday column widens the page by one column so cards keep the width of a five-day week
// instead of wrapping every title; up to five columns keep the 1280px width of planitflow.com.
export const getSharedSchedulePreviewPageWidth = (schedule) => {
  const { weeks } = buildScheduleExport(schedule, 'en');
  // Without classes the export keeps all seven days, but the preview then shows only an empty message.
  if (!weeks.some(week => week.days.some(day => day.lessons.length))) return PAGE_WIDTH;
  const columns = Math.max(...weeks.map(week => week.days.length));
  return PAGE_WIDTH + Math.max(0, columns - FIVE_DAY_COLUMNS) * EXTRA_COLUMN_WIDTH;
};

export const getSharedSchedulePreviewRefreshAt =(schedule, now = new Date()) => {
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

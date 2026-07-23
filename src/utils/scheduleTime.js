const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !TIME_RE.test(timeStr)) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

export const formatMinutesToTime = (minutes) => {
  const totalMinutes = ((Math.round(Number(minutes) || 0) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const addMinutes = (timeStr, minsToAdd) => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return null;
  return formatMinutesToTime(minutes + (Number(minsToAdd) || 0));
};

export const getDurationMinutes = (start, end) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  return diff;
};

export const getBreakDuration = (breaksArray, index) => {
  if (!Array.isArray(breaksArray) || breaksArray.length === 0) return 0;
  return Number(breaksArray[index % breaksArray.length]) || 0;
};

export const buildLessonTimes = (startTime, duration, breaks, daySchedule) => {
  if (!startTime || !duration || !Array.isArray(daySchedule)) return [];

  const times = [];
  let currentStart = startTime;

  for (let index = 0; index < daySchedule.length; index += 1) {
    const item = daySchedule[index];
    const isInstance = typeof item === "object" && item !== null;
    const customStart = isInstance ? item.startTime : null;
    const customEnd = isInstance ? item.endTime : null;

    const actualStart = customStart || currentStart;
    const actualEnd = customEnd || addMinutes(actualStart, duration);

    times.push({ start: actualStart, end: actualEnd });

    currentStart = addMinutes(actualEnd, getBreakDuration(breaks, index));
  }

  return times;
};

export const normalizeScheduleDate = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  const normalized = Number.isNaN(date.getTime()) ? new Date() : date;
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const getLastMondayDate = (dateInput = new Date()) => {
  const date = normalizeScheduleDate(dateInput);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
};

export const getLastMondayISODate = (dateInput = new Date()) => (
  getLastMondayDate(dateInput).toISOString()
);

export const getScheduleDayIndex = (dateInput = new Date()) => {
  const date = new Date(dateInput);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

export const calculateScheduleWeek = (schedule, dateInput = new Date()) => {
  const repeatWeeks = Math.max(1, Math.round(Number(schedule?.repeat) || 1));
  if (!schedule?.starting_week || repeatWeeks <= 1) return 1;

  const firstWeekDate = normalizeScheduleDate(schedule.starting_week);
  const targetDate = normalizeScheduleDate(dateInput);
  const diffDays = Math.round((targetDate.getTime() - firstWeekDate.getTime()) / DAY_MS);
  let mod = Math.floor(diffDays / 7) % repeatWeeks;
  if (mod < 0) mod += repeatWeeks;
  return mod + 1;
};

export const getScheduleDayLessons = (schedule, dateInput = new Date()) => {
  if (!Array.isArray(schedule?.schedule)) return [];
  const dayIndex = getScheduleDayIndex(dateInput);
  const weekKey = `week${calculateScheduleWeek(schedule, dateInput)}`;
  const day = schedule.schedule[dayIndex];
  return Array.isArray(day?.[weekKey]) ? day[weekKey] : [];
};

export const getLessonSubjectId = (lesson) => {
  if (lesson === undefined || lesson === null) return null;
  if (typeof lesson === "object") return lesson.subjectId || lesson.subject || lesson.id || null;
  return lesson;
};

export const getLessonData = (lesson) => (
  lesson && typeof lesson === "object" ? lesson : {}
);

export const createDateAtTime = (dateInput, timeStr) => {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return null;

  const date = normalizeScheduleDate(dateInput);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
};

export const buildLessonOccurrences = (schedule, options = {}) => {
  if (!schedule || !Array.isArray(schedule.schedule)) return [];

  const {
    from = new Date(),
    horizonDays = 21,
    maxOccurrences = Number.POSITIVE_INFINITY,
    includePast = false,
  } = options;

  const fromDate = new Date(from);
  const fromTime = Number.isNaN(fromDate.getTime()) ? Date.now() : fromDate.getTime();
  const startDate = normalizeScheduleDate(fromDate);
  const result = [];
  const duration = Number(schedule.duration) || 45;
  const startTime = schedule.start_time || "08:30";
  const breaks = Array.isArray(schedule.breaks) ? schedule.breaks : [];
  const subjects = Array.isArray(schedule.subjects) ? schedule.subjects : [];

  for (let offset = 0; offset < horizonDays && result.length < maxOccurrences; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);

    const dayIndex = getScheduleDayIndex(date);
    const weekNumber = calculateScheduleWeek(schedule, date);
    const weekKey = `week${weekNumber}`;
    const lessons = Array.isArray(schedule.schedule?.[dayIndex]?.[weekKey])
      ? schedule.schedule[dayIndex][weekKey]
      : [];
    const lessonTimes = buildLessonTimes(startTime, duration, breaks, lessons);

    for (let index = 0; index < lessons.length && result.length < maxOccurrences; index += 1) {
      const lesson = lessons[index];
      const subjectId = getLessonSubjectId(lesson);
      const timeInfo = lessonTimes[index];
      if (!subjectId || !timeInfo?.start) continue;

      const startAt = createDateAtTime(date, timeInfo.start);
      if (!startAt) continue;
      if (!includePast && startAt.getTime() <= fromTime) continue;

      const endAt = timeInfo.end ? createDateAtTime(date, timeInfo.end) : null;
      if (endAt && endAt.getTime() < startAt.getTime()) {
        endAt.setDate(endAt.getDate() + 1);
      }

      result.push({
        date,
        startAt,
        endAt,
        dayIndex,
        weekKey,
        weekNumber,
        lessonIndex: index,
        lesson,
        lessonData: getLessonData(lesson),
        subjectId,
        subject: subjects.find((subject) => subject.id === subjectId) || {},
        timeInfo,
      });
    }
  }

  return result.sort((left, right) => left.startAt.getTime() - right.startAt.getTime());
};

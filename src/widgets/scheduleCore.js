export const formatTime = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const parseTime = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!match) return fallback;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return hours * 60 + minutes;
};

const toUtcDay = (date) => Date.UTC(
  date.getFullYear(),
  date.getMonth(),
  date.getDate(),
);

const parseUtcCalendarDay = (value) => {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toUtcDay(date);
};

const createBoundaryTimestamp = (date, minutes) => {
  const boundary = new Date(date);
  boundary.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return boundary.getTime();
};

export function parseRealSchedule(scheduleData, targetDate, dateOffset, nowInput = new Date()) {
  if (!scheduleData || !scheduleData.schedule) {
    return { items: [], currentWeekNum: 1, totalWeeks: 1, nextTransitionAt: null };
  }

  try {
    const now = new Date(nowInput);
    let dayIndex = targetDate.getDay() - 1;
    if (dayIndex < 0) dayIndex = 6;

    let currentWeekNum = 1;
    const parsedRepeat = Number(scheduleData.repeat);
    const totalWeeks = Number.isFinite(parsedRepeat) && parsedRepeat > 0
      ? Math.floor(parsedRepeat)
      : 1;

    if (scheduleData.starting_week && totalWeeks > 1) {
      const startDay = parseUtcCalendarDay(scheduleData.starting_week);
      if (startDay !== null) {
        // Calendar days in UTC avoid an off-by-one week around DST changes.
        const weeksPassed = Math.floor((toUtcDay(targetDate) - startDay) / WEEK_MS);
        let mod = weeksPassed % totalWeeks;
        if (mod < 0) mod += totalWeeks;
        currentWeekNum = mod + 1;
      }
    }

    const weekKey = `week${currentWeekNum}`;
    const dayObj = scheduleData.schedule[dayIndex] || {};
    const rawLessons = Array.isArray(dayObj[weekKey]) ? dayObj[weekKey] : [];

    const subjects = scheduleData.subjects || [];
    const teachersList = scheduleData.teachers || [];
    const gradients = scheduleData.gradients || [];
    const breaks = scheduleData.breaks || [];
    const parsedDuration = Number(scheduleData.duration);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0
      ? parsedDuration
      : 45;

    const baseMins = parseTime(scheduleData.start_time, 8 * 60 + 30);

    const isToday = dateOffset === 0;
    const nowMins = now.getHours() * 60
      + now.getMinutes()
      + now.getSeconds() / 60
      + now.getMilliseconds() / 60000;

    const timeline = [];
    let currentMins = baseMins;

    for (let i = 0; i < rawLessons.length; i++) {
      const item = rawLessons[i];
      const bDuration = breaks.length > 0 ? (Number(breaks[i % breaks.length]) || 0) : 10;

      let actualStart = currentMins;
      let actualEnd = currentMins + duration;

      if (item) {
        const isInstance = typeof item === 'object' && item !== null;
        const lessonData = isInstance ? item : {};
        const subjectId = isInstance ? (item.subjectId || item.subject || item.id) : item;

        actualStart = parseTime(lessonData.startTime, actualStart);

        if (lessonData.endTime) {
          actualEnd = parseTime(lessonData.endTime, actualEnd);
        } else if (lessonData.startTime) {
          actualEnd = actualStart + duration;
        }

        if (actualEnd <= actualStart) actualEnd = actualStart + duration;

        timeline.push({ item, isLesson: true, actualStart, actualEnd, subjectId, lessonData });
      } else {
        timeline.push({ item: null, isLesson: false, actualStart, actualEnd });
      }

      currentMins = actualEnd + bDuration;
    }

    let targetBreakIndex = -1;
    if (isToday) {
      for (let i = 0; i < timeline.length; i++) {
        if (!timeline[i].isLesson) continue;

        let nextLesson = null;
        for (let j = i + 1; j < timeline.length; j++) {
          if (timeline[j].isLesson) { nextLesson = timeline[j]; break; }
        }

        if (nextLesson) {
          const realBreakStart = timeline[i].actualEnd;
          const realBreakEnd = nextLesson.actualStart;
          if (nowMins >= realBreakStart && nowMins < realBreakEnd) {
            targetBreakIndex = i;
            break;
          } else if (nowMins < realBreakStart && targetBreakIndex === -1) {
            targetBreakIndex = i;
          }
        }
      }
    }

    const items = [];

    for (let i = 0; i < timeline.length; i++) {
      const tInfo = timeline[i];
      if (!tInfo.isLesson) continue;

      const { lessonData, subjectId } = tInfo;
      const subjectObj = subjects.find(s => s.id === subjectId) || {};

      let color = '#0A84FF';
      if (lessonData.color) {
        color = lessonData.color;
      } else if (subjectObj.typeColor === 'gradient' && subjectObj.colorGradient) {
        const activeGrad = gradients.find(g => g.id === subjectObj.colorGradient);
        if (activeGrad?.colors?.length > 0) {
          color = activeGrad.colors[0].color || activeGrad.colors[0];
        }
      } else if (subjectObj.color) {
        color = subjectObj.color;
      }
      if (Array.isArray(color)) color = color[0];

      let teacherName = lessonData.teacherName || lessonData.teacher;
      if (!teacherName && lessonData.teacherId) {
        teacherName = teachersList.find(t => t.id === lessonData.teacherId)?.name;
      }
      if (!teacherName && subjectObj.teachers?.length > 0) {
        teacherName = subjectObj.teachers
          .map(tId => teachersList.find(t => t.id === tId)?.name)
          .filter(Boolean)
          .join(', ');
      }

      const room = lessonData.room || lessonData.cabinet || subjectObj.room || subjectObj.cabinet || '';
      const extraInfo = lessonData.info || lessonData.notes || '';
      const detailsArray = [];
      if (room) detailsArray.push(room);
      if (teacherName) detailsArray.push(teacherName);
      if (extraInfo) detailsArray.push(extraInfo);

      const isCurrentLesson = isToday && nowMins >= tInfo.actualStart && nowMins < tInfo.actualEnd;
      const minutesLeft = Math.ceil(tInfo.actualEnd - nowMins);

      items.push({
        type: 'lesson',
        id: lessonData.id || subjectId,
        dayIndex,
        lessonIndex: i,
        subject: lessonData.name || subjectObj.name || 'Пара',
        details: detailsArray.join(' • ') || 'Немає деталей',
        color,
        startTime: formatTime(tInfo.actualStart),
        endTime: formatTime(tInfo.actualEnd),
        isCurrent: isCurrentLesson,
        minutesLeft: minutesLeft > 0 ? minutesLeft : 0,
      });

      if (i === targetBreakIndex) {
        let nextLesson = null;
        for (let j = i + 1; j < timeline.length; j++) {
          if (timeline[j].isLesson) { nextLesson = timeline[j]; break; }
        }

        if (nextLesson) {
          const realBreakStart = tInfo.actualEnd;
          const realBreakEnd = nextLesson.actualStart;
          const realBreakDuration = realBreakEnd - realBreakStart;

          if (realBreakDuration > 0) {
            items.push({
              type: 'break',
              startTime: formatTime(realBreakStart),
              endTime: formatTime(realBreakEnd),
              duration: realBreakDuration,
              color,
              isCurrent: isToday && nowMins >= realBreakStart && nowMins < realBreakEnd,
            });
          }
        }
      }
    }

    const nextBoundaryMinutes = isToday
      ? timeline
        .filter(({ isLesson }) => isLesson)
        .flatMap(({ actualStart, actualEnd }) => [actualStart, actualEnd])
        .filter((minutes) => minutes > nowMins)
        .sort((left, right) => left - right)[0]
      : undefined;

    return {
      items,
      currentWeekNum,
      totalWeeks,
      nextTransitionAt: nextBoundaryMinutes === undefined
        ? null
        : createBoundaryTimestamp(targetDate, nextBoundaryMinutes),
    };
  } catch (_) {
    return { items: [], currentWeekNum: 1, totalWeeks: 1, nextTransitionAt: null };
  }
}

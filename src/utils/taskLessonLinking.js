import {
  buildLessonOccurrences,
  buildLessonTimes,
  calculateScheduleWeek,
  getLessonData,
  getLessonSubjectId,
  getScheduleDayIndex,
} from "./scheduleTime";

export const TASK_AUTO_LINK_MODES = {
  OFF: "off",
  SELECTED: "selected",
  NEXT_SAME: "nextSame",
};

export const TASK_AUTO_LINK_MODE_VALUES = [
  TASK_AUTO_LINK_MODES.SELECTED,
  TASK_AUTO_LINK_MODES.NEXT_SAME,
];

const LEGACY_TASK_AUTO_LINK_MODES = {
  today: TASK_AUTO_LINK_MODES.SELECTED,
  next: TASK_AUTO_LINK_MODES.NEXT_SAME,
};

export const uniqueIds = (value) => (
  [...new Set((Array.isArray(value) ? value : [value]).filter(Boolean))]
);

export const getTaskAutoLinkMode = (schedule) => {
  const mode = schedule?.taskAutoLinkMode;
  if (mode === TASK_AUTO_LINK_MODES.OFF) return TASK_AUTO_LINK_MODES.SELECTED;
  if (TASK_AUTO_LINK_MODE_VALUES.includes(mode)) return mode;
  if (LEGACY_TASK_AUTO_LINK_MODES[mode]) return LEGACY_TASK_AUTO_LINK_MODES[mode];
  return TASK_AUTO_LINK_MODES.NEXT_SAME;
};

export const getLocalISODate = (date = new Date()) => {
  const input = new Date(date);
  const safeDate = Number.isNaN(input.getTime()) ? new Date() : input;
  const offset = safeDate.getTimezoneOffset() * 60000;
  return new Date(safeDate.getTime() - offset).toISOString().split("T")[0];
};

const parseLocalDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getLessonContextSubjectId = (lesson) => (
  lesson?.subjectId
  || lesson?.data?.subjectId
  || getLessonSubjectId(lesson?.lesson)
  || getLessonSubjectId(lesson?.data)
  || getLessonSubjectId(lesson)
);

const getLessonContextData = (lesson) => (
  lesson?.data || getLessonData(lesson?.lesson) || getLessonData(lesson)
);

export const normalizeLessonRef = (value, fallbackScheduleId = null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const next = {};
  const scheduleId = value.scheduleId || fallbackScheduleId;
  if (scheduleId) next.scheduleId = String(scheduleId);
  if (value.subjectId) next.subjectId = String(value.subjectId);
  if (value.date) next.date = String(value.date);
  if (value.weekKey) next.weekKey = String(value.weekKey);
  if (value.start) next.start = String(value.start);
  if (value.end) next.end = String(value.end);

  if (value.dayIndex !== undefined && value.dayIndex !== null) {
    const dayIndex = Number(value.dayIndex);
    if (Number.isInteger(dayIndex)) next.dayIndex = dayIndex;
  }

  if (value.lessonIndex !== undefined && value.lessonIndex !== null) {
    const lessonIndex = Number(value.lessonIndex);
    if (Number.isInteger(lessonIndex)) next.lessonIndex = lessonIndex;
  }

  const hasLessonDetails = Boolean(
    next.date
    || next.weekKey
    || next.start
    || next.end
    || next.dayIndex !== undefined
    || next.lessonIndex !== undefined
  );

  return next.scheduleId && hasLessonDetails ? next : null;
};

export const areLessonRefsSame = (left, right) => {
  const leftRef = normalizeLessonRef(left);
  const rightRef = normalizeLessonRef(right);
  if (!leftRef || !rightRef) return false;

  return (
    leftRef.scheduleId === rightRef.scheduleId
    && leftRef.date === rightRef.date
    && leftRef.weekKey === rightRef.weekKey
    && Number(leftRef.lessonIndex) === Number(rightRef.lessonIndex)
  );
};

export const formatLessonRefDate = (lessonRef, lang = "en") => {
  const ref = normalizeLessonRef(lessonRef);
  if (!ref?.date) return "";

  const parsed = new Date(`${ref.date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return ref.date;

  return parsed.toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "short",
  });
};

export const formatLessonRefLabel = (lessonRef, lang = "en") => {
  const ref = normalizeLessonRef(lessonRef);
  if (!ref) return "";

  const parts = [];
  const dateLabel = formatLessonRefDate(ref, lang);
  if (dateLabel) parts.push(dateLabel);
  else if (ref.weekKey) parts.push(ref.weekKey);

  if (ref.start || ref.end) {
    parts.push([ref.start, ref.end].filter(Boolean).join(" - "));
  }

  return parts.filter(Boolean).join(" - ");
};

export const formatOccurrenceDayLabel = (dateInput, lang = "en") => {
  const date = parseLocalDate(dateInput);
  if (!date) return "";

  const today = parseLocalDate(new Date());
  const diffDays = today
    ? Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  if (diffDays === 0) return lang === "uk" ? "Сьогодні" : "Today";
  if (diffDays === 1) return lang === "uk" ? "Завтра" : "Tomorrow";
  if (diffDays === -1) return lang === "uk" ? "Вчора" : "Yesterday";

  return date.toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

export const formatOccurrenceTimeLabel = (occurrence) => (
  [occurrence?.timeInfo?.start, occurrence?.timeInfo?.end].filter(Boolean).join(" - ")
);

export const createLessonRefForDate = (schedule, lesson, dateInput = new Date()) => {
  if (!schedule?.id || !lesson) return null;

  const dayIndex = getScheduleDayIndex(dateInput);
  const weekKey = `week${calculateScheduleWeek(schedule, dateInput)}`;
  const subjectId = getLessonContextSubjectId(lesson);

  return normalizeLessonRef({
    scheduleId: schedule.id,
    subjectId,
    date: getLocalISODate(dateInput),
    dayIndex,
    weekKey,
    lessonIndex: Number.isInteger(lesson.index) ? lesson.index : null,
    start: lesson.timeInfo?.start,
    end: lesson.timeInfo?.end,
  }, schedule.id);
};

export const resolveLessonLinkIds = (schedule, lessonData = {}, subjectId = null) => {
  const subjects = Array.isArray(schedule?.subjects) ? schedule.subjects : [];
  const subject = subjects.find((item) => item?.id === subjectId) || null;
  const hasLocalLinks = lessonData?.links !== undefined;
  const subjectLinkIds = uniqueIds([
    ...(Array.isArray(subject?.links) ? subject.links : []),
    subject?.link,
  ]);
  const rawLinkIds = hasLocalLinks
    ? lessonData.links
    : uniqueIds([
      lessonData?.link,
      ...subjectLinkIds,
    ]);
  const availableLinkIds = new Set((Array.isArray(schedule?.links) ? schedule.links : [])
    .map((link) => link?.id)
    .filter(Boolean));

  return uniqueIds(rawLinkIds).filter((id) => availableLinkIds.has(id));
};

export const createLessonRefFromOccurrence = (schedule, occurrence) => {
  if (!schedule?.id || !occurrence) return null;

  return normalizeLessonRef({
    scheduleId: schedule.id,
    subjectId: occurrence.subjectId,
    date: getLocalISODate(occurrence.date),
    dayIndex: occurrence.dayIndex,
    weekKey: occurrence.weekKey,
    lessonIndex: occurrence.lessonIndex,
    start: occurrence.timeInfo?.start,
    end: occurrence.timeInfo?.end,
  }, schedule.id);
};

export const createTaskDraftFromOccurrence = (schedule, occurrence) => {
  if (!schedule?.id || !occurrence) return null;

  const lessonRef = createLessonRefFromOccurrence(schedule, occurrence);
  if (!lessonRef) return null;

  return {
    subjectId: occurrence.subjectId || null,
    lessonRef,
    linkIds: resolveLessonLinkIds(schedule, occurrence.lessonData || {}, occurrence.subjectId),
  };
};

export const buildTaskLessonOptions = (schedule, options = {}) => {
  if (!schedule?.id) return [];

  const {
    from = new Date(),
    horizonDays = 28,
    pastDays = 0,
    includePast = true,
    maxOccurrences = 120,
  } = options;

  const fromDate = new Date(from);
  const safeFrom = Number.isNaN(fromDate.getTime()) ? new Date() : fromDate;
  const startDate = new Date(safeFrom);
  startDate.setHours(0, 0, 0, 0);
  if (includePast && pastDays > 0) {
    startDate.setDate(startDate.getDate() - pastDays);
  }

  const occurrences = buildLessonOccurrences(schedule, {
    from: includePast && pastDays > 0 ? startDate : safeFrom,
    horizonDays: Math.max(1, Number(horizonDays) + (includePast ? Number(pastDays) || 0 : 0)),
    includePast,
    maxOccurrences: Number.POSITIVE_INFINITY,
  });

  return Number.isFinite(maxOccurrences)
    ? occurrences.slice(0, maxOccurrences)
    : occurrences;
};

export const resolveOccurrenceFromLessonRef = (schedule, lessonRef) => {
  const ref = normalizeLessonRef(lessonRef, schedule?.id);
  if (!schedule?.id || !ref?.date) return null;

  const date = parseLocalDate(ref.date);
  if (!date) return null;

  const occurrences = buildTaskLessonOptions(schedule, {
    from: date,
    horizonDays: 1,
    includePast: true,
    maxOccurrences: Number.POSITIVE_INFINITY,
  });

  return occurrences.find((occurrence) => (
    (!ref.weekKey || occurrence.weekKey === ref.weekKey)
    && (ref.dayIndex === undefined || Number(occurrence.dayIndex) === Number(ref.dayIndex))
    && Number(occurrence.lessonIndex) === Number(ref.lessonIndex)
  )) || null;
};

export const resolveOccurrenceFromLessonContext = (schedule, lesson, dateInput = new Date()) => {
  if (!schedule?.id || !lesson) return null;
  if (lesson.startAt && lesson.date && lesson.lessonIndex !== undefined) return lesson;

  const lessonRef = createLessonRefForDate(schedule, lesson, dateInput);
  return resolveOccurrenceFromLessonRef(schedule, lessonRef);
};

const getLessonGroupSubjectId = (lessonGroup) => (
  typeof lessonGroup === "string" ? lessonGroup : lessonGroup?.subjectId
);

export const buildScheduleLessonGroups = (schedule) => {
  if (!schedule?.id || !Array.isArray(schedule.schedule)) return [];

  const subjects = Array.isArray(schedule.subjects) ? schedule.subjects : [];
  const subjectById = new Map(subjects.map((subject) => [subject?.id, subject]).filter(([id]) => !!id));
  const groupsBySubject = new Map();
  const duration = Number(schedule.duration) || 45;
  const startTime = schedule.start_time || "08:30";
  const breaks = Array.isArray(schedule.breaks) ? schedule.breaks : [];

  schedule.schedule.forEach((day, dayIndex) => {
    if (!day || typeof day !== "object") return;

    Object.keys(day).forEach((weekKey) => {
      const lessons = Array.isArray(day[weekKey]) ? day[weekKey] : [];
      const lessonTimes = buildLessonTimes(startTime, duration, breaks, lessons);

      lessons.forEach((lesson, lessonIndex) => {
        const subjectId = getLessonSubjectId(lesson);
        if (!subjectId) return;

        const subject = subjectById.get(subjectId) || {};
        const lessonData = getLessonData(lesson);
        const key = String(subjectId);

        if (!groupsBySubject.has(key)) {
          groupsBySubject.set(key, {
            key: `${schedule.id}:${key}`,
            scheduleId: schedule.id,
            subjectId,
            subject,
            label: subject.name || subject.fullName || lessonData.name || "",
            fullName: subject.fullName || "",
            lessonType: lessonData.type || subject.type || "",
            occurrenceCount: 0,
            positions: [],
          });
        }

        const group = groupsBySubject.get(key);
        group.occurrenceCount += 1;
        group.positions.push({
          dayIndex,
          weekKey,
          lessonIndex,
          lessonData,
          timeInfo: lessonTimes[lessonIndex] || {},
        });
      });
    });
  });

  return Array.from(groupsBySubject.values()).sort((left, right) => (
    (left.label || left.fullName || "").localeCompare(right.label || right.fullName || "")
  ));
};

export const buildScheduleGroupedLessonCatalogue = (schedules, options = {}) => {
  const selectedScheduleIds = uniqueIds(options.selectedScheduleIds);
  const selectedOrder = new Map(selectedScheduleIds.map((id, index) => [id, index]));

  const scheduleRecords = (Array.isArray(schedules) ? schedules : [])
    .filter((item) => item?.id)
    .map((item, originalIndex) => ({
      schedule: item,
      scheduleId: item.id,
      selected: selectedOrder.has(item.id),
      selectedIndex: selectedOrder.has(item.id) ? selectedOrder.get(item.id) : Number.POSITIVE_INFINITY,
      originalIndex,
      lessonGroups: buildScheduleLessonGroups(item),
    }))
    .sort((left, right) => {
      if (left.selected !== right.selected) return left.selected ? -1 : 1;
      if (left.selected && right.selected) return left.selectedIndex - right.selectedIndex;
      return left.originalIndex - right.originalIndex;
    });

  return [
    {
      key: "selected",
      selected: true,
      schedules: scheduleRecords.filter((record) => record.selected),
    },
    {
      key: "other",
      selected: false,
      schedules: scheduleRecords.filter((record) => !record.selected),
    },
  ].filter((section) => section.schedules.length > 0);
};

const occurrenceMatchesLessonGroup = (occurrence, lessonGroup) => {
  const subjectId = getLessonGroupSubjectId(lessonGroup);
  return Boolean(subjectId && occurrence?.subjectId === subjectId);
};

export const listLessonGroupOccurrences = (schedule, lessonGroup, options = {}) => {
  if (!schedule?.id || !getLessonGroupSubjectId(lessonGroup)) return [];

  const {
    date,
    from = new Date(),
    horizonDays = 90,
    pastDays = 14,
    includePast = true,
    maxOccurrences = 240,
  } = options;

  const dateFilter = parseLocalDate(date);
  const occurrences = dateFilter
    ? buildTaskLessonOptions(schedule, {
      from: dateFilter,
      horizonDays: 1,
      includePast: true,
      maxOccurrences: Number.POSITIVE_INFINITY,
    })
    : buildTaskLessonOptions(schedule, {
      from,
      horizonDays,
      pastDays,
      includePast,
      maxOccurrences: Number.POSITIVE_INFINITY,
    });

  const filtered = occurrences
    .filter((occurrence) => occurrenceMatchesLessonGroup(occurrence, lessonGroup))
    .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

  return Number.isFinite(maxOccurrences) ? filtered.slice(0, maxOccurrences) : filtered;
};

export const findNextLessonGroupOccurrence = (schedule, lessonGroup, fromInput = new Date()) => (
  listLessonGroupOccurrences(schedule, lessonGroup, {
    from: fromInput,
    horizonDays: 180,
    pastDays: 0,
    includePast: false,
    maxOccurrences: 1,
  })[0] || null
);

export const findNextSameLessonOccurrence = (
  schedule,
  sourceLessonOrOccurrence,
  sourceDateInput = new Date(),
  nowInput = new Date(),
) => {
  if (!schedule?.id || !sourceLessonOrOccurrence) return null;

  const sourceOccurrence = resolveOccurrenceFromLessonContext(
    schedule,
    sourceLessonOrOccurrence,
    sourceDateInput,
  );
  const subjectId = sourceOccurrence?.subjectId || getLessonContextSubjectId(sourceLessonOrOccurrence);
  if (!subjectId) return null;

  const now = new Date(nowInput);
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  const sourceStart = sourceOccurrence?.startAt;
  const searchFrom = sourceStart?.getTime?.() > safeNow.getTime() ? sourceStart : safeNow;
  const sourceRef = sourceOccurrence
    ? createLessonRefFromOccurrence(schedule, sourceOccurrence)
    : createLessonRefForDate(schedule, sourceLessonOrOccurrence, sourceDateInput);

  return listLessonGroupOccurrences(schedule, { subjectId }, {
    from: searchFrom,
    horizonDays: 180,
    pastDays: 0,
    includePast: false,
    maxOccurrences: 500,
  }).find((occurrence) => {
    const occurrenceRef = createLessonRefFromOccurrence(schedule, occurrence);
    return !sourceRef || !areLessonRefsSame(sourceRef, occurrenceRef);
  }) || null;
};

export const createTaskDraftFromLesson = (schedule, lesson, dateInput = new Date()) => {
  if (!schedule?.id || !lesson) return null;

  const occurrence = resolveOccurrenceFromLessonContext(schedule, lesson, dateInput);
  if (occurrence) return createTaskDraftFromOccurrence(schedule, occurrence);

  const subjectId = getLessonContextSubjectId(lesson);
  const lessonRef = createLessonRefForDate(schedule, lesson, dateInput);
  if (!lessonRef) return null;

  return {
    subjectId,
    lessonRef,
    linkIds: resolveLessonLinkIds(schedule, getLessonContextData(lesson), subjectId),
  };
};

export const createTaskDraftFromLessonContext = (
  schedule,
  lesson,
  dateInput = new Date(),
  mode = getTaskAutoLinkMode(schedule),
  nowInput = new Date(),
) => {
  if (!schedule?.id || !lesson) return null;

  const normalizedMode = getTaskAutoLinkMode({ taskAutoLinkMode: mode });
  const subjectId = getLessonContextSubjectId(lesson);
  const baseLinkIds = resolveLessonLinkIds(schedule, getLessonContextData(lesson), subjectId);

  const occurrence = normalizedMode === TASK_AUTO_LINK_MODES.NEXT_SAME
    ? findNextSameLessonOccurrence(schedule, lesson, dateInput, nowInput)
    : resolveOccurrenceFromLessonContext(schedule, lesson, dateInput);
  const occurrenceDraft = createTaskDraftFromOccurrence(schedule, occurrence);

  if (!occurrenceDraft?.lessonRef) {
    return {
      subjectId,
      linkIds: baseLinkIds,
    };
  }

  return {
    subjectId: occurrenceDraft.subjectId || subjectId,
    lessonRef: occurrenceDraft.lessonRef,
    linkIds: uniqueIds([...baseLinkIds, ...(occurrenceDraft.linkIds || [])]),
  };
};

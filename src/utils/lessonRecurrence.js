import {
  buildLessonTimes,
  getScheduleWeekNumbers,
  normalizeScheduleRepeat,
} from "./scheduleTime";

const createId = () => (
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`
);

const getRepeatCount = (schedule) => normalizeScheduleRepeat(schedule?.repeat);

const getAllWeeks = (schedule) => getScheduleWeekNumbers(schedule?.repeat);

const normalizeWeeks = (weeks, schedule) => {
  const repeatCount = getRepeatCount(schedule);
  return [...new Set((Array.isArray(weeks) ? weeks : [])
    .map(Number)
    .filter((week) => Number.isInteger(week) && week >= 1 && week <= repeatCount))]
    .sort((left, right) => left - right);
};

export const normalizeLessonRecurrence = (value, schedule) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return null;

  const mode = value.mode === "all" ? "all" : "selected";
  const weeks = mode === "all" ? getAllWeeks(schedule) : normalizeWeeks(value.weeks, schedule);
  const overrides = [...new Set((Array.isArray(value.overrides) ? value.overrides : [])
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim()))];

  return {
    id,
    mode,
    weeks,
    ...(overrides.length > 0 ? { overrides } : {}),
  };
};

export const getLessonSeriesId = (lesson) => (
  lesson && typeof lesson === "object" && typeof lesson.recurrence?.id === "string"
    ? lesson.recurrence.id
    : null
);

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .filter((key) => key !== "recurrence")
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
};

const getRawLesson = (lesson) => {
  if (!lesson || typeof lesson !== "object") return lesson;
  if (!lesson.data || typeof lesson.data !== "object") return lesson;
  if (lesson.data.subjectId || !lesson.subjectId) return lesson.data;
  return { ...lesson.data, subjectId: lesson.subjectId };
};

const getComparableLesson = (lesson) => {
  const rawLesson = getRawLesson(lesson);
  if (rawLesson === undefined || rawLesson === null) return rawLesson;
  if (typeof rawLesson !== "object") return { subjectId: String(rawLesson) };

  const comparable = { ...rawLesson };
  const subjectId = comparable.subjectId || comparable.subject || comparable.id;
  if (subjectId) {
    comparable.subjectId = String(subjectId);
    delete comparable.subject;
    delete comparable.id;
  }
  return comparable;
};

const getLessonSignature = (lesson) => JSON.stringify(stableValue(getComparableLesson(lesson)));

const findMatchingWeeks = (schedule, dayIndex, sourceLesson) => {
  const signature = getLessonSignature(sourceLesson);
  const day = schedule?.schedule?.[dayIndex] || {};
  return getAllWeeks(schedule).filter((week) => (
    (Array.isArray(day[`week${week}`]) ? day[`week${week}`] : [])
      .some((lesson) => getLessonSignature(lesson) === signature)
  ));
};

const findLegacySeriesMemberIndex = (lessons, signature, preferredIndex) => {
  if (!Array.isArray(lessons) || !signature) return -1;
  if (
    Number.isInteger(preferredIndex)
    && getLessonSignature(lessons[preferredIndex]) === signature
  ) {
    return preferredIndex;
  }

  const matches = lessons
    .map((lesson, index) => (getLessonSignature(lesson) === signature ? index : -1))
    .filter((index) => index >= 0);
  return matches.length === 1 ? matches[0] : -1;
};

export const getLessonRecurrenceSelection = (
  schedule,
  dayIndex,
  weekNumber,
  lesson,
) => {
  const rawLesson = getRawLesson(lesson);
  const normalized = normalizeLessonRecurrence(rawLesson?.recurrence, schedule);
  if (normalized) {
    if (normalized.mode === "selected" && normalized.weeks.length === 0) {
      return { ...normalized, weeks: [weekNumber] };
    }
    if (
      normalized.mode === "selected"
      && normalized.weeks.length === getRepeatCount(schedule)
    ) {
      return { ...normalized, mode: "all", weeks: getAllWeeks(schedule) };
    }
    return normalized;
  }

  if (!rawLesson || !Number.isInteger(lesson?.index)) {
    return { id: null, mode: "all", weeks: getAllWeeks(schedule) };
  }

  const matchingWeeks = findMatchingWeeks(schedule, dayIndex, rawLesson);
  const weeks = matchingWeeks.length > 0 ? matchingWeeks : [weekNumber];
  return {
    id: null,
    mode: weeks.length === getRepeatCount(schedule) ? "all" : "selected",
    weeks,
  };
};

const getLessonRange = (schedule, lessons, index) => {
  const lessonTimes = buildLessonTimes(
    schedule?.start_time || "08:30",
    Number(schedule?.duration) || 45,
    Array.isArray(schedule?.breaks) ? schedule.breaks : [],
    lessons,
  );
  const time = lessonTimes[index];
  if (!time?.start || !time?.end) return null;
  return { start: time.start, end: time.end };
};

const rangesOverlap = (left, right) => (
  left && right && left.start < right.end && right.start < left.end
);

const sortLessons = (schedule, lessons) => (
  lessons
    .map((lesson, originalIndex) => ({
      lesson,
      originalIndex,
      start: getLessonRange(schedule, lessons, originalIndex)?.start || "99:99",
    }))
    .sort((left, right) => left.start.localeCompare(right.start) || left.originalIndex - right.originalIndex)
    .map((item) => item.lesson)
);

const getTaskDayIndex = (lessonRef) => {
  const explicit = Number(lessonRef?.dayIndex);
  if (Number.isInteger(explicit)) return explicit;
  if (!lessonRef?.date) return null;
  const date = new Date(`${String(lessonRef.date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : (date.getDay() + 6) % 7;
};

const remapTasksForDay = (
  schedule,
  beforeDay,
  afterDay,
  dayIndex,
  sourceByLesson = null,
  replacementSeriesByLesson = null,
) => {
  if (!Array.isArray(schedule.tasks)) return schedule.tasks;

  return schedule.tasks.map((task) => {
    const ref = task?.lessonRef;
    if (!ref || typeof ref !== "object") return task;
    if (ref.scheduleId && schedule.id && ref.scheduleId !== schedule.id) return task;
    if (getTaskDayIndex(ref) !== dayIndex) return task;

    const weekKey = ref.weekKey;
    const before = Array.isArray(beforeDay?.[weekKey]) ? beforeDay[weekKey] : [];
    const after = Array.isArray(afterDay?.[weekKey]) ? afterDay[weekKey] : [];
    let oldIndex = Number(ref.lessonIndex);
    if (ref.seriesId) {
      const seriesIndex = before.findIndex((lesson) => getLessonSeriesId(lesson) === ref.seriesId);
      if (seriesIndex >= 0) oldIndex = seriesIndex;
    }
    if (!Number.isInteger(oldIndex) || before[oldIndex] === undefined) return task;

    const oldLesson = before[oldIndex];
    const seriesId = getLessonSeriesId(oldLesson);
    const replacementSeriesId = replacementSeriesByLesson?.get(oldLesson) || null;
    const targetSeriesId = seriesId || replacementSeriesId;
    let newIndex = targetSeriesId
      ? after.findIndex((lesson) => getLessonSeriesId(lesson) === targetSeriesId)
      : after.findIndex((lesson) => lesson === oldLesson || sourceByLesson?.get(lesson) === oldLesson);

    if (newIndex < 0 && !targetSeriesId) {
      const signature = getLessonSignature(oldLesson);
      const matches = after
        .map((lesson, index) => (getLessonSignature(lesson) === signature ? index : -1))
        .filter((index) => index >= 0);
      if (matches.length === 1) [newIndex] = matches;
    }

    if (newIndex < 0) {
      const nextTask = { ...task };
      delete nextTask.lessonRef;
      return nextTask;
    }

    const nextSeriesId = getLessonSeriesId(after[newIndex]);
    if (newIndex === oldIndex && ref.seriesId === nextSeriesId) return task;
    const nextLessonRef = {
      ...ref,
      lessonIndex: newIndex,
    };
    if (nextSeriesId) nextLessonRef.seriesId = nextSeriesId;
    else delete nextLessonRef.seriesId;

    return {
      ...task,
      lessonRef: nextLessonRef,
    };
  });
};

const materializeLessonTimes = (schedule, lessons, sourceByLesson) => {
  const times = buildLessonTimes(
    schedule?.start_time || "08:30",
    Number(schedule?.duration) || 45,
    Array.isArray(schedule?.breaks) ? schedule.breaks : [],
    lessons,
  );

  return lessons.map((lesson, index) => {
    if (lesson === undefined || lesson === null) return lesson;
    const lessonData = typeof lesson === "object"
      ? lesson
      : { subjectId: String(lesson) };
    const time = times[index] || {};
    const next = {
      ...lessonData,
      startTime: lessonData.startTime || time.start,
      endTime: lessonData.endTime || time.end,
      defaultStartTime: lessonData.defaultStartTime || time.start,
      defaultEndTime: lessonData.defaultEndTime || time.end,
    };
    sourceByLesson.set(next, lesson);
    return next;
  });
};

const addOverride = (lesson, seriesId, schedule) => {
  const existing = normalizeLessonRecurrence(lesson?.recurrence, schedule);
  if (!existing || existing.id === seriesId) return lesson;
  return {
    ...lesson,
    recurrence: {
      ...existing,
      overrides: [...new Set([...(existing.overrides || []), seriesId])],
    },
  };
};

const removeOverride = (lesson, seriesId, schedule) => {
  const recurrence = normalizeLessonRecurrence(lesson?.recurrence, schedule);
  if (!recurrence?.overrides?.includes(seriesId)) return lesson;
  const overrides = recurrence.overrides.filter((id) => id !== seriesId);
  const nextRecurrence = { ...recurrence };
  if (overrides.length > 0) nextRecurrence.overrides = overrides;
  else delete nextRecurrence.overrides;
  return { ...lesson, recurrence: nextRecurrence };
};

const ensureLegacyConflictSeries = (
  schedule,
  day,
  conflictLesson,
  sourceByLesson,
) => {
  const existing = normalizeLessonRecurrence(conflictLesson?.recurrence, schedule);
  if (existing) return { day, recurrence: existing };

  const signature = getLessonSignature(conflictLesson);
  const allWeeks = getAllWeeks(schedule);
  let preferredIndex = -1;
  allWeeks.some((week) => {
    preferredIndex = (day[`week${week}`] || []).indexOf(conflictLesson);
    return preferredIndex >= 0;
  });
  const memberIndices = new Map();
  allWeeks.forEach((week) => {
    const index = findLegacySeriesMemberIndex(day[`week${week}`], signature, preferredIndex);
    if (index >= 0) memberIndices.set(week, index);
  });
  const weeks = [...memberIndices.keys()];
  const recurrence = {
    id: createId(),
    mode: weeks.length === getRepeatCount(schedule) ? "all" : "selected",
    weeks,
  };
  const nextDay = { ...day };
  weeks.forEach((week) => {
    const weekKey = `week${week}`;
    nextDay[weekKey] = (nextDay[weekKey] || []).map((lesson, index) => {
      if (memberIndices.get(week) !== index) return lesson;
      const taggedLesson = { ...lesson, recurrence };
      if (sourceByLesson) {
        sourceByLesson.set(taggedLesson, sourceByLesson.get(lesson) || lesson);
      }
      return taggedLesson;
    });
  });
  return { day: nextDay, recurrence };
};

export const applyLessonRecurrence = (schedule, options) => {
  const {
    dayIndex,
    weekNumber,
    lessonIndex,
    lesson,
    selection,
    previousSelection,
  } = options;
  if (!schedule || !Number.isInteger(dayIndex) || !lesson || typeof lesson !== "object") return schedule;

  const repeatWeeks = getAllWeeks(schedule);
  if (!repeatWeeks.includes(weekNumber)) return schedule;
  const requestedWeeks = selection?.mode === "all"
    ? repeatWeeks
    : normalizeWeeks(selection?.weeks, schedule);
  const weeks = requestedWeeks.length > 0 ? requestedWeeks : [weekNumber];
  const recurrenceId = selection?.id || previousSelection?.id || getLessonSeriesId(lesson) || createId();
  const mode = selection?.mode === "all" ? "all" : "selected";
  const sourceWeekKey = `week${weekNumber}`;
  const beforeDay = schedule.schedule?.[dayIndex] || {};
  let nextDay = { ...beforeDay };
  const sourceByLesson = new Map();
  repeatWeeks.forEach((week) => {
    const key = `week${week}`;
    const lessons = Array.isArray(beforeDay[key]) ? beforeDay[key] : [];
    nextDay[key] = materializeLessonTimes(schedule, lessons, sourceByLesson);
  });

  const previousWeeks = previousSelection?.mode === "all"
    ? repeatWeeks
    : normalizeWeeks(previousSelection?.weeks, schedule);
  const sourceLesson = beforeDay?.[sourceWeekKey]?.[lessonIndex];
  const sourceSignature = sourceLesson ? getLessonSignature(sourceLesson) : null;
  const replacementSeriesByLesson = new Map();
  const legacyMemberIndices = new Map();

  if (sourceSignature) {
    previousWeeks.forEach((week) => {
      const key = `week${week}`;
      const index = findLegacySeriesMemberIndex(beforeDay[key], sourceSignature, lessonIndex);
      if (index >= 0) legacyMemberIndices.set(key, index);
    });
  }

  repeatWeeks.forEach((week) => {
    const key = `week${week}`;
    const lessons = Array.isArray(beforeDay[key]) ? beforeDay[key] : [];
    lessons.forEach((item, index) => {
      const belongsToSeries = getLessonSeriesId(item) === recurrenceId;
      const isSource = key === sourceWeekKey && Number.isInteger(lessonIndex) && index === lessonIndex;
      const isLegacySeriesMember = legacyMemberIndices.get(key) === index;
      if (belongsToSeries || isSource || isLegacySeriesMember) {
        replacementSeriesByLesson.set(item, recurrenceId);
      }
    });
  });

  repeatWeeks.forEach((week) => {
    const key = `week${week}`;
    nextDay[key] = nextDay[key].filter((item, index) => {
      if (getLessonSeriesId(item) === recurrenceId) return false;
      if (key === sourceWeekKey && Number.isInteger(lessonIndex) && index === lessonIndex) return false;
      return legacyMemberIndices.get(key) !== index;
    });
  });

  repeatWeeks.forEach((week) => {
    const key = `week${week}`;
    const existing = (beforeDay[key] || []).find((item) => getLessonSeriesId(item) === recurrenceId);
    const recurrence = normalizeLessonRecurrence(existing?.recurrence, schedule);
    nextDay = restoreOverridesForWeek(schedule, nextDay, week, recurrence?.overrides);
  });

  for (const week of weeks) {
    const key = `week${week}`;
    let weekLessons = nextDay[key];
    let recurrenceOverrides = [];
    const candidateRecurrence = {
      id: recurrenceId,
      mode,
      weeks,
      ...(recurrenceOverrides.length > 0 ? { overrides: recurrenceOverrides } : {}),
    };
    const candidate = { ...lesson, recurrence: candidateRecurrence };
    const candidateRange = getLessonRange(schedule, [candidate], 0);
    let suppressCandidate = false;

    for (let index = 0; index < weekLessons.length; index += 1) {
      const conflictRange = getLessonRange(schedule, weekLessons, index);
      if (!rangesOverlap(candidateRange, conflictRange)) continue;

      const ensured = ensureLegacyConflictSeries(
        schedule,
        nextDay,
        weekLessons[index],
        sourceByLesson,
      );
      nextDay = ensured.day;
      weekLessons = nextDay[key];
      const conflictIndex = weekLessons.findIndex((item) => (
        getLessonSeriesId(item) === ensured.recurrence.id
        && rangesOverlap(candidateRange, getLessonRange(schedule, weekLessons, weekLessons.indexOf(item)))
      ));
      if (conflictIndex < 0) continue;

      const conflict = weekLessons[conflictIndex];
      const conflictRecurrence = normalizeLessonRecurrence(conflict.recurrence, schedule);
      if (mode === "all" && conflictRecurrence?.mode === "selected") {
        weekLessons[conflictIndex] = addOverride(conflict, recurrenceId, schedule);
        nextDay[key] = weekLessons;
        suppressCandidate = true;
        break;
      }

      if (mode === "selected" && conflictRecurrence?.mode === "all") {
        recurrenceOverrides = [...new Set([...recurrenceOverrides, conflictRecurrence.id])];
        weekLessons.splice(conflictIndex, 1);
        index -= 1;
      }
    }

    if (!suppressCandidate) {
      weekLessons = weekLessons.map((item) => removeOverride(item, recurrenceId, schedule));
      nextDay[key] = sortLessons(schedule, [
        ...weekLessons,
        {
          ...lesson,
          recurrence: {
            id: recurrenceId,
            mode,
            weeks,
            ...(recurrenceOverrides.length > 0 ? { overrides: recurrenceOverrides } : {}),
          },
        },
      ]);
    }
  }

  repeatWeeks.filter((week) => !weeks.includes(week)).forEach((week) => {
    const key = `week${week}`;
    nextDay[key] = nextDay[key].map((item) => removeOverride(item, recurrenceId, schedule));
  });

  const nextGrid = [...(schedule.schedule || [])];
  nextGrid[dayIndex] = nextDay;
  const nextSchedule = { ...schedule, schedule: nextGrid };
  if (Array.isArray(schedule.tasks)) {
    nextSchedule.tasks = remapTasksForDay(
      schedule,
      beforeDay,
      nextDay,
      dayIndex,
      sourceByLesson,
      replacementSeriesByLesson,
    );
  }
  return nextSchedule;
};

const restoreOverridesForWeek = (schedule, day, weekNumber, overrideIds) => {
  if (!Array.isArray(overrideIds) || overrideIds.length === 0) return day;
  const weekKey = `week${weekNumber}`;
  let nextDay = { ...day, [weekKey]: [...(day[weekKey] || [])] };

  overrideIds.forEach((seriesId) => {
    if (nextDay[weekKey].some((lesson) => getLessonSeriesId(lesson) === seriesId)) return;
    let template = null;
    Object.values(nextDay).some((lessons) => {
      if (!Array.isArray(lessons)) return false;
      template = lessons.find((lesson) => getLessonSeriesId(lesson) === seriesId) || null;
      return !!template;
    });
    const recurrence = normalizeLessonRecurrence(template?.recurrence, schedule);
    if (!template || !recurrence?.weeks.includes(weekNumber)) return;
    nextDay[weekKey] = sortLessons(schedule, [
      ...nextDay[weekKey],
      { ...template, recurrence: { ...recurrence, overrides: undefined } },
    ]);
  });

  return nextDay;
};

const getWeeklySeriesTemplates = (schedule, day) => {
  const templates = new Map();
  Object.entries(day || {}).forEach(([weekKey, lessons]) => {
    if (!/^week\d+$/.test(weekKey) || !Array.isArray(lessons)) return;
    lessons.forEach((lesson) => {
      const recurrence = normalizeLessonRecurrence(lesson?.recurrence, schedule);
      if (recurrence?.mode === "all" && !templates.has(recurrence.id)) {
        templates.set(recurrence.id, { ...lesson, recurrence });
      }
    });
  });
  return templates;
};

export const reconcileScheduleRepeat = (schedule, previousRepeat = schedule?.repeat) => {
  if (!schedule || typeof schedule !== "object") return schedule;

  const repeat = normalizeScheduleRepeat(schedule.repeat);
  const normalizedSchedule = { ...schedule, repeat };
  if (
    (
      normalizeScheduleRepeat(previousRepeat) === repeat
      && Number(previousRepeat) === repeat
    )
    || !Array.isArray(schedule.schedule)
  ) {
    return normalizedSchedule;
  }

  const weeks = getAllWeeks(normalizedSchedule);
  const nextGrid = schedule.schedule.map((day) => {
    const beforeDay = day && typeof day === "object" ? day : {};
    const templates = getWeeklySeriesTemplates(normalizedSchedule, beforeDay);
    const nextDay = Object.fromEntries(
      Object.entries(beforeDay).filter(([key]) => !/^week\d+$/.test(key)),
    );

    weeks.forEach((week) => {
      const weekKey = `week${week}`;
      const existingLessons = Array.isArray(beforeDay[weekKey]) ? beforeDay[weekKey] : [];
      let weekLessons = existingLessons.map((lesson) => {
        const recurrence = normalizeLessonRecurrence(lesson?.recurrence, normalizedSchedule);
        if (!recurrence) return lesson;
        if (recurrence.mode === "selected" && !recurrence.weeks.includes(week)) return null;
        return { ...lesson, recurrence };
      }).filter(Boolean);

      templates.forEach((template, seriesId) => {
        if (weekLessons.some((lesson) => getLessonSeriesId(lesson) === seriesId)) return;
        const isOverridden = weekLessons.some((lesson) => {
          const recurrence = normalizeLessonRecurrence(lesson?.recurrence, normalizedSchedule);
          return recurrence?.mode === "selected" && recurrence.overrides?.includes(seriesId);
        });
        if (isOverridden) return;

        weekLessons = sortLessons(normalizedSchedule, [
          ...weekLessons,
          {
            ...template,
            recurrence: {
              ...template.recurrence,
              mode: "all",
              weeks,
            },
          },
        ]);
      });

      nextDay[weekKey] = weekLessons;
    });

    return nextDay;
  });

  const nextSchedule = { ...normalizedSchedule, schedule: nextGrid };
  if (Array.isArray(schedule.tasks)) {
    nextSchedule.tasks = nextGrid.reduce(
      (tasks, afterDay, dayIndex) => remapTasksForDay(
        { ...normalizedSchedule, tasks },
        schedule.schedule[dayIndex] || {},
        afterDay,
        dayIndex,
      ),
      schedule.tasks,
    );
  }

  return nextSchedule;
};

export const deleteLessonRecurrence = (schedule, options) => {
  const { dayIndex, weekNumber, lessonIndex, scope = "occurrence" } = options;
  if (!getAllWeeks(schedule).includes(weekNumber)) return null;
  const weekKey = `week${weekNumber}`;
  const beforeDay = schedule?.schedule?.[dayIndex];
  const target = beforeDay?.[weekKey]?.[lessonIndex];
  if (!target) return schedule;

  const recurrence = normalizeLessonRecurrence(target.recurrence, schedule);
  if (!recurrence) return null;

  let nextDay = { ...beforeDay };
  const overridesByWeek = new Map();
  getAllWeeks(schedule).forEach((week) => {
    const key = `week${week}`;
    const lessons = Array.isArray(beforeDay[key]) ? beforeDay[key] : [];
    const member = lessons.find((lesson) => getLessonSeriesId(lesson) === recurrence.id);
    const memberRecurrence = normalizeLessonRecurrence(member?.recurrence, schedule);
    if (memberRecurrence?.overrides?.length > 0) {
      overridesByWeek.set(week, memberRecurrence.overrides);
    }
    nextDay[key] = scope === "series"
      ? lessons.filter((lesson) => getLessonSeriesId(lesson) !== recurrence.id)
      : (key === weekKey ? lessons.filter((_, index) => index !== lessonIndex) : [...lessons]);
  });

  if (scope === "occurrence") {
    const remainingWeeks = recurrence.weeks.filter((week) => week !== weekNumber);
    getAllWeeks(schedule).forEach((week) => {
      const key = `week${week}`;
      nextDay[key] = nextDay[key].map((lesson) => {
        if (getLessonSeriesId(lesson) !== recurrence.id) return lesson;
        return {
          ...lesson,
          recurrence: {
            ...lesson.recurrence,
            mode: "selected",
            weeks: remainingWeeks,
          },
        };
      });
    });
  } else {
    getAllWeeks(schedule).forEach((week) => {
      const key = `week${week}`;
      nextDay[key] = nextDay[key].map((lesson) => {
        const itemRecurrence = normalizeLessonRecurrence(lesson.recurrence, schedule);
        if (!itemRecurrence?.overrides?.includes(recurrence.id)) return lesson;
        const overrides = itemRecurrence.overrides.filter((id) => id !== recurrence.id);
        return {
          ...lesson,
          recurrence: {
            ...itemRecurrence,
            ...(overrides.length > 0 ? { overrides } : { overrides: undefined }),
          },
        };
      });
    });
  }

  const affectedWeeks = scope === "series" ? recurrence.weeks : [weekNumber];
  affectedWeeks.forEach((week) => {
    const overrideIds = scope === "series"
      ? overridesByWeek.get(week)
      : recurrence.overrides;
    nextDay = restoreOverridesForWeek(schedule, nextDay, week, overrideIds);
  });

  const nextGrid = [...schedule.schedule];
  nextGrid[dayIndex] = nextDay;
  const nextSchedule = { ...schedule, schedule: nextGrid };
  if (Array.isArray(schedule.tasks)) {
    nextSchedule.tasks = remapTasksForDay(schedule, beforeDay, nextDay, dayIndex);
  }
  return nextSchedule;
};

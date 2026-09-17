import { deleteLessonRecurrence } from "./lessonRecurrence";

const removeIdFromList = (value, id) => {
  if (!Array.isArray(value)) return value;
  const next = value.filter((itemId) => itemId !== id);
  return next.length > 0 ? next : undefined;
};

const removeEntityReferencesFromLesson = (lesson, collection, id) => {
  if (!lesson) return lesson;
  if (typeof lesson !== "object") {
    return collection === "subjects" && String(lesson) === String(id)
      ? { subjectDeleted: true }
      : lesson;
  }

  const next = { ...lesson };

  if (collection === "subjects" && next.subjectId === id) {
    delete next.subjectId;
    next.subjectDeleted = true;
  }

  if (collection === "teachers") {
    if (next.teacher === id) delete next.teacher;
    const teachers = removeIdFromList(next.teachers, id);
    if (teachers) next.teachers = teachers;
    else delete next.teachers;
  }

  if (collection === "links") {
    if (next.link === id) delete next.link;
    const links = removeIdFromList(next.links, id);
    if (links) next.links = links;
    else delete next.links;
  }

  if (collection === "gradients" && next.gradient === id) {
    delete next.gradient;
  }

  return next;
};

const removeEntityReferencesFromSubject = (subject, collection, id) => {
  if (!subject || typeof subject !== "object") return subject;

  const next = { ...subject };

  if (collection === "teachers") {
    if (next.teacher === id) delete next.teacher;
    const teachers = removeIdFromList(next.teachers, id);
    if (teachers) next.teachers = teachers;
    else delete next.teachers;
  }

  if (collection === "links") {
    if (next.link === id) delete next.link;
    const links = removeIdFromList(next.links, id);
    if (links) next.links = links;
    else delete next.links;
  }

  if (collection === "gradients" && next.colorGradient === id) {
    delete next.colorGradient;
    if (next.typeColor === "gradient") delete next.typeColor;
  }

  return next;
};

export const removeScheduleEntity = (schedule, collection, id) => {
  if (!schedule || !id || !["subjects", "teachers", "links", "gradients"].includes(collection)) {
    return schedule;
  }

  const next = {
    ...schedule,
    [collection]: Array.isArray(schedule[collection])
      ? schedule[collection].filter((item) => item?.id !== id)
      : [],
  };

  if (Array.isArray(schedule.schedule)) {
    next.schedule = schedule.schedule.map((day) => {
      if (!day || typeof day !== "object") return day;
      return Object.fromEntries(
        Object.entries(day).map(([weekKey, lessons]) => [
          weekKey,
          Array.isArray(lessons)
            ? lessons.map((lesson) => removeEntityReferencesFromLesson(lesson, collection, id))
            : lessons,
        ]),
      );
    });
  }

  if (Array.isArray(schedule.subjects)) {
    next.subjects = next.subjects.map((subject) => (
      removeEntityReferencesFromSubject(subject, collection, id)
    ));
  }

  if (Array.isArray(schedule.tasks)) {
    next.tasks = schedule.tasks.map((task) => {
      if (!task || typeof task !== "object") return task;

      let nextTask = task;

      if (collection === "subjects") {
        const subjectMatches = task.subjectId === id;
        const lessonSubjectMatches = task.lessonRef?.subjectId === id;
        if (subjectMatches || lessonSubjectMatches) {
          nextTask = { ...task };
          if (subjectMatches) nextTask.subjectId = null;
          if (lessonSubjectMatches) {
            nextTask.lessonRef = { ...task.lessonRef };
            delete nextTask.lessonRef.subjectId;
          }
        }
      }

      if (collection === "links") {
        const links = removeIdFromList(task.links, id);
        if (links !== task.links) {
          nextTask = { ...nextTask, links: links || [] };
        }
      }

      return nextTask;
    });
  }

  return next;
};

const getTaskLessonDayIndex = (lessonRef) => {
  if (
    lessonRef?.dayIndex !== undefined
    && lessonRef?.dayIndex !== null
    && Number.isInteger(Number(lessonRef.dayIndex))
  ) {
    return Number(lessonRef.dayIndex);
  }
  if (!lessonRef?.date) return null;

  const date = new Date(`${String(lessonRef.date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getDay() + 6) % 7;
};

const updateTaskAfterLessonDeletion = (task, scheduleId, dayIndex, weekKey, lessonIndex) => {
  const lessonRef = task?.lessonRef;
  if (!lessonRef || typeof lessonRef !== "object") return task;
  if (scheduleId && lessonRef.scheduleId && lessonRef.scheduleId !== scheduleId) return task;
  if (lessonRef.weekKey && lessonRef.weekKey !== weekKey) return task;

  const referenceDayIndex = getTaskLessonDayIndex(lessonRef);
  if (referenceDayIndex === null || referenceDayIndex !== dayIndex) return task;

  const referenceIndex = Number(lessonRef.lessonIndex);
  if (!Number.isInteger(referenceIndex)) return task;

  if (referenceIndex === lessonIndex) {
    const next = { ...task };
    delete next.lessonRef;
    return next;
  }

  if (referenceIndex > lessonIndex) {
    return {
      ...task,
      lessonRef: {
        ...lessonRef,
        lessonIndex: referenceIndex - 1,
      },
    };
  }

  return task;
};

export const deleteScheduleLesson = (schedule, dayIndex, weekKey, lessonIndex, scope = "occurrence") => {
  const weekMatch = String(weekKey || "").match(/^week(\d+)$/);
  const recurringResult = weekMatch
    ? deleteLessonRecurrence(schedule, {
      dayIndex,
      weekNumber: Number(weekMatch[1]),
      lessonIndex,
      scope,
    })
    : null;
  if (recurringResult) return recurringResult;

  const lessons = schedule?.schedule?.[dayIndex]?.[weekKey];
  if (!Array.isArray(lessons) || !Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= lessons.length) {
    return schedule;
  }

  const nextLessons = lessons.filter((_, index) => index !== lessonIndex);
  const nextGrid = [...schedule.schedule];
  nextGrid[dayIndex] = {
    ...nextGrid[dayIndex],
    [weekKey]: nextLessons,
  };

  const next = {
    ...schedule,
    schedule: nextGrid,
  };

  if (Array.isArray(schedule.tasks)) {
    next.tasks = schedule.tasks.map((task) => (
      updateTaskAfterLessonDeletion(task, schedule.id, dayIndex, weekKey, lessonIndex)
    ));
  }

  return next;
};

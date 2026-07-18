const normalizePrimitive = (value) => {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "object") return "";
  return String(value);
};

const getReminderFingerprint = (reminder) => {
  if (!reminder || typeof reminder !== "object" || Array.isArray(reminder)) return "";
  const enabled = reminder.enabled === true || reminder.enabled === "true";
  if (!enabled) {
    return reminder.enabled === false || reminder.enabled === "false" ? "off" : "";
  }
  return `on:${normalizePrimitive(reminder.minutesBefore)}`;
};

const getNotificationPreferencesFingerprint = (preferences) => {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return "";
  const pushByType = preferences.pushByType || {};

  return Object.keys(pushByType)
    .sort()
    .map((type) => `${type}:${pushByType[type] === true ? 1 : 0}`)
    .join(",");
};

const countLessons = (scheduleGrid) => {
  if (!Array.isArray(scheduleGrid)) return 0;

  return scheduleGrid.reduce((total, day) => {
    if (!day || typeof day !== "object") return total;

    return total + Object.keys(day).reduce((dayTotal, weekKey) => {
      const weekLessons = day[weekKey];
      return dayTotal + (Array.isArray(weekLessons) ? weekLessons.length : 0);
    }, 0);
  }, 0);
};

const getArrayItemsFingerprint = (items, keys) => {
  if (!Array.isArray(items)) return "";

  return items
    .map((item = {}) => keys.map((key) => (
      key === "reminder" ? getReminderFingerprint(item[key]) : normalizePrimitive(item[key])
    )).join(","))
    .sort()
    .join(";");
};

const getLessonsFingerprint = (scheduleGrid) => {
  if (!Array.isArray(scheduleGrid)) return "";

  const lessonParts = [];
  scheduleGrid.forEach((day, dayIndex) => {
    if (!day || typeof day !== "object") return;

    Object.keys(day).forEach((weekKey) => {
      const weekLessons = day[weekKey];
      if (!Array.isArray(weekLessons)) return;

      weekLessons.forEach((lesson = {}, lessonIndex) => {
        lessonParts.push([
          dayIndex,
          weekKey,
          lessonIndex,
          lesson.id,
          lesson.subjectId,
          lesson.type,
          lesson.room,
          lesson.building,
          lesson.start,
          lesson.end,
          lesson.startTime,
          lesson.endTime,
          lesson.timeInfo?.start,
          lesson.timeInfo?.end,
          Array.isArray(lesson.teachers) ? lesson.teachers.join(",") : lesson.teacher,
          Array.isArray(lesson.links) ? lesson.links.join(",") : lesson.link,
          lesson.note,
          lesson.color,
          lesson.gradient,
        ].map(normalizePrimitive).join(","));
      });
    });
  });

  return lessonParts.join(";");
};

const getTasksFingerprint = (tasks) => {
  if (!Array.isArray(tasks)) return "";

  return tasks
    .map((task = {}) => {
      const taskLinks = Array.isArray(task.links)
        ? task.links.map(normalizePrimitive).sort().join(",")
        : "";
      const lessonRef = task.lessonRef && typeof task.lessonRef === "object" && !Array.isArray(task.lessonRef)
        ? [
          task.lessonRef.scheduleId,
          task.lessonRef.subjectId,
          task.lessonRef.date,
          task.lessonRef.dayIndex,
          task.lessonRef.weekKey,
          task.lessonRef.lessonIndex,
          task.lessonRef.start,
          task.lessonRef.end,
        ].map(normalizePrimitive).join(",")
        : "";

      return [
        task.id,
        task.subjectId,
        task.text,
        task.completed === true ? 1 : 0,
        task.createdAt,
        task.updatedAt,
        taskLinks,
        lessonRef,
      ].map(normalizePrimitive).join(",");
    })
    .sort()
    .join(";");
};

const getGlobalFingerprint = (global = {}) => {
  const keys = [
    "version",
    "baseVersion",
    "lastModified",
    "lastSynced",
    "watermark",
    "currentScheduleId",
    "language",
    "theme",
    "blur",
    "navigationStyle",
    "navigationLabels",
    "navigationAnimations",
    "hapticsEnabled",
    "starting_week",
    "notificationPreferences",
  ];

  return keys.map((key) => {
    const value = key === "notificationPreferences"
      ? getNotificationPreferencesFingerprint(global?.[key])
      : normalizePrimitive(global?.[key]);
    return `${key}:${value}`;
  }).join(";");
};

const getScheduleFingerprint = (schedule = {}) => {
  const keyParts = [
    schedule.id,
    schedule.version || 0,
    schedule.baseVersion || 0,
    schedule.lastModified || 0,
    schedule.lastSynced || 0,
    schedule.isDeleted ? 1 : 0,
    schedule.deletedAt || 0,
    schedule.name || "",
    schedule.repeat || "",
    schedule.start_time || "",
    schedule.duration || "",
    schedule.taskAutoLinkMode || "",
    getReminderFingerprint(schedule.reminder),
    Array.isArray(schedule.breaks) ? schedule.breaks.join(",") : "",
    Array.isArray(schedule.subjects) ? schedule.subjects.length : 0,
    getArrayItemsFingerprint(schedule.subjects, ["id", "name", "shortName", "type", "room", "building", "color", "colorGradient", "reminder"]),
    Array.isArray(schedule.teachers) ? schedule.teachers.length : 0,
    getArrayItemsFingerprint(schedule.teachers, ["id", "name", "shortName", "email", "phone"]),
    Array.isArray(schedule.links) ? schedule.links.length : 0,
    getArrayItemsFingerprint(schedule.links, ["id", "name", "url"]),
    Array.isArray(schedule.gradients) ? schedule.gradients.length : 0,
    getArrayItemsFingerprint(schedule.gradients, ["id", "name", "colors"]),
    Array.isArray(schedule.tasks) ? schedule.tasks.length : 0,
    getTasksFingerprint(schedule.tasks),
    countLessons(schedule.schedule),
    getLessonsFingerprint(schedule.schedule),
  ];

  return keyParts.map(normalizePrimitive).join(":");
};

export const getScheduleDataFingerprint = (data) => {
  if (!data) return "null";

  const schedules = Array.isArray(data.schedules) ? data.schedules : [];
  const schedulesFingerprint = schedules
    .map(getScheduleFingerprint)
    .sort()
    .join("|");

  return [
    `global{${getGlobalFingerprint(data.global || {})}`,
    `schedules:${schedules.length}`,
    schedulesFingerprint,
  ].join("}");
};

export const hasScheduleDataChanged = (previousData, nextData) => (
  getScheduleDataFingerprint(previousData) !== getScheduleDataFingerprint(nextData)
);

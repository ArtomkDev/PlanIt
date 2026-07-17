const ARRAY_FIELDS = [
  "schedule",
  "subjects",
  "teachers",
  "links",
  "gradients",
  "tasks",
  "breaks",
];

export const isValidDateValue = (value) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const isValidRepeatValue = (value) => {
  const repeat = Number(value);
  return Number.isFinite(repeat) && repeat > 0;
};

const getArrayScore = (schedule, field) => (
  Array.isArray(schedule?.[field]) ? Math.min(schedule[field].length, 8) : 0
);

const getCompletenessScore = (schedule) => {
  if (!schedule) return 0;

  return [
    isValidDateValue(schedule.starting_week) ? 4 : 0,
    isValidRepeatValue(schedule.repeat) ? 2 : 0,
    ...ARRAY_FIELDS.map((field) => getArrayScore(schedule, field)),
  ].reduce((total, score) => total + score, 0);
};

export const withStartingWeekFallback = (sourceSchedule, global) => {
  if (!sourceSchedule) return sourceSchedule;
  if (isValidDateValue(sourceSchedule.starting_week) || !isValidDateValue(global?.starting_week)) {
    return sourceSchedule;
  }
  return { ...sourceSchedule, starting_week: global.starting_week };
};

const chooseStartingWeek = (primary, secondary) => {
  if (isValidDateValue(primary?.starting_week)) return primary.starting_week;
  if (isValidDateValue(secondary?.starting_week)) return secondary.starting_week;
  return primary?.starting_week || secondary?.starting_week;
};

export const mergeScheduleRecords = (existingSchedule, incomingSchedule, global) => {
  const incoming = withStartingWeekFallback(incomingSchedule, global);
  if (!incoming?.id) return existingSchedule || null;
  if (!existingSchedule) return incoming;

  const existing = withStartingWeekFallback(existingSchedule, global);
  const incomingModified = Number(incoming.lastModified) || 0;
  const existingModified = Number(existing.lastModified) || 0;
  const incomingScore = getCompletenessScore(incoming);
  const existingScore = getCompletenessScore(existing);
  const incomingWins = incomingModified > existingModified
    || (incomingModified === existingModified && incomingScore >= existingScore);

  const primary = incomingWins ? incoming : existing;
  const secondary = incomingWins ? existing : incoming;
  const merged = { ...secondary, ...primary };
  const startingWeek = chooseStartingWeek(primary, secondary);

  if (startingWeek) merged.starting_week = startingWeek;

  if (!isValidRepeatValue(merged.repeat) && isValidRepeatValue(secondary.repeat)) {
    merged.repeat = secondary.repeat;
  }

  ARRAY_FIELDS.forEach((field) => {
    if (!Array.isArray(merged[field]) && Array.isArray(secondary[field])) {
      merged[field] = secondary[field];
    }
  });

  return merged;
};

export const addScheduleRecordToMap = (map, schedule, global) => {
  if (!schedule?.id) return;
  const merged = mergeScheduleRecords(map.get(schedule.id), schedule, global);
  if (merged?.id) map.set(merged.id, merged);
};

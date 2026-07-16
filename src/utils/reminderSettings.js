export const REMINDER_PRESET_MINUTES = [5, 10, 15, 30, 60];
export const REMINDER_MINUTES_MIN = 0;
export const REMINDER_MINUTES_MAX = 1440;
export const DEFAULT_REMINDER_MINUTES = 30;
export const CUSTOM_REMINDER_FALLBACK_MINUTES = 45;

export const DEFAULT_SCHEDULE_REMINDER = Object.freeze({ enabled: false });

export const clampReminderMinutes = (value, fallback = DEFAULT_REMINDER_MINUTES) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(REMINDER_MINUTES_MAX, Math.max(REMINDER_MINUTES_MIN, Math.round(number)));
};

const isReminderObject = (value) => (
  value && typeof value === "object" && !Array.isArray(value)
);

export const normalizeReminder = (value, options = {}) => {
  if (!isReminderObject(value)) return undefined;

  const enabled = value.enabled === true || value.enabled === "true";
  const disabled = value.enabled === false || value.enabled === "false";

  if (enabled) {
    return {
      enabled: true,
      minutesBefore: clampReminderMinutes(
        value.minutesBefore,
        options.enabledFallbackMinutes ?? DEFAULT_REMINDER_MINUTES
      ),
    };
  }

  if (disabled) {
    return { enabled: false };
  }

  return undefined;
};

export const normalizeScheduleReminder = (value) => (
  normalizeReminder(value) || { ...DEFAULT_SCHEDULE_REMINDER }
);

export const normalizeSubjectReminder = (value) => normalizeReminder(value);

export const resolveEffectiveReminder = (scheduleReminder, subjectReminder) => (
  normalizeSubjectReminder(subjectReminder) || normalizeScheduleReminder(scheduleReminder)
);

export const getReminderSelectionId = (reminder, inheritId = "default") => {
  const normalized = normalizeSubjectReminder(reminder);
  if (!normalized) return inheritId;
  if (!normalized.enabled) return "off";
  if (REMINDER_PRESET_MINUTES.includes(normalized.minutesBefore)) {
    return String(normalized.minutesBefore);
  }
  return "custom";
};

export const getScheduleReminderSelectionId = (reminder) => {
  const normalized = normalizeScheduleReminder(reminder);
  if (!normalized.enabled) return "off";
  if (REMINDER_PRESET_MINUTES.includes(normalized.minutesBefore)) {
    return String(normalized.minutesBefore);
  }
  return "custom";
};

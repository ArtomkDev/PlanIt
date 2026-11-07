import { t } from "./i18n";

export const DEFAULT_SCHEDULE_NAME_KEY = "common.default_schedule";

// Unnamed schedules store one of these and are displayed in the current UI language.
const DEFAULT_SCHEDULE_NAMES = new Set([
  "Основний розклад",
  "Main schedule",
  "Назва розкладу",
  "Schedule name",
]);

export const isDefaultScheduleName = (name) => (
  typeof name === "string" && DEFAULT_SCHEDULE_NAMES.has(name.trim())
);

export const getScheduleDisplayName = (
  schedule,
  lang,
  fallback = t("common.untitled", lang)
) => {
  const nameKey = typeof schedule?.nameKey === "string" ? schedule.nameKey.trim() : "";
  if (nameKey) return t(nameKey, lang);

  const name = typeof schedule?.name === "string" ? schedule.name.trim() : "";
  if (!name) return fallback;

  if (isDefaultScheduleName(name)) {
    return t(DEFAULT_SCHEDULE_NAME_KEY, lang);
  }

  return name;
};

import { t } from "./i18n";

export const DEFAULT_SCHEDULE_NAME_KEY = "common.default_schedule";

const LEGACY_DEFAULT_SCHEDULE_NAMES = new Set([
  "Основний розклад",
  "Main schedule",
]);

export const getScheduleDisplayName = (
  schedule,
  lang,
  fallback = t("settings.schedule_switcher.untitled", lang)
) => {
  const nameKey = typeof schedule?.nameKey === "string" ? schedule.nameKey.trim() : "";
  if (nameKey) return t(nameKey, lang);

  const name = typeof schedule?.name === "string" ? schedule.name.trim() : "";
  if (!name) return fallback;

  if (LEGACY_DEFAULT_SCHEDULE_NAMES.has(name)) {
    return t(DEFAULT_SCHEDULE_NAME_KEY, lang);
  }

  return name;
};

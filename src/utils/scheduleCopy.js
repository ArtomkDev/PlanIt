import { generateId } from './idGenerator';
import { getScheduleDisplayName } from './scheduleDisplay';
import { t } from './i18n';
import { assignScheduleId } from './scheduleIdentity';

export function createScheduleCopy(schedule, existingSchedules, lang) {
  const copy = assignScheduleId(JSON.parse(JSON.stringify(schedule)), generateId());
  const baseName = t('settings.schedule_switcher.copy_name', lang, {
    name: getScheduleDisplayName(schedule, lang),
  });
  const names = new Set(existingSchedules.filter(item => !item.isDeleted)
    .map(item => getScheduleDisplayName(item, lang)));
  let name = baseName;
  let number = 2;
  while (names.has(name)) name = `${baseName} (${number++})`;

  copy.name = name;
  delete copy.nameKey;
  delete copy.deletedAt;
  copy.isDeleted = false;
  copy.version = 0;
  copy.baseVersion = 0;
  copy.lastModified = Date.now();
  copy.lastSynced = 0;
  return copy;
}

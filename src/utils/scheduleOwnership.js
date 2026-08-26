const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const MIGRATION_HANDLED_KEY = 'cloudMigrationOfferHandled';

export const isSchedulePendingCloudMigration = (schedule) => {
  if (!schedule || schedule.isDeleted) return false;
  if (hasOwn(schedule, 'needsCloudMigration')) {
    return schedule.needsCloudMigration === true;
  }
  if (schedule[MIGRATION_HANDLED_KEY] === true) return false;
  if (hasOwn(schedule, 'isCloud')) return schedule.isCloud === false;
  // Before the explicit flag existed, guest schedules had no ownership marker.
  // This function is only used for the guest store, so offer those legacy
  // schedules once and persist MIGRATION_HANDLED_KEY immediately.
  return true;
};

export const clearCloudMigrationFlag = (schedule) => {
  const {
    needsCloudMigration: _pending,
    isCloud: _legacyCloud,
    [MIGRATION_HANDLED_KEY]: _handled,
    ...clean
  } = schedule || {};
  return clean;
};

const markCloudMigrationOfferHandled = (schedule) => ({
  ...clearCloudMigrationFlag(schedule),
  [MIGRATION_HANDLED_KEY]: true,
});

export const markScheduleAsDeviceLocal = (schedule, options = {}) => (
  options.offerCloudMigration === false
    ? markCloudMigrationOfferHandled(schedule)
    : {
      ...clearCloudMigrationFlag(schedule),
      needsCloudMigration: true,
    }
);

export const markScheduleAsAccountOwned = (schedule) => clearCloudMigrationFlag(schedule);

export const getPendingCloudMigrationSchedules = (data) => (
  (data?.schedules || []).filter(isSchedulePendingCloudMigration)
);

export const consumeCloudMigrationOffers = (data) => ({
  ...data,
  schedules: (data?.schedules || []).map(markCloudMigrationOfferHandled),
});

export const finalizeCloudMigration = (data, selectedIds, now = Date.now()) => {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const consumed = consumeCloudMigrationOffers(data);
  return {
    ...consumed,
    schedules: consumed.schedules.map((schedule) => {
      if (!selected.has(schedule?.id)) return schedule;
      return {
        ...schedule,
        isDeleted: true,
        deletedAt: now,
        lastModified: now,
      };
    }),
  };
};

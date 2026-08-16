import { getScheduleDataFingerprint } from './scheduleDataFingerprint';

const SYNC_META_KEYS = new Set([
  'version',
  'baseVersion',
  'lastModified',
  'lastSynced',
  'watermark',
  'watermarkUpdatedAt',
]);

const withoutSyncMetadata = (entity = {}) => {
  const result = {};
  Object.keys(entity || {}).forEach((key) => {
    if (!SYNC_META_KEYS.has(key)) result[key] = entity[key];
  });
  return result;
};

const contentChanged = (left, right) => (
  getScheduleDataFingerprint(withoutSyncMetadata(left)) !==
  getScheduleDataFingerprint(withoutSyncMetadata(right))
);

export const nextLogicalTimestamp = (entity = {}, now = Date.now()) => (
  Math.max(
    Number(now) || 0,
    (Number(entity.lastModified) || 0) + 1,
    (Number(entity.lastSynced) || 0) + 1,
  )
);

export const isSyncEntityDirty = (entity) => !!entity && (
  (Number(entity.lastModified) || 0) > (Number(entity.lastSynced) || 0)
);

export const getCloudSubscriptionUserId = ({
  guest = false,
  userId = null,
  isLoading = true,
  loadedScopeKey = null,
} = {}) => {
  if (guest || !userId || isLoading || loadedScopeKey !== userId) return null;
  return userId;
};

const markEntityDirty = (previous, next, now) => {
  if (!next) return next;
  if (!previous) {
    return {
      ...next,
      version: Number(next.version) || 0,
      baseVersion: Number(next.baseVersion) || 0,
      lastModified: nextLogicalTimestamp(next, now),
      lastSynced: 0,
    };
  }
  if (!contentChanged(previous, next)) return next;
  return {
    ...next,
    version: Number(previous.version) || Number(next.version) || 1,
    baseVersion: Number(previous.baseVersion) || Number(previous.version) || 1,
    lastModified: nextLogicalTimestamp({
      lastModified: Math.max(
        Number(previous.lastModified) || 0,
        Number(next.lastModified) || 0,
      ),
      lastSynced: Math.max(
        Number(previous.lastSynced) || 0,
        Number(next.lastSynced) || 0,
      ),
    }, now),
    lastSynced: Number(previous.lastSynced) || 0,
  };
};

export const markScheduleDataDirty = (previousData, nextData, now = Date.now()) => {
  if (!nextData) return nextData;
  if (!previousData) {
    return {
      ...nextData,
      global: markEntityDirty(null, nextData.global || {}, now),
      schedules: (nextData.schedules || []).map((schedule) => (
        markEntityDirty(null, schedule, now)
      )),
    };
  }

  const previousSchedules = new Map(
    (previousData.schedules || []).filter(Boolean).map((schedule) => [schedule.id, schedule]),
  );
  const nextIds = new Set((nextData.schedules || []).map((schedule) => schedule?.id));
  const schedules = (nextData.schedules || []).map((schedule) => (
    markEntityDirty(previousSchedules.get(schedule?.id), schedule, now)
  ));

  // Removing an object from an array is not a durable deletion. Preserve it as
  // a tombstone so another device cannot silently resurrect or erase it.
  (previousData.schedules || []).forEach((schedule) => {
    if (!schedule?.id || nextIds.has(schedule.id) || schedule.isDeleted) return;
    schedules.push(markEntityDirty(schedule, {
      ...schedule,
      isDeleted: true,
      deletedAt: nextLogicalTimestamp(schedule, now),
    }, now));
  });

  return {
    ...nextData,
    global: markEntityDirty(previousData.global || {}, nextData.global || {}, now),
    schedules,
  };
};

const makeConflict = (kind, id, local, cloud, reason) => ({
  kind,
  id,
  local,
  cloud,
  reason,
});

const getVersion = (entity) => Number(entity?.version) || 0;
const getBaseVersion = (entity) => (
  Number(entity?.baseVersion) || Number(entity?.version) || 0
);

const getCleanDivergenceReason = (local, cloud) => {
  if (!contentChanged(local, cloud)) return null;

  const localVersion = getVersion(local);
  const cloudVersion = getVersion(cloud);

  // Older builds acknowledged local data before Firestore confirmed the write.
  // That can leave a "clean" local entity whose content never reached the
  // cloud. Equal versions with different content are therefore never safe to
  // auto-resolve, and neither is a cloud version behind the local one.
  if (cloudVersion === localVersion) return 'same-version-divergence';
  if (cloudVersion < localVersion) return 'cloud-version-behind';
  return null;
};

const makeRemoteMissingTombstone = (local) => ({
  id: local.id,
  name: local.name,
  isDeleted: true,
  version: getBaseVersion(local) + 1,
  baseVersion: getBaseVersion(local) + 1,
  lastModified: Math.max(Number(local.lastSynced) || 0, Number(local.lastModified) || 0),
  lastSynced: Math.max(Number(local.lastSynced) || 0, Number(local.lastModified) || 0),
  remoteMissing: true,
});

export const resolveSyncConflict = (localData, cloudData) => {
  if (!localData) return { mergedData: cloudData, needsPushToCloud: false, conflicts: [] };
  if (!cloudData) return { mergedData: localData, needsPushToCloud: true, conflicts: [] };

  const mergedSchedules = new Map();
  const conflicts = [];
  let needsPushToCloud = false;
  const localMap = new Map(
    (localData.schedules || []).filter((item) => item?.id).map((item) => [item.id, item]),
  );
  const cloudMap = new Map(
    (cloudData.schedules || []).filter((item) => item?.id).map((item) => [item.id, item]),
  );
  const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

  allIds.forEach((id) => {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);

    if (!local) {
      mergedSchedules.set(id, cloud);
      return;
    }
    if (!cloud) {
      if (local.isDeleted) {
        if (isSyncEntityDirty(local)) {
          mergedSchedules.set(id, local);
          needsPushToCloud = true;
        }
        return;
      }
      if (!local.lastSynced || isSyncEntityDirty(local)) {
        mergedSchedules.set(id, local);
        needsPushToCloud = true;
        return;
      }

      // The tombstone may have been compacted while this device was offline.
      // Never interpret that ambiguity as permission to discard user content.
      const missingCloud = makeRemoteMissingTombstone(local);
      conflicts.push(makeConflict('schedule', id, local, missingCloud, 'remote-missing'));
      mergedSchedules.set(id, local);
      return;
    }

    if (!isSyncEntityDirty(local)) {
      const divergenceReason = getCleanDivergenceReason(local, cloud);
      if (divergenceReason) {
        conflicts.push(makeConflict('schedule', id, local, cloud, divergenceReason));
        mergedSchedules.set(id, local);
        return;
      }
      mergedSchedules.set(id, cloud);
      return;
    }

    if (getVersion(cloud) > getBaseVersion(local)) {
      conflicts.push(makeConflict('schedule', id, local, cloud, 'concurrent-update'));
      mergedSchedules.set(id, local);
      return;
    }

    mergedSchedules.set(id, local);
    needsPushToCloud = true;
  });

  const localGlobal = localData.global || {};
  const cloudGlobal = cloudData.global || {};
  let mergedGlobal;
  if (cloudGlobal._cloudMissing) {
    mergedGlobal = {
      ...localGlobal,
      _cloudMissing: undefined,
      lastModified: nextLogicalTimestamp(localGlobal),
    };
    needsPushToCloud = true;
  } else if (!isSyncEntityDirty(localGlobal)) {
    const divergenceReason = getCleanDivergenceReason(localGlobal, cloudGlobal);
    if (divergenceReason) {
      conflicts.push(makeConflict(
        'global',
        '__global__',
        localGlobal,
        cloudGlobal,
        divergenceReason,
      ));
      mergedGlobal = localGlobal;
    } else {
      mergedGlobal = cloudGlobal;
    }
  } else if (getVersion(cloudGlobal) > getBaseVersion(localGlobal)) {
    conflicts.push(makeConflict(
      'global',
      '__global__',
      localGlobal,
      cloudGlobal,
      'concurrent-update',
    ));
    mergedGlobal = localGlobal;
  } else {
    mergedGlobal = localGlobal;
    needsPushToCloud = true;
  }

  return {
    mergedData: {
      global: mergedGlobal,
      schedules: Array.from(mergedSchedules.values()),
    },
    needsPushToCloud,
    conflicts,
  };
};

const mergeUniqueItems = (cloudItems = [], localItems = []) => {
  const result = [];
  const seen = new Map();
  [...cloudItems, ...localItems].forEach((item) => {
    const key = item?.id || item?.fileId || item?.storagePath || item?.downloadURL ||
      getScheduleDataFingerprint(item);
    if (seen.has(key)) {
      const index = seen.get(key);
      result[index] = { ...result[index], ...item };
      return;
    }
    seen.set(key, result.length);
    result.push(item);
  });
  return result;
};

export const resolveConflictChoice = (
  data,
  conflict,
  action,
  generateId,
  now = Date.now(),
) => {
  if (!data || !conflict) return data;
  if (conflict.kind === 'global') {
    if (action === 'cloud') {
      return { ...data, global: { ...conflict.cloud, lastSynced: conflict.cloud.lastModified } };
    }

    const cloudVersion = getVersion(conflict.cloud);
    const local = {
      ...conflict.local,
      version: cloudVersion,
      baseVersion: cloudVersion,
      lastModified: nextLogicalTimestamp(conflict.local, now),
    };
    if (action === 'both') {
      local.fileLibrary = mergeUniqueItems(
        conflict.cloud?.fileLibrary,
        conflict.local?.fileLibrary,
      );
      local.notificationPreferences = {
        ...(conflict.cloud?.notificationPreferences || {}),
        ...(conflict.local?.notificationPreferences || {}),
      };
    }
    return { ...data, global: local };
  }

  const schedules = [...(data.schedules || [])];
  const index = schedules.findIndex((schedule) => schedule?.id === conflict.id);
  if (action === 'cloud') {
    const cloud = {
      ...conflict.cloud,
      lastSynced: conflict.cloud.lastModified,
    };
    if (index >= 0) schedules[index] = cloud;
    else schedules.push(cloud);
    return { ...data, schedules };
  }

  if (action === 'both') {
    const cloud = {
      ...conflict.cloud,
      lastSynced: conflict.cloud.lastModified,
    };
    if (index >= 0) schedules[index] = cloud;
    else schedules.push(cloud);
    schedules.push({
      ...conflict.local,
      id: generateId(),
      name: `${conflict.local?.name || ''} (Recovered copy)`,
      version: 0,
      baseVersion: 0,
      lastModified: nextLogicalTimestamp(conflict.local, now),
      lastSynced: 0,
      isDeleted: false,
      deletedAt: undefined,
    });
    return { ...data, schedules };
  }

  const cloudVersion = conflict.cloud?.remoteMissing ? 0 : getVersion(conflict.cloud);
  const local = {
    ...conflict.local,
    version: cloudVersion,
    baseVersion: cloudVersion,
    lastModified: nextLogicalTimestamp(conflict.local, now),
    lastSynced: conflict.cloud?.remoteMissing ? 0 : conflict.local.lastSynced,
  };
  if (index >= 0) schedules[index] = local;
  else schedules.push(local);
  return { ...data, schedules };
};

import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  query,
  where,
  waitForPendingWrites,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './createDefaultData';
import { deleteAllUserCloudData } from '../services/accountDeletionService';
import { logCrashlyticsError } from '../utils/analytics/crashlytics';
import { getDeviceId } from '../utils/deviceService';
import { getScheduleDataFingerprint } from '../utils/scheduleDataFingerprint';

let isAccountBeingDeleted = false;
let accountDeletionLockCount = 0;
const DEVICE_SYNC_CLEANUP_THROTTLE_MS = 30 * 60 * 1000;
const DEVICE_WATERMARK_SCAN_TTL_MS = 60 * 60 * 1000;
const DEAD_DEVICE_MS = 180 * 24 * 60 * 60 * 1000;
const TOMBSTONE_MIN_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const TOMBSTONE_WATERMARK_SAFETY_MS = 5 * 60 * 1000;
const ACCOUNT_DELETION_PENDING_WRITES_TIMEOUT_MS = 15 * 1000;
const MAX_SYNC_TRANSACTION_ENTITIES = 450;
const cleanupStateByUser = new Map();

export class ScheduleSyncConflictError extends Error {
  constructor(conflicts, committed = null) {
    super('Cloud data changed while this device was saving.');
    this.name = 'ScheduleSyncConflictError';
    this.code = 'sync/conflict';
    this.conflicts = conflicts;
    this.committed = committed;
  }
}

export const beginAccountDeletion = () => {
  accountDeletionLockCount += 1;
  isAccountBeingDeleted = true;
  let isReleased = false;

  return () => {
    if (isReleased) return;
    isReleased = true;
    accountDeletionLockCount = Math.max(0, accountDeletionLockCount - 1);
    isAccountBeingDeleted = accountDeletionLockCount > 0;
  };
};

const parseTimestamp = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return null;
};

const ensureVersioning = (data) => {
  const now = Date.now();
  const lastMod = parseTimestamp(data.lastModified) || now;
  const version = Number(data.version) || 1;
  const normalized = {
    ...data,
    version,
    baseVersion: version,
    lastModified: lastMod,
    lastSynced: lastMod, 
  };
  if (data.deletedAt) normalized.deletedAt = parseTimestamp(data.deletedAt) || data.deletedAt;
  return normalized;
};

const createMissingGlobalData = () => ({
  ...createDefaultData().global,
  currentScheduleId: null,
  version: 0,
  baseVersion: 0,
  lastModified: 0,
  lastSynced: 0,
  _cloudMissing: true,
});

const removeUndefinedValues = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => (
      item === undefined ? null : removeUndefinedValues(item)
    ));
  }
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || typeof value.toMillis === 'function') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedValues(item)]),
  );
};

// Firestore stores one readable document per entity. `id`, `baseVersion`, and
// `lastSynced` are client state derived from the document path/version and are
// intentionally not duplicated in the cloud document.
const toCloudDocument = (entity = {}) => {
  const {
    id: _localId,
    baseVersion: _localBaseVersion,
    lastSynced: _localLastSynced,
    _cloudMissing: _localMissingMarker,
    ...cloudData
  } = entity;
  return removeUndefinedValues(cloudData);
};

const fromCloudDocument = (data = {}, id = null) => {
  if (data?._c || data?._p) {
    const error = new Error('Compressed Firestore documents are not supported by the current schema.');
    error.code = 'sync/unsupported-cloud-schema';
    throw error;
  }
  return ensureVersioning({
    ...data,
    ...(id ? { id } : {}),
  });
};

const getDeviceSyncWatermark = async (userId, now = Date.now()) => {
  const devicesRef = collection(db, 'users', userId, 'devices');
  const devicesSnap = await getDocsFromServer(devicesRef);

  let watermark = now;
  let activeDevices = 0;

  devicesSnap.docs.forEach(docSnap => {
    const syncTime = parseTimestamp(docSnap.data().lastSyncTime) || 0;
    if (now - syncTime < DEAD_DEVICE_MS) {
      activeDevices++;
      if (syncTime < watermark) watermark = syncTime;
    }
  });

  return activeDevices === 0 ? now : watermark;
};

const getCleanupWatermark = async (userId, now = Date.now()) => {
  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  const globalSnap = await getDocFromServer(globalRef);
  const globalData = globalSnap.exists() ? globalSnap.data() : {};
  const cachedWatermark = Number(globalData.watermark) || 0;
  const cachedAt = parseTimestamp(globalData.watermarkUpdatedAt) || 0;

  if (cachedWatermark > 0 && now - cachedAt < DEVICE_WATERMARK_SCAN_TTL_MS) {
    return { globalRef, watermark: cachedWatermark, scannedDevices: false };
  }

  return {
    globalRef,
    watermark: await getDeviceSyncWatermark(userId, now),
    scannedDevices: true,
  };
};

export const isTombstoneSafeToDelete = (data, watermark, now = Date.now()) => {
  if (!data?.isDeleted) return false;
  const deletedAt = parseTimestamp(data.deletedAt) || parseTimestamp(data.lastModified) || 0;
  if (deletedAt <= 0 || now - deletedAt < TOMBSTONE_MIN_RETENTION_MS) return false;
  const safeWatermark = Math.max(0, (Number(watermark) || 0) - TOMBSTONE_WATERMARK_SAFETY_MS);
  return deletedAt <= safeWatermark;
};

const runDeviceSyncTimeAndCleanUp = async (userId) => {
  try {
    const deviceId = await getDeviceId();
    if (!deviceId) return;
    
    const now = Date.now();
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    await setDoc(deviceRef, { lastSyncTime: serverTimestamp() }, { merge: true });

    // A stale watermark can only delay tombstone deletion; advancing it requires a rare device scan.
    const { globalRef, watermark, scannedDevices } = await getCleanupWatermark(userId, now);
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const deletedSchedulesQuery = query(schedulesRef, where('isDeleted', '==', true));
    const schedulesSnap = await getDocsFromServer(deletedSchedulesQuery);
    
    const batch = writeBatch(db);
    let hasDeletions = false;

    schedulesSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (isTombstoneSafeToDelete(data, watermark, now)) {
        batch.delete(docSnap.ref);
        hasDeletions = true;
      }
    });

    if (scannedDevices) {
      batch.set(globalRef, { watermark, watermarkUpdatedAt: now }, { merge: true });
    }

    if (hasDeletions || scannedDevices) {
      await batch.commit();
    }
  } catch (error) {
    console.error(error);
  }
};

export const updateDeviceSyncTimeAndCleanUp = async (userId, options = {}) => {
  if (isAccountBeingDeleted || !userId) return;

  const { force = false } = options;
  const now = Date.now();
  const state = cleanupStateByUser.get(userId) || {
    lastStartedAt: 0,
    inFlight: null,
    timeoutId: null,
  };

  if (state.inFlight) {
    return state.inFlight;
  }

  const msSinceLastRun = now - (state.lastStartedAt || 0);
  if (!force && msSinceLastRun < DEVICE_SYNC_CLEANUP_THROTTLE_MS) {
    if (!state.timeoutId) {
      state.timeoutId = setTimeout(() => {
        const latestState = cleanupStateByUser.get(userId) || {};
        latestState.timeoutId = null;
        cleanupStateByUser.set(userId, latestState);
        updateDeviceSyncTimeAndCleanUp(userId, { force: true });
      }, DEVICE_SYNC_CLEANUP_THROTTLE_MS - msSinceLastRun);
    }
    cleanupStateByUser.set(userId, state);
    return;
  }

  if (state.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  state.lastStartedAt = now;
  state.inFlight = runDeviceSyncTimeAndCleanUp(userId).finally(() => {
    const latestState = cleanupStateByUser.get(userId) || state;
    latestState.inFlight = null;
    cleanupStateByUser.set(userId, latestState);
  });
  cleanupStateByUser.set(userId, state);

  return state.inFlight;
};

export const subscribeToSchedule = (userId, onDataUpdate, onError) => {
  let globalData = null;
  let schedulesList = null;
  let globalFromCache = true;
  let schedulesFromCache = true;
  let globalHasPendingWrites = false;
  let schedulesHasPendingWrites = false;
  let lastEmittedFingerprint = null;
  let lastEmittedFromCache = null;
  let lastEmittedPendingWrites = null;
  let subscriptionActive = true;
  // Firestore does not await async snapshot handlers. Keep deliveries strictly
  // ordered so an older, slower snapshot can never finish after a newer one and
  // overwrite the UI with stale data.
  let deliveryQueue = Promise.resolve();

  const enqueueDataUpdate = (payload, isFromCache, metadata) => {
    deliveryQueue = deliveryQueue
      .then(() => (
        subscriptionActive
          ? onDataUpdate(payload, isFromCache, metadata)
          : undefined
      ))
      .catch((error) => {
        if (onError) onError(error);
      });
  };

  const checkAndEmit = () => {
    if (globalData !== null && schedulesList !== null) {
      const isFromCache = globalFromCache || schedulesFromCache;
      const hasPendingWrites = globalHasPendingWrites || schedulesHasPendingWrites;
      const payload = { global: globalData, schedules: schedulesList };
      const fingerprint = getScheduleDataFingerprint(payload);
      const hasDataChanged = fingerprint !== lastEmittedFingerprint;
      const cacheStateChanged = isFromCache !== lastEmittedFromCache;
      const pendingStateChanged = hasPendingWrites !== lastEmittedPendingWrites;

      if (!hasDataChanged && !cacheStateChanged && !pendingStateChanged) return;

      lastEmittedFingerprint = fingerprint;
      lastEmittedFromCache = isFromCache;
      lastEmittedPendingWrites = hasPendingWrites;

      enqueueDataUpdate(payload, isFromCache, {
        hasDataChanged,
        cacheStateChanged,
        hasPendingWrites,
        pendingStateChanged,
      });
    }
  };

  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  
  const unsubGlobal = onSnapshot(globalRef, { includeMetadataChanges: true }, (docSnap) => {
    globalFromCache = docSnap.metadata.fromCache; 
    globalHasPendingWrites = docSnap.metadata.hasPendingWrites;

    if (docSnap.exists()) {
      globalData = fromCloudDocument(docSnap.data());
      checkAndEmit();
    } else {
      globalData = createMissingGlobalData();
      checkAndEmit();
    }
  }, (error) => {
    if (onError) onError(error);
  });

  const schedulesRef = collection(db, 'users', userId, 'schedules');
  
  const unsubSchedules = onSnapshot(schedulesRef, { includeMetadataChanges: true }, (querySnapshot) => {
    schedulesFromCache = querySnapshot.metadata.fromCache; 
    schedulesHasPendingWrites = querySnapshot.metadata.hasPendingWrites;
    
    schedulesList = querySnapshot.docs.map((docSnap) => (
      fromCloudDocument(docSnap.data(), docSnap.id)
    ));
    checkAndEmit();
  }, (error) => {
    if (onError) onError(error);
  });

  return () => {
    subscriptionActive = false;
    unsubGlobal();
    unsubSchedules();
  };
};

export const getSchedule = async (userId) => {
  try {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);
    
    let globalData = null;
    if (globalSnap.exists()) {
      globalData = fromCloudDocument(globalSnap.data());
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    const schedulesList = schedulesSnap.docs.map((docSnap) => (
      fromCloudDocument(docSnap.data(), docSnap.id)
    ));

    if (!globalData && schedulesList.length === 0) {
      return createDefaultData(); 
    }

    if (!globalData) {
      globalData = createMissingGlobalData();
    }

    return { global: globalData, schedules: schedulesList };
  } catch (error) {
    throw error;
  }
};

export const getScheduleFromServer = async (userId) => {
  try {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDocFromServer(globalRef);
    
    let globalData = null;
    if (globalSnap.exists()) {
      globalData = fromCloudDocument(globalSnap.data());
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocsFromServer(schedulesRef); 

    const schedulesList = schedulesSnap.docs.map((docSnap) => (
      fromCloudDocument(docSnap.data(), docSnap.id)
    ));

    if (!globalData && schedulesList.length === 0) {
      return null; 
    }

    if (!globalData) {
      globalData = createMissingGlobalData();
    }

    return { global: globalData, schedules: schedulesList };
  } catch (error) {
    throw error;
  }
};

const commitCloudEntity = async ({ kind, id, entity, ref, now }) => (
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const remote = snapshot.exists()
      ? fromCloudDocument(snapshot.data(), kind === 'schedule' ? id : null)
      : null;
    const remoteVersion = remote ? Number(remote.version) || 1 : 0;
    const expectedVersion = Number(entity.baseVersion) || Number(entity.version) || 0;
    const wasPreviouslySynced = (Number(entity.lastSynced) || 0) > 0;
    const missingPreviouslySyncedSchedule = kind === 'schedule'
      && !remote
      && expectedVersion > 0
      && wasPreviouslySynced
      && !entity.isDeleted;

    if ((remote && remoteVersion !== expectedVersion) || missingPreviouslySyncedSchedule) {
      throw new ScheduleSyncConflictError([{
        kind,
        id,
        expectedVersion,
        remoteVersion,
      }]);
    }

    if (kind === 'schedule' && !remote && entity.isDeleted) {
      return {
        ...entity,
        version: expectedVersion,
        baseVersion: expectedVersion,
        lastSynced: now,
      };
    }

    const nextVersion = remoteVersion + 1;
    const committed = {
      ...entity,
      version: nextVersion,
      baseVersion: nextVersion,
      lastSynced: now,
    };
    transaction.set(ref, toCloudDocument(committed));
    return committed;
  })
);

export const saveSchedule = async (userId, data, isPartialUpdate = false) => {
  if (isAccountBeingDeleted) {
    const error = new Error('Account deletion is in progress.');
    error.code = 'sync/account-deletion-in-progress';
    throw error;
  }
  if (!userId) {
    const error = new Error('A user id is required to save a schedule.');
    error.code = 'sync/invalid-user';
    throw error;
  }

  const schedules = Array.isArray(data?.schedules)
    ? data.schedules.filter((schedule) => schedule?.id)
    : [];
  const entityCount = schedules.length + (data?.global ? 1 : 0);
  if (entityCount > MAX_SYNC_TRANSACTION_ENTITIES) {
    const error = new Error('Too many changed schedules for one save operation.');
    error.code = 'sync/too-many-entities';
    throw error;
  }

  const now = Date.now();
  const entries = [
    ...(data?.global ? [{
      kind: 'global',
      id: '__global__',
      entity: data.global,
      ref: doc(db, 'users', userId, 'global', 'settings'),
    }] : []),
    ...schedules.map((schedule) => ({
      kind: 'schedule',
      id: schedule.id,
      entity: schedule,
      ref: doc(db, 'users', userId, 'schedules', schedule.id),
    })),
  ];

  const settled = await Promise.allSettled(
    entries.map((entry) => commitCloudEntity({ ...entry, now })),
  );
  const committed = {
    global: null,
    schedules: [],
    committedAt: now,
    partial: isPartialUpdate !== false,
  };
  const conflicts = [];
  const failures = [];

  settled.forEach((result, index) => {
    const entry = entries[index];
    if (result.status === 'fulfilled') {
      if (entry.kind === 'global') committed.global = result.value;
      else committed.schedules.push(result.value);
      return;
    }
    if (result.reason?.code === 'sync/conflict') {
      conflicts.push(...(result.reason.conflicts || []));
    } else {
      failures.push(result.reason);
    }
  });

  try {
    const deviceId = await getDeviceId();
    if (deviceId) {
      await setDoc(
        doc(db, 'users', userId, 'devices', deviceId),
        { lastSyncTime: serverTimestamp() },
        { merge: true },
      );
    }
  } catch (error) {
    logCrashlyticsError(error, 'updateDeviceAfterSave_Firestore');
  }

  if (conflicts.length > 0) {
    const error = new ScheduleSyncConflictError(conflicts, committed);
    logCrashlyticsError(error, 'saveSchedule_Firestore');
    throw error;
  }
  if (failures.length > 0) {
    const error = failures[0];
    error.committed = committed;
    logCrashlyticsError(error, 'saveSchedule_Firestore');
    throw error;
  }

  return committed;
};

export const deleteUserSchedule = async (userId, scheduleId) => {
  if (isAccountBeingDeleted) return;

  try {
    const scheduleRef = doc(db, 'users', userId, 'schedules', scheduleId);
    const docSnap = await getDocFromServer(scheduleRef);
    const data = docSnap.exists() ? fromCloudDocument(docSnap.data(), scheduleId) : {};

    const now = Date.now();
    await saveSchedule(userId, {
      schedules: [{
        id: scheduleId,
        isDeleted: true,
        version: Number(data.version) || 0,
        baseVersion: Number(data.version) || 0,
        lastModified: now,
        lastSynced: parseTimestamp(data.lastModified) || 0,
        deletedAt: now,
      }],
    }, true);
  } catch (error) {
    logCrashlyticsError(error, 'deleteUserSchedule_Firestore');
    throw error;
  }
};

export const resetUserSchedules = async (userId) => {
  if (isAccountBeingDeleted) return;

  try {
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const snapshot = await getDocsFromServer(schedulesRef);

    if (snapshot.empty) return;

    const now = Date.now();

    const tombstones = snapshot.docs.map((docSnap) => {
      const data = fromCloudDocument(docSnap.data(), docSnap.id);
      return {
        id: docSnap.id,
        isDeleted: true, 
        version: Number(data.version) || 0,
        baseVersion: Number(data.version) || 0,
        lastModified: now,
        lastSynced: parseTimestamp(data.lastModified) || 0,
        deletedAt: now
      };
    });
    await saveSchedule(userId, { schedules: tombstones }, true);
  } catch (error) {
    logCrashlyticsError(error, 'resetUserSchedules_Firestore');
    throw error;
  }
};

export const deleteAllUserData = async (userId) => {
  const releaseDeletionLock = beginAccountDeletion();

  try {
    // Flush writes already queued by listeners before server-side deletion starts.
    let pendingWritesTimeoutId;
    await Promise.race([
      waitForPendingWrites(db),
      new Promise((_, reject) => {
        pendingWritesTimeoutId = setTimeout(() => {
          const error = new Error(
            'Timed out while waiting for pending account writes.',
          );
          error.code = 'account-deletion/pending-writes-timeout';
          reject(error);
        }, ACCOUNT_DELETION_PENDING_WRITES_TIMEOUT_MS);
      }),
    ]).finally(() => clearTimeout(pendingWritesTimeoutId));
    return await deleteAllUserCloudData(userId);
  } catch (error) {
    logCrashlyticsError(error, 'deleteAllUserData_Firestore');
    throw error;
  } finally {
    releaseDeletionLock();
  }
};

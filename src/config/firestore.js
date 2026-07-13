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
  where
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './createDefaultData';
import { logCrashlyticsError } from '../utils/analytics/crashlytics';
import { getDeviceId } from '../utils/deviceService';
import { getScheduleDataFingerprint } from '../utils/scheduleDataFingerprint';
import {
  decodeGlobalDocument,
  decodeScheduleDocument,
  encodeGlobalDocument,
  encodeScheduleDocument,
  needsGlobalDocumentRewrite,
  needsScheduleDocumentRewrite,
} from '../utils/scheduleDocumentCodec';

let isAccountBeingDeleted = false;
const DEVICE_SYNC_CLEANUP_THROTTLE_MS = 30 * 60 * 1000;
const DEVICE_WATERMARK_SCAN_TTL_MS = 60 * 60 * 1000;
const DEAD_DEVICE_MS = 30 * 24 * 60 * 60 * 1000;
const cleanupStateByUser = new Map();

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
  return {
    ...data,
    version: data.version || 1,
    baseVersion: data.baseVersion || 1,
    lastModified: lastMod,
    lastSynced: lastMod, 
  };
};

const migrateGlobalDocumentIfNeeded = (globalRef, rawData, decodedData) => {
  if (isAccountBeingDeleted || !needsGlobalDocumentRewrite(rawData)) return;

  setDoc(globalRef, encodeGlobalDocument(decodedData)).catch((error) => {
    logCrashlyticsError(error, 'migrateGlobalDocument_Firestore');
  });
};

const migrateScheduleSnapshotIfNeeded = (snapshot) => {
  if (isAccountBeingDeleted || !snapshot || snapshot.empty) return;

  try {
    const batch = writeBatch(db);
    let hasLegacyDocuments = false;

    snapshot.docs.forEach((docSnap) => {
      const rawData = docSnap.data();
      if (!needsScheduleDocumentRewrite(rawData)) return;

      hasLegacyDocuments = true;
      batch.set(
        docSnap.ref,
        encodeScheduleDocument(decodeScheduleDocument(rawData, docSnap.id))
      );
    });

    if (hasLegacyDocuments) {
      batch.commit().catch((error) => {
        logCrashlyticsError(error, 'migrateScheduleDocuments_Firestore');
      });
    }
  } catch (error) {
    logCrashlyticsError(error, 'prepareScheduleDocumentsMigration_Firestore');
  }
};

const getDeviceSyncWatermark = async (userId, now = Date.now()) => {
  const devicesRef = collection(db, 'users', userId, 'devices');
  const devicesSnap = await getDocs(devicesRef);

  let watermark = now;
  let activeDevices = 0;

  devicesSnap.docs.forEach(docSnap => {
    const syncTime = docSnap.data().lastSyncTime || 0;
    if (now - syncTime < DEAD_DEVICE_MS) {
      activeDevices++;
      if (syncTime < watermark) watermark = syncTime;
    }
  });

  return activeDevices === 0 ? now : watermark;
};

const getCleanupWatermark = async (userId, now = Date.now()) => {
  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  const globalSnap = await getDoc(globalRef);
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

const runDeviceSyncTimeAndCleanUp = async (userId) => {
  try {
    const deviceId = await getDeviceId();
    if (!deviceId) return;
    
    const now = Date.now();
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    await setDoc(deviceRef, { lastSyncTime: now }, { merge: true });

    // A stale watermark can only delay tombstone deletion; advancing it requires a rare device scan.
    const { globalRef, watermark, scannedDevices } = await getCleanupWatermark(userId, now);
    const safeWatermark = watermark + 2000;

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const deletedSchedulesQuery = query(schedulesRef, where('isDeleted', '==', true));
    const schedulesSnap = await getDocs(deletedSchedulesQuery);
    
    const batch = writeBatch(db);
    let hasDeletions = false;

    schedulesSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.isDeleted && (data.deletedAt || data.lastModified || 0) <= safeWatermark) {
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
  let globalSnapshotCount = 0;
  let lastEmittedFingerprint = null;
  let lastEmittedFromCache = null;

  const checkAndEmit = () => {
    if (globalData !== null && schedulesList !== null) {
      const isFromCache = globalFromCache || schedulesFromCache;
      const hasPendingWrites = globalHasPendingWrites || schedulesHasPendingWrites;
      const payload = { global: globalData, schedules: schedulesList };
      const fingerprint = getScheduleDataFingerprint(payload);
      const hasDataChanged = fingerprint !== lastEmittedFingerprint;
      const cacheStateChanged = isFromCache !== lastEmittedFromCache;

      if (!hasDataChanged && !cacheStateChanged) return;

      lastEmittedFingerprint = fingerprint;
      lastEmittedFromCache = isFromCache;

      onDataUpdate(payload, isFromCache, {
        hasDataChanged,
        cacheStateChanged,
        hasPendingWrites,
      });
    }
  };

  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  
  const unsubGlobal = onSnapshot(globalRef, (docSnap) => {
    const currentCount = ++globalSnapshotCount;
    globalFromCache = docSnap.metadata.fromCache; 
    globalHasPendingWrites = docSnap.metadata.hasPendingWrites;

    if (docSnap.exists()) {
      const rawData = docSnap.data();
      const data = decodeGlobalDocument(rawData);
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
      checkAndEmit();
    } else {
      const userDocRef = doc(db, "users", userId);
      getDoc(userDocRef).then((userDocSnap) => {
        if (currentCount !== globalSnapshotCount) return;

        if (userDocSnap.exists() && userDocSnap.data().global) {
          const rawData = userDocSnap.data().global;
          const data = decodeGlobalDocument(rawData);
          const lastMod = parseTimestamp(data.lastModified) || Date.now();
          globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
          migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
        } else {
          globalData = createDefaultData().global;
        }
        checkAndEmit();
      }).catch(() => {
        if (currentCount !== globalSnapshotCount) return;
        globalData = createDefaultData().global;
        checkAndEmit();
      });
    }
  }, (error) => {
    if (onError) onError(error);
  });

  const schedulesRef = collection(db, 'users', userId, 'schedules');
  
  const unsubSchedules = onSnapshot(schedulesRef, (querySnapshot) => {
    schedulesFromCache = querySnapshot.metadata.fromCache; 
    schedulesHasPendingWrites = querySnapshot.metadata.hasPendingWrites;
    
    schedulesList = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(decodeScheduleDocument(docSnap.data(), docSnap.id)) 
    }));
    migrateScheduleSnapshotIfNeeded(querySnapshot);
    checkAndEmit();
  }, (error) => {
    if (onError) onError(error);
  });

  return () => {
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
      const rawData = globalSnap.data();
      const data = decodeGlobalDocument(rawData);
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const rawData = userDocSnap.data().global;
        const data = decodeGlobalDocument(rawData);
        const lastMod = parseTimestamp(data.lastModified) || Date.now();
        globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
        migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(decodeScheduleDocument(docSnap.data(), docSnap.id)) 
    }));
    migrateScheduleSnapshotIfNeeded(schedulesSnap);

    if (!globalData && schedulesList.length === 0) {
      return createDefaultData(); 
    }

    if (!globalData) {
      const def = createDefaultData();
      globalData = def.global;
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
      const rawData = globalSnap.data();
      const data = decodeGlobalDocument(rawData);
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDocFromServer(userDocRef); 
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const rawData = userDocSnap.data().global;
        const data = decodeGlobalDocument(rawData);
        const lastMod = parseTimestamp(data.lastModified) || Date.now();
        globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
        migrateGlobalDocumentIfNeeded(globalRef, rawData, data);
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocsFromServer(schedulesRef); 

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(decodeScheduleDocument(docSnap.data(), docSnap.id)) 
    }));
    migrateScheduleSnapshotIfNeeded(schedulesSnap);

    if (!globalData && schedulesList.length === 0) {
      return null; 
    }

    if (!globalData) {
      const def = createDefaultData();
      globalData = def.global;
    }

    return { global: globalData, schedules: schedulesList };
  } catch (error) {
    throw error;
  }
};

export const saveSchedule = async (userId, data, isPartialUpdate = false) => {
  if (isAccountBeingDeleted) return;

  const batch = writeBatch(db);
  const now = Date.now();

  let deviceId = null;
  try {
    deviceId = await getDeviceId();
  } catch (e) {}

  if (deviceId) {
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    batch.set(deviceRef, { lastSyncTime: now }, { merge: true });
  }

  const shouldScanWatermark = !isPartialUpdate;
  const incomingWatermark = data.global?.watermark;
  const watermark = shouldScanWatermark
    ? await getDeviceSyncWatermark(userId, now)
    : (typeof incomingWatermark === 'number' ? incomingWatermark : 0);
  const safeWatermark = watermark + 2000;

  let hasGlobalUpdates = false;
  let globalUpdateData = {};

  if (data.global) {
    globalUpdateData = { ...data.global };
    if (shouldScanWatermark || typeof incomingWatermark === 'number') {
      globalUpdateData.watermark = watermark;
      if (shouldScanWatermark) {
        globalUpdateData.watermarkUpdatedAt = now;
      }
    }
    hasGlobalUpdates = true;
  } else if (shouldScanWatermark) {
    globalUpdateData = { watermark, watermarkUpdatedAt: now };
    hasGlobalUpdates = true;
  }

  if (hasGlobalUpdates) {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalDocData = encodeGlobalDocument(globalUpdateData, { includePayload: !!data.global });
    if (data.global) {
      batch.set(globalRef, globalDocData);
    } else {
      batch.set(globalRef, globalDocData, { merge: true });
    }
  }

  if (data.schedules && Array.isArray(data.schedules)) {
    if (!isPartialUpdate) {
      const schedulesRef = collection(db, 'users', userId, 'schedules');
      const snapshot = await getDocs(schedulesRef);
      
      const activeIds = data.schedules.map(s => s.id);

      snapshot.docs.forEach(docSnap => {
        if (!activeIds.includes(docSnap.id)) {
          const existingData = decodeScheduleDocument(docSnap.data(), docSnap.id);
          batch.set(docSnap.ref, encodeScheduleDocument({ 
            id: docSnap.id,
            isDeleted: true, 
            version: (existingData.version || 1) + 1,
            baseVersion: (existingData.baseVersion || 1) + 1,
            lastModified: now,
            deletedAt: now
          }));
        }
      });
    }

    data.schedules.forEach((schedule) => {
      if (schedule && schedule.id) {
        const scheduleDocRef = doc(db, 'users', userId, 'schedules', schedule.id);
        
        // Partial autosaves avoid device scans; tombstones are hard-deleted by the throttled cleanup path.
        if (!isPartialUpdate && schedule.isDeleted && (schedule.deletedAt || schedule.lastModified || 0) <= safeWatermark) {
          batch.delete(scheduleDocRef);
        } else {
          batch.set(scheduleDocRef, encodeScheduleDocument(schedule));
        }
      }
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    logCrashlyticsError(error, 'saveSchedule_Firestore');
  }
};

export const deleteUserSchedule = async (userId, scheduleId) => {
  if (isAccountBeingDeleted) return;

  try {
    const scheduleRef = doc(db, 'users', userId, 'schedules', scheduleId);
    const docSnap = await getDoc(scheduleRef);
    const data = docSnap.exists() ? decodeScheduleDocument(docSnap.data(), scheduleId) : {};
    
    await setDoc(scheduleRef, encodeScheduleDocument({ 
      id: scheduleId,
      isDeleted: true, 
      version: (data.version || 1) + 1,
      baseVersion: (data.baseVersion || 1) + 1,
      lastModified: Date.now(),
      deletedAt: Date.now()
    }));
  } catch (error) {
    logCrashlyticsError(error, 'deleteUserSchedule_Firestore');
  }
};

export const resetUserSchedules = async (userId) => {
  if (isAccountBeingDeleted) return;

  try {
    const batch = writeBatch(db);
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const snapshot = await getDocs(schedulesRef);

    if (snapshot.empty) return;

    const now = Date.now();

    snapshot.docs.forEach((docSnap) => {
      const data = decodeScheduleDocument(docSnap.data(), docSnap.id);
      batch.set(docSnap.ref, encodeScheduleDocument({ 
        id: docSnap.id,
        isDeleted: true, 
        version: (data.version || 1) + 1,
        baseVersion: (data.baseVersion || 1) + 1,
        lastModified: now,
        deletedAt: now
      }));
    });

    await batch.commit();
  } catch (error) {
    logCrashlyticsError(error, 'resetUserSchedules_Firestore');
  }
};

export const deleteAllUserData = async (userId) => {
  isAccountBeingDeleted = true;
  
  try {
    try {
      const schedulesBatch = writeBatch(db);
      const schedulesRef = collection(db, 'users', userId, 'schedules');
      const snapshot = await getDocs(schedulesRef);
      snapshot.docs.forEach((docSnap) => schedulesBatch.delete(docSnap.ref));
      await schedulesBatch.commit();
    } catch (e) {}

    try {
      const userBatch = writeBatch(db);
      userBatch.delete(doc(db, 'users', userId, 'global', 'settings'));
      userBatch.delete(doc(db, 'users', userId));
      await userBatch.commit();
    } catch (e) {}

    try {
      const devicesBatch = writeBatch(db);
      const devicesRef = collection(db, 'users', userId, 'devices');
      const devicesSnapshot = await getDocs(devicesRef);
      devicesSnapshot.docs.forEach((docSnap) => devicesBatch.delete(docSnap.ref));
      await devicesBatch.commit();
    } catch (e) {}

  } catch (error) {
    logCrashlyticsError(error, 'deleteAllUserData_Firestore');
    throw error;
  } finally {
    isAccountBeingDeleted = false; 
  }
};

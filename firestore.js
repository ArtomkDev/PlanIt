import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot,
  getDocFromServer,
  getDocsFromServer,
  deleteDoc,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './src/config/createDefaultData';

let isAccountBeingDeleted = false;

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

export const subscribeToSchedule = (userId, onDataUpdate, onError) => {
  let globalData = null;
  let schedulesList = null;
  let globalFromCache = true;
  let schedulesFromCache = true;
  let globalSnapshotCount = 0;

  const checkAndEmit = () => {
    if (globalData !== null && schedulesList !== null) {
      const isFromCache = globalFromCache || schedulesFromCache;
      onDataUpdate({ global: globalData, schedules: schedulesList }, isFromCache);
    }
  };

  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  
  const unsubGlobal = onSnapshot(globalRef, { includeMetadataChanges: true }, (docSnap) => {
    const currentCount = ++globalSnapshotCount;
    globalFromCache = docSnap.metadata.fromCache; 
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      checkAndEmit();
    } else {
      const userDocRef = doc(db, "users", userId);
      getDoc(userDocRef).then((userDocSnap) => {
        if (currentCount !== globalSnapshotCount) return;

        if (userDocSnap.exists() && userDocSnap.data().global) {
          const data = userDocSnap.data().global;
          const lastMod = parseTimestamp(data.lastModified) || Date.now();
          globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
        } else {
          globalData = createDefaultData().global;
        }
        checkAndEmit();
      }).catch((e) => {
        if (currentCount !== globalSnapshotCount) return;
        globalData = createDefaultData().global;
        checkAndEmit();
      });
    }
  }, (error) => {
    if (onError) onError(error);
  });

  const schedulesRef = collection(db, 'users', userId, 'schedules');
  
  const unsubSchedules = onSnapshot(schedulesRef, { includeMetadataChanges: true }, (querySnapshot) => {
    schedulesFromCache = querySnapshot.metadata.fromCache; 
    schedulesList = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) 
    }));
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
      const data = globalSnap.data();
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const data = userDocSnap.data().global;
        const lastMod = parseTimestamp(data.lastModified) || Date.now();
        globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) 
    }));

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
      const data = globalSnap.data();
      const lastMod = parseTimestamp(data.lastModified) || Date.now();
      globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDocFromServer(userDocRef); 
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const data = userDocSnap.data().global;
        const lastMod = parseTimestamp(data.lastModified) || Date.now();
        globalData = { ...data, lastModified: lastMod, lastSynced: lastMod };
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocsFromServer(schedulesRef); 

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) 
    }));

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

  let globalUpdateData = { lastModified: serverTimestamp() };
  if (data.global) {
    globalUpdateData = { ...data.global, ...globalUpdateData };
  }

  if (data.deletedSchedules && Array.isArray(data.deletedSchedules)) {
    globalUpdateData.deletedSchedules = data.deletedSchedules;
    
    data.deletedSchedules.forEach((item) => {
      const scheduleId = item && typeof item === 'object' ? item.id : item;
      
      if (typeof scheduleId === 'string' && scheduleId.trim() !== '') {
        const scheduleDocRef = doc(db, 'users', userId, 'schedules', scheduleId);
        batch.set(scheduleDocRef, {
          id: scheduleId,
          isDeleted: true,
          deletedAt: item?.deletedAt || Date.now(),
          lastModified: serverTimestamp()
        }, { merge: true });
      }
    });
  }

  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  batch.set(globalRef, globalUpdateData, { merge: true });

  if (data.schedules && Array.isArray(data.schedules)) {
    if (!isPartialUpdate) {
      const schedulesRef = collection(db, 'users', userId, 'schedules');
      const snapshot = await getDocs(schedulesRef);
      
      const activeIds = data.schedules.map(s => s.id);

      snapshot.docs.forEach(docSnap => {
        if (!activeIds.includes(docSnap.id)) {
          batch.set(docSnap.ref, { 
            id: docSnap.id,
            isDeleted: true, 
            version: (docSnap.data().version || 1) + 1,
            baseVersion: (docSnap.data().baseVersion || 1) + 1,
            lastModified: serverTimestamp() 
          }, { merge: true });
        }
      });
    }

    data.schedules.forEach((schedule) => {
      if (schedule && schedule.id) {
        const scheduleDocRef = doc(db, 'users', userId, 'schedules', schedule.id);
        
        if (schedule.isDeleted) {
          batch.set(scheduleDocRef, { ...schedule, lastModified: serverTimestamp() }, { merge: true });
        } else {
          batch.set(scheduleDocRef, { ...schedule, lastModified: serverTimestamp() }, { merge: true });
        }
      }
    });
  }

  await batch.commit();
};

export const deleteUserSchedule = async (userId, scheduleId) => {
  if (isAccountBeingDeleted) return;

  const scheduleRef = doc(db, 'users', userId, 'schedules', scheduleId);
  const docSnap = await getDoc(scheduleRef);
  const data = docSnap.exists() ? docSnap.data() : {};
  
  await setDoc(scheduleRef, { 
    id: scheduleId,
    isDeleted: true, 
    version: (data.version || 1) + 1,
    baseVersion: (data.baseVersion || 1) + 1,
    lastModified: serverTimestamp() 
  }, { merge: true });
};

export const resetUserSchedules = async (userId) => {
  if (isAccountBeingDeleted) return;

  const batch = writeBatch(db);
  const schedulesRef = collection(db, 'users', userId, 'schedules');
  const snapshot = await getDocs(schedulesRef);

  if (snapshot.empty) return;

  snapshot.docs.forEach((docSnap) => {
    batch.set(docSnap.ref, { 
      id: docSnap.id,
      isDeleted: true, 
      version: (docSnap.data().version || 1) + 1,
      baseVersion: (docSnap.data().baseVersion || 1) + 1,
      lastModified: serverTimestamp() 
    }, { merge: true });
  });

  await batch.commit();
};

export const deleteAllUserData = async (userId) => {
  isAccountBeingDeleted = true;
  try {
    const batch = writeBatch(db);

    try {
      const schedulesRef = collection(db, 'users', userId, 'schedules');
      const snapshot = await getDocs(schedulesRef);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
    } catch (e) {}

    try {
      const devicesRef = collection(db, 'users', userId, 'devices');
      const snapshot = await getDocs(devicesRef);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
    } catch (e) {}

    const globalSettingsRef = doc(db, 'users', userId, 'global', 'settings');
    batch.delete(globalSettingsRef);

    const userDocRef = doc(db, 'users', userId);
    batch.delete(userDocRef);

    await batch.commit();
  } catch (error) {
    isAccountBeingDeleted = false;
    throw error;
  }
};
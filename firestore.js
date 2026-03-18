import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot,
  getDocFromServer,
  getDocsFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './src/config/createDefaultData';

// ДОПОМІЖНА ФУНКЦІЯ: Патчить старі дані, щоб вони мали версії
const ensureVersioning = (data) => {
  const now = Date.now();
  return {
    ...data,
    version: data.version || 1,
    baseVersion: data.baseVersion || 1,
    lastModified: data.lastModified || now,
    lastSynced: data.lastSynced || now,
  };
};

export const subscribeToSchedule = (userId, onDataUpdate, onError) => {
  let globalData = null;
  let schedulesList = null;
  
  // 🔥 Трекаємо стан кешу для кожної колекції
  let globalFromCache = true;
  let schedulesFromCache = true;

  const checkAndEmit = () => {
    if (globalData !== null && schedulesList !== null) {
      // Дані вважаються серверними ТІЛЬКИ якщо обидві колекції стягнуті з реального сервера
      const isFromCache = globalFromCache || schedulesFromCache;
      // Передаємо статус isFromCache у ScheduleProvider
      onDataUpdate({ global: globalData, schedules: schedulesList }, isFromCache);
    }
  };

  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  // 🔥 ДОДАНО: includeMetadataChanges: true
  const unsubGlobal = onSnapshot(globalRef, { includeMetadataChanges: true }, async (docSnap) => {
    globalFromCache = docSnap.metadata.fromCache; // Читаємо метадані Firebase
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      globalData = { ...data, lastModified: data.lastModified || Date.now() };
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const data = userDocSnap.data().global;
        globalData = { ...data, lastModified: data.lastModified || Date.now() };
      } else {
        globalData = createDefaultData().global;
      }
    }
    checkAndEmit();
  }, (error) => {
    if (onError) onError(error);
  });

  const schedulesRef = collection(db, 'users', userId, 'schedules');
  // 🔥 ДОДАНО: includeMetadataChanges: true
  const unsubSchedules = onSnapshot(schedulesRef, { includeMetadataChanges: true }, (querySnapshot) => {
    schedulesFromCache = querySnapshot.metadata.fromCache; // Читаємо метадані Firebase
    
    schedulesList = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) // ПРОПУСКАЄМО ЧЕРЕЗ ПАТЧЕР!
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
      globalData = { ...data, lastModified: data.lastModified || Date.now() };
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const data = userDocSnap.data().global;
        globalData = { ...data, lastModified: data.lastModified || Date.now() };
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) // ПРОПУСКАЄМО ЧЕРЕЗ ПАТЧЕР!
    }));

    if (!globalData && schedulesList.length === 0) {
      return createDefaultData(); 
    }

    if (!globalData) {
      const def = createDefaultData();
      globalData = def.global;
    }

    return {
      global: globalData,
      schedules: schedulesList
    };

  } catch (error) {
    console.error("Помилка завантаження з Firestore:", error);
    throw error;
  }
};

// Примусове завантаження саме з СЕРВЕРА (ігноруючи офлайн-кеш)
export const getScheduleFromServer = async (userId) => {
  try {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDocFromServer(globalRef); // ЧИТАЄМО З СЕРВЕРА
    
    let globalData = null;
    if (globalSnap.exists()) {
      const data = globalSnap.data();
      globalData = { ...data, lastModified: data.lastModified || Date.now() };
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDocFromServer(userDocRef); // ЧИТАЄМО З СЕРВЕРА
      if (userDocSnap.exists() && userDocSnap.data().global) {
        const data = userDocSnap.data().global;
        globalData = { ...data, lastModified: data.lastModified || Date.now() };
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocsFromServer(schedulesRef); // ЧИТАЄМО З СЕРВЕРА

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...ensureVersioning(docSnap.data()) // ПРОПУСКАЄМО ЧЕРЕЗ ПАТЧЕР!
    }));

    if (!globalData && schedulesList.length === 0) {
      return null; 
    }

    if (!globalData) {
      const def = createDefaultData();
      globalData = def.global;
    }

    return {
      global: globalData,
      schedules: schedulesList
    };

  } catch (error) {
    console.error("Помилка примусового завантаження з сервера:", error);
    throw error;
  }
};

export const saveSchedule = async (userId, data) => {
  const batch = writeBatch(db);

  if (data.global) {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    batch.set(globalRef, data.global, { merge: true });
  }

  if (data.schedules && Array.isArray(data.schedules)) {
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const snapshot = await getDocs(schedulesRef);
    
    const activeIds = data.schedules.map(s => s.id);

    snapshot.docs.forEach(docSnap => {
      if (!activeIds.includes(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    data.schedules.forEach((schedule) => {
      if (schedule && schedule.id) {
        const scheduleDocRef = doc(db, 'users', userId, 'schedules', schedule.id);
        batch.set(scheduleDocRef, schedule, { merge: true });
      }
    });
  }

  await batch.commit();
};

export const resetUserSchedules = async (userId) => {
  const batch = writeBatch(db);
  const schedulesRef = collection(db, 'users', userId, 'schedules');
  const snapshot = await getDocs(schedulesRef);

  if (snapshot.empty) return;

  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
};
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './src/config/createDefaultData';
import { getLocalSchedule, saveLocalSchedule } from './src/utils/storage';

export const getSchedule = async (userId) => {
  try {
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);
    
    let globalData = null;
    if (globalSnap.exists()) {
      globalData = globalSnap.data();
    } else {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        globalData = userDocSnap.data().global;
      }
    }

    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
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
    const local = await getLocalSchedule();
    return local || createDefaultData();
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './src/config/createDefaultData';

const LOCAL_KEY = 'guest_schedule';

// ------------------- ЛОКАЛЬНИЙ -------------------
export const getLocalSchedule = async () => {
  try {
    const localData = await AsyncStorage.getItem(LOCAL_KEY);
    return localData ? JSON.parse(localData) : null;
  } catch (e) {
    console.warn('Помилка читання локального розкладу:', e);
    return null;
  }
};

export const saveLocalSchedule = async (schedule) => {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(schedule));
  } catch (e) {
    console.warn('Помилка збереження локального розкладу:', e);
  }
};

// ------------------- ОТРИМАННЯ (FIREBASE) -------------------
export const getSchedule = async (userId) => {
  try {
    // 1. Отримуємо Global Settings
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);
    
    let globalData = null;
    if (globalSnap.exists()) {
      globalData = globalSnap.data();
    } else {
      // Фолбек для старої структури
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        globalData = userDocSnap.data().global;
      }
    }

    // 2. Отримуємо Schedules
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
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
    console.error("Error getting schedule:", error);
    const local = await getLocalSchedule();
    return local || createDefaultData();
  }
};

// ------------------- ЗБЕРЕЖЕННЯ (FIREBASE) -------------------
export const saveSchedule = async (userId, data) => {
  try {
    const batch = writeBatch(db);

    if (data.global) {
      const globalRef = doc(db, 'users', userId, 'global', 'settings');
      batch.set(globalRef, data.global, { merge: true });
    }

    if (data.schedules && Array.isArray(data.schedules)) {
      data.schedules.forEach((schedule) => {
        if (schedule && schedule.id) {
          const scheduleRef = doc(db, 'users', userId, 'schedules', schedule.id);
          batch.set(scheduleRef, schedule, { merge: true });
        }
      });
    }

    await batch.commit();
    await saveLocalSchedule(data);
    console.log("✅ [Cloud] Saved successfully");
  } catch (error) {
    console.error("❌ [Cloud] Save error:", error);
    throw error;
  }
};

// 🔥 НОВА ФУНКЦІЯ: Очищаємо ТІЛЬКИ розклади
export const resetUserSchedules = async (userId) => {
  try {
    const batch = writeBatch(db);
    
    // Беремо всі документи з підколекції schedules
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const snapshot = await getDocs(schedulesRef);

    if (snapshot.empty) return;

    // Видаляємо кожен документ розкладу
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // global і devices не чіпаємо!
    await batch.commit();
    console.log("✅ [Cloud] Schedules cleared (Global preserved)");
  } catch (error) {
    console.error("❌ [Cloud] Reset error:", error);
    throw error;
  }
};
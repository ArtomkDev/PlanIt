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
    // 1. Отримуємо Global Settings (users/{userId}/global/settings)
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);
    
    let globalData = null;
    if (globalSnap.exists()) {
      globalData = globalSnap.data();
    } else {
      // Якщо немає - перевіримо корінь документа юзера (стара версія)
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        globalData = userDocSnap.data().global;
      }
    }

    // 2. Отримуємо Schedules (users/{userId}/schedules/{scheduleId})
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);

    let schedulesList = schedulesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Якщо нічого немає - створюємо дефолтні
    if (!globalData && schedulesList.length === 0) {
      const defaultData = createDefaultData();
      // Повертаємо структуру, ScheduleProvider сам збереже її при першому сейві
      return defaultData; 
    }

    // Якщо глобальні дані пусті, але є розклади (рідкісний кейс)
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
    // Фолбек на локальні дані
    const local = await getLocalSchedule();
    return local || createDefaultData();
  }
};

// ------------------- ЗБЕРЕЖЕННЯ (FIREBASE) -------------------
export const saveSchedule = async (userId, data) => {
  try {
    const batch = writeBatch(db);

    // 1. Зберігаємо Global (в users/{userId}/global/settings)
    // Використовуємо підколекцію 'global', щоб не засмічувати документ юзера
    if (data.global) {
      const globalRef = doc(db, 'users', userId, 'global', 'settings');
      batch.set(globalRef, data.global, { merge: true });
    }

    // 2. Зберігаємо Schedules (в users/{userId}/schedules/{scheduleId})
    if (data.schedules && Array.isArray(data.schedules)) {
      data.schedules.forEach((schedule) => {
        if (schedule && schedule.id) {
          const scheduleRef = doc(db, 'users', userId, 'schedules', schedule.id);
          batch.set(scheduleRef, schedule, { merge: true });
        }
      });
    }

    // 3. Атомарний запис
    await batch.commit();

    // 4. Локальна копія
    await saveLocalSchedule(data);
    console.log("✅ [Cloud] Saved successfully to subcollections");

  } catch (error) {
    console.error("❌ [Cloud] Save error:", error);
    throw error;
  }
};
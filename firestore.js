import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import createDefaultData from './src/config/createDefaultData'

const LOCAL_KEY = 'guest_schedule'

// ------------------- ЛОКАЛЬНИЙ -------------------
export const getLocalSchedule = async () => {
  try {
    const localData = await AsyncStorage.getItem(LOCAL_KEY)
    return localData ? JSON.parse(localData) : null
  } catch (e) {
    console.warn('Помилка читання локального розкладу:', e)
    return null
  }
}

export const saveLocalSchedule = async (schedule) => {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(schedule))
  } catch (e) {
    console.warn('Помилка збереження локального розкладу:', e)
  }
}

// ------------------- ОТРИМАННЯ -------------------
export const getSchedule = async (userId) => {
  try {
    // --- 1. Читаємо глобальні дані
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);

    let global;
    if (globalSnap.exists()) {
      global = globalSnap.data();
    } else {
      // якщо немає → створюємо дефолтні
      const { globalData } = createDefaultData();
      global = globalData;
      await setDoc(globalRef, globalData);
    }

    // --- 2. Читаємо розклади
    const schedulesCol = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesCol);

    let schedules = schedulesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // якщо розкладів немає → створюємо дефолтний
    if (schedules.length === 0) {
      const { scheduleData } = createDefaultData();
      const newRef = doc(db, 'users', userId, 'schedules', scheduleData.id);
      await setDoc(newRef, scheduleData);
      schedules = [scheduleData];
    }

    const data = { global, schedules };
    await saveLocalSchedule(data);
    return data;
  } catch (e) {
    console.error('❌ Помилка отримання з Firebase:', e);
    const local = await getLocalSchedule();
    return local || { global: {}, schedules: [] };
  }
};

// ------------------- ЗБЕРЕЖЕННЯ -------------------
export const saveSchedule = async (userId, data) => {
  try {
    // --- Оновлюємо global/settings
    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    await setDoc(globalRef, data.global, { merge: true });

    // --- Оновлюємо розклади
    for (const schedule of data.schedules) {
      const schedRef = doc(db, 'users', userId, 'schedules', schedule.id);
      await setDoc(schedRef, schedule, { merge: true });
    }

    await saveLocalSchedule(data);
    console.log('✅ Дані збережено у Firebase + локально');
  } catch (e) {
    console.error('❌ Помилка збереження:', e);
  }
};

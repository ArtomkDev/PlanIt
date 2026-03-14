import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch,
  onSnapshot // ДОДАНО: Для підписки в реальному часі
} from "firebase/firestore";
import { db } from "./firebase";
import createDefaultData from './src/config/createDefaultData';

// НОВА ФУНКЦІЯ: Підписка на оновлення розкладу в реальному часі
export const subscribeToSchedule = (userId, onDataUpdate, onError) => {
  let globalData = null;
  let schedulesList = null;

  // Функція об'єднання: чекає, поки завантажаться І глобальні налаштування, І розклади
  const checkAndEmit = () => {
    if (globalData !== null && schedulesList !== null) {
      onDataUpdate({ global: globalData, schedules: schedulesList });
    }
  };

  // 1. Слухаємо зміни в глобальних налаштуваннях
  const globalRef = doc(db, 'users', userId, 'global', 'settings');
  const unsubGlobal = onSnapshot(globalRef, async (docSnap) => {
    if (docSnap.exists()) {
      globalData = docSnap.data();
    } else {
      // Для сумісності з дуже старими акаунтами, де global був у корневому документі
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().global) {
        globalData = userDocSnap.data().global;
      } else {
        globalData = createDefaultData().global;
      }
    }
    checkAndEmit();
  }, (error) => {
    if (onError) onError(error);
  });

  // 2. Слухаємо зміни в колекції розкладів
  const schedulesRef = collection(db, 'users', userId, 'schedules');
  const unsubSchedules = onSnapshot(schedulesRef, (querySnapshot) => {
    schedulesList = querySnapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    checkAndEmit();
  }, (error) => {
    if (onError) onError(error);
  });

  // Повертаємо функцію відписки, щоб викликати її при виході з акаунта або закритті додатку
  return () => {
    unsubGlobal();
    unsubSchedules();
  };
};

// СТАРА ФУНКЦІЯ: Залишаємо для сумісності (наприклад, для одноразового завантаження)
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
    console.error("Помилка завантаження з Firestore:", error);
    throw error; // Тепер ми прокидаємо помилку, щоб її обробив ScheduleProvider
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
// src/auth/migrateLocalToCloud.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import createDefaultData from '../config/createDefaultData';
import { generateId } from '../utils/idGenerator'; // ⚡️ Імпортуємо спільну утиліту

const LOCAL_KEY = 'guest_schedule';

export async function migrateLocalToCloud(userId) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const localData = raw ? JSON.parse(raw) : null;
    const userDocRef = doc(db, 'schedules', userId);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const cloud = snap.data().schedule || {};
      const cloudSchedules = Array.isArray(cloud.schedules) ? cloud.schedules : [];

      if (cloudSchedules.length > 0 && localData) {
        const existingIds = new Set(cloudSchedules.map(s => s.id));
        const mergedSchedules = cloudSchedules.slice();

        for (const ls of (localData.schedules || [])) {
          const copy = JSON.parse(JSON.stringify(ls));
          
          if (existingIds.has(copy.id)) {
            // ⚡️ Використовуємо надійний генератор ID
            copy.id = generateId(); 
          }
          mergedSchedules.push(copy);
        }

        const merged = { ...cloud, schedules: mergedSchedules };
        await setDoc(userDocRef, { schedule: merged }, { merge: true });

      } else if (localData) {
        // ... (решта коду без змін)
        const merged = {
          global: localData.global || createDefaultData().global,
          schedules: localData.schedules || [],
        };
        await setDoc(userDocRef, { schedule: merged }, { merge: true });
      }
    } else {
        // ... (решта коду без змін)
      const newData = localData || createDefaultData();
      const merged = {
        global: newData.global || createDefaultData().global,
        schedules: newData.schedules || [],
      };
      await setDoc(userDocRef, { schedule: merged });
    }

    if (localData) {
      await AsyncStorage.removeItem(LOCAL_KEY);
    }

    return { migrated: true };
  } catch (err) {
    console.error('migrateLocalToCloud error', err);
    return { migrated: false, reason: err.message || 'error' };
  }
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import createDefaultData from '../config/createDefaultData';
import { generateId } from '../utils/idGenerator';

const LOCAL_KEY = 'guest_schedule';

export async function migrateLocalToCloud(userId) {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const localData = raw ? JSON.parse(raw) : null;

    if (!localData) {
      return { migrated: false, reason: 'No local data found' };
    }

    const globalRef = doc(db, 'users', userId, 'global', 'settings');
    const globalSnap = await getDoc(globalRef);
    
    const schedulesRef = collection(db, 'users', userId, 'schedules');
    const schedulesSnap = await getDocs(schedulesRef);
    
    const cloudSchedules = schedulesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const existingIds = new Set(cloudSchedules.map(s => s.id));
    const mergedSchedules = [...cloudSchedules];

    for (const ls of (localData.schedules || [])) {
      const copy = JSON.parse(JSON.stringify(ls));
      
      if (existingIds.has(copy.id)) {
        copy.id = generateId(); 
      }
      mergedSchedules.push(copy);
    }

    const batch = writeBatch(db);

    const mergedGlobal = globalSnap.exists() 
      ? { ...localData.global, ...globalSnap.data() } 
      : (localData.global || createDefaultData().global);
      
    batch.set(globalRef, mergedGlobal, { merge: true });

    mergedSchedules.forEach((schedule) => {
      if (schedule && schedule.id) {
        const scheduleRef = doc(db, 'users', userId, 'schedules', schedule.id);
        batch.set(scheduleRef, schedule, { merge: true });
      }
    });

    await batch.commit();
    await AsyncStorage.removeItem(LOCAL_KEY);

    return { migrated: true };
  } catch (err) {
    return { migrated: false, reason: err.message || 'Error during migration' };
  }
}
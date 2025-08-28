import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import defaultSchedule from './src/config/defaultSchedule';
import createDefaultData from './src/config/createDefaultData';


// Отримання локального розкладу
const getLocalSchedule = async () => {
	try {
		const localData = await AsyncStorage.getItem('user_schedule')
		return localData ? JSON.parse(localData) : null
	} catch (error) {
		console.error('Помилка зчитування локального розкладу:', error)
		return null
	}
}

// Збереження локального розкладу
const saveLocalSchedule = async schedule => {
	try {
		await AsyncStorage.setItem('user_schedule', JSON.stringify(schedule))
	} catch (error) {
		console.error('Помилка збереження локального розкладу:', error)
	}
}

// Отримання розкладу
export const getSchedule = async userId => {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) {
    console.log('Немає інтернету. Завантаження локального розкладу...');
    const local = await getLocalSchedule();
    return local || createDefaultData();
  }

  try {
    const userDocRef = doc(db, 'schedules', userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const schedule = docSnap.data().schedule;
      await saveLocalSchedule(schedule);
      return schedule;
    } else {
      const newData = createDefaultData();
      await setDoc(userDocRef, { schedule: newData });
      await saveLocalSchedule(newData);
      return newData;
    }
  } catch (error) {
    console.error('Помилка отримання розкладу:', error);
    const local = await getLocalSchedule();
    return local || createDefaultData();
  }
};

// Збереження розкладу
export const saveSchedule = async (userId, schedule) => {
	try {
		const userDocRef = doc(db, 'schedules', userId)
		await setDoc(userDocRef, { schedule }, { merge: true })
		await saveLocalSchedule(schedule)
		console.log('Розклад успішно збережено в Firebase та локально.')
		console.log(schedule)
	} catch (error) {
		console.error('Помилка збереження розкладу в Firebase:', error)
	}
}
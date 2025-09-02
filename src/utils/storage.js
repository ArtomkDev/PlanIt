import AsyncStorage from '@react-native-async-storage/async-storage'

const LOCAL_KEY = 'guest_schedule'

export async function getLocalSchedule() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('Помилка читання локального розкладу', e)
    return null
  }
}

export async function saveLocalSchedule(data) {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Помилка збереження локального розкладу', e)
  }
}

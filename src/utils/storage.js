import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_KEY = 'guest_schedule';
const DEVICE_SETTINGS_KEY = 'app_device_settings';

const getStorageKey = (userId) => {
  return userId ? `user_schedule_${userId}` : GUEST_KEY;
};

export async function getLocalSchedule(userId = null) {
  const key = getStorageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`Помилка читання локального розкладу для ключа ${key}`, e);
    return null;
  }
}

export async function saveLocalSchedule(data, userId = null) {
  const key = getStorageKey(userId);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Помилка збереження локального розкладу для ключа ${key}`, e);
  }
}

export async function clearLocalSchedule(userId = null) {
  const key = getStorageKey(userId);
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn(`Помилка видалення локального розкладу для ключа ${key}`, e);
  }
}

export async function getDevicePrefs() {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export async function saveDevicePrefs(prefs) {
  try {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn(`Помилка збереження налаштувань пристрою`, e);
  }
}
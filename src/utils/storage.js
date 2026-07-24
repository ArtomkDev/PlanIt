import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeStorageValue, encodeStorageValue, isEncodedStorageValue } from './dataCodec';

const GUEST_KEY = 'guest_schedule';
const DEVICE_SETTINGS_KEY = 'app_device_settings';

const getStorageKey = (userId) => {
  return userId ? `user_schedule_${userId}` : GUEST_KEY;
};

export async function getLocalSchedule(userId = null) {
  const key = getStorageKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const decoded = decodeStorageValue(raw);
    if (decoded && !isEncodedStorageValue(raw)) {
      await AsyncStorage.setItem(key, encodeStorageValue(decoded));
    }
    return decoded;
  } catch (e) {
    console.error(`Failed to read local schedule for key: ${key}`, e);
    return null;
  }
}

export async function saveLocalSchedule(data, userId = null) {
  const key = getStorageKey(userId);
  try {
    await AsyncStorage.setItem(key, encodeStorageValue(data));
  } catch (e) {
    console.error(`Failed to save local schedule for key: ${key}`, e);
  }
}

export async function clearLocalSchedule(userId = null, options = {}) {
  const key = getStorageKey(userId);
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to clear local schedule for key: ${key}`, e);
    if (options.throwOnError) throw e;
  }
}

export async function getDevicePrefs() {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return {};

    const decoded = decodeStorageValue(raw, {});
    if (!isEncodedStorageValue(raw)) {
      await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, encodeStorageValue(decoded));
    }
    return decoded;
  } catch (e) {
    return {};
  }
}

export async function saveDevicePrefs(prefs) {
  try {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, encodeStorageValue(prefs));
  } catch (e) {
    console.error('Failed to save device settings', e);
  }
}

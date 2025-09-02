import {
  doc,
  setDoc,
  getDocs,
  collection,
  getDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";

// ключ для локального ID
// ключ для локального ID
const DEVICE_KEY = "local_device_id";

// локальний генератор ID (fallback)
function generateLocalId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

// отримаємо/створимо deviceId (тільки для пристрою, без userId!)
export async function getDeviceId() {
  let localId = await AsyncStorage.getItem(DEVICE_KEY);
  if (!localId) {
    localId = generateLocalId();
    await AsyncStorage.setItem(DEVICE_KEY, localId);
  }
  return localId;
}

// інфо про пристрій
export function getDeviceInfo() {
  if (Platform.OS === "web") {
    return {
      name: navigator.userAgent || "Web Browser",
      platform: "Web",
      appVersion: navigator.appVersion || "Unknown",
    };
  }
  return {
    name: Device.deviceName ?? "Unknown Device",
    platform: Device.osName ?? "Unknown",
    appVersion: Device.osVersion ?? "Unknown",
    brand: Device.brand ?? "Unknown",
    model: Device.modelName ?? "Unknown",
  };
}

// реєстрація/оновлення пристрою
export async function registerDevice(userId) {
  if (!userId) return;

  try {
    const deviceId = await getDeviceId(userId);
    const ref = doc(db, "users", userId, "devices", deviceId);
    const snap = await getDoc(ref);
    const { name, platform, appVersion } = getDeviceInfo();

    if (snap.exists()) {
      if (snap.data().isActive === false) {
        await updateDoc(ref, {
          isActive: true,
          lastLogin: new Date().toISOString(),
          appVersion,
        });
        console.warn(`♻️ Пристрій [${name}] (${platform}) знову активований`);
        return;
      }
      await updateDoc(ref, {
        lastLogin: new Date().toISOString(),
        appVersion,
      });
      console.log(`✅ Пристрій [${name}] (${platform}) оновлений`);
    } else {
      await setDoc(ref, {
        name,
        platform,
        lastLogin: new Date().toISOString(),
        isActive: true,
        appVersion,
      });
      console.log(`🆕 Пристрій [${name}] (${platform}) доданий`);
    }
  } catch (err) {
    console.error("❌ Помилка при реєстрації пристрою:", err);
  }
}

// отримати всі пристрої юзера
export async function getDevices(userId) {
  if (!userId) return [];
  const devicesRef = collection(db, "users", userId, "devices");
  const snap = await getDocs(devicesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// вимкнути пристрій
export async function deactivateDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await updateDoc(ref, { isActive: false });

  const currentId = await getDeviceId(userId);
  if (deviceId === currentId) {
    await AsyncStorage.clear();
  }
}

// вимкнути всі, крім поточного
export async function deactivateAllExceptCurrent(userId) {
  if (!userId) return;
  const currentId = await getDeviceId(userId);
  const devices = await getDevices(userId);
  for (const d of devices) {
    if (d.id !== currentId) {
      await deactivateDevice(userId, d.id);
    }
  }
}

// перевірка статусу пристрою
export async function checkDeviceStatus(userId) {
  if (!userId) return false;
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().isActive !== false : true;
}

// live-слухач для поточного пристрою
export function listenDeviceStatus(userId) {
  if (!userId) return () => {};
  return (async () => {
    const deviceId = await getDeviceId(userId);
    const ref = doc(db, "users", userId, "devices", deviceId);

    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (snap.exists() && snap.data().isActive === false) {
        console.warn("⛔ Цей пристрій від’єднано → вихід з акаунта");
        await AsyncStorage.clear();
        await signOut(auth);
      }
    });

    return unsubscribe;
  })();
}

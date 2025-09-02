// deviceService.js
import { 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  getDoc, 
  updateDoc 
} from "firebase/firestore";
import { db } from "../../firebase";
import * as Device from "expo-device";
import { Platform } from "react-native";


// Отримуємо унікальний ID для цього пристрою
// ⚡ Expo Device не має "getUniqueId", тому формуємо свій ID
export function getDeviceId(userId) {
  if (Platform.OS === "web") {
    return `web-${userId || "guest"}`; // fallback для браузера
  }
  // Для мобільних можна використати комбінацію brand+model+id
  return `${Device.osName}-${Device.modelName}-${userId || "guest"}`;
}

// Отримуємо інформацію про пристрій
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

// Додаємо або оновлюємо пристрій
// deviceService.js
export async function registerDevice(userId) {
  if (!userId) {
    console.warn("⚠️ userId відсутній — пристрій не можна зареєструвати");
    return;
  }

  try {
    const deviceId = getDeviceId(userId);
    const ref = doc(db, "users", userId, "devices", deviceId);
    const snap = await getDoc(ref);

    // якщо пристрій вже існує і деактивований → не оновлюємо його
    if (snap.exists() && snap.data().isActive === false) {
      console.warn("⛔ Цей пристрій деактивований");
      return;
    }

    // якщо пристрій новий або активний → оновлюємо дані
    const { name, platform, appVersion } = getDeviceInfo();
    await setDoc(ref, {
      name,
      platform,
      lastLogin: new Date().toISOString(),
      isActive: true,
      appVersion,
    }, { merge: true });

    console.log(`✅ Пристрій [${name}] (${platform}) збережений у Firebase`);
  } catch (err) {
    console.error("❌ Помилка при реєстрації пристрою:", err);
  }
}


// Отримуємо список пристроїв
export async function getDevices(userId) {
  if (!userId) return [];
  const devicesRef = collection(db, "users", userId, "devices");
  const snap = await getDocs(devicesRef);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Від’єднуємо один пристрій
export async function deactivateDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await updateDoc(ref, { isActive: false });
}

// Від’єднуємо всі крім поточного
export async function deactivateAllExceptCurrent(userId) {
  if (!userId) return;
  const currentId = getDeviceId(userId);
  const devices = await getDevices(userId);
  for (const d of devices) {
    if (d.id !== currentId) {
      await deactivateDevice(userId, d.id);
    }
  }
}

// Перевіряємо чи цей пристрій активний
export async function checkDeviceStatus(userId) {
  if (!userId) return false;
  const deviceId = getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().isActive === false) {
    return false;
  }
  return true;
}

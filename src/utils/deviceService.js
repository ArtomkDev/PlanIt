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
import * as Crypto from "expo-crypto";
import { signOut } from "firebase/auth";

// 🔑 Генерація стабільного deviceId
export async function getDeviceId(userId) {
  let rawDeviceId;

  if (Platform.OS === "web") {
    rawDeviceId = navigator.userAgent || "WebBrowser";
  } else {
    rawDeviceId = `${Device.brand || "Unknown"}-${Device.modelName || "Unknown"}-${Device.deviceName || "Unknown"}`;
  }

  const input = `${userId}-${rawDeviceId}`;

  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

// ℹ️ Інфо про пристрій
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
    brand: Device.brand ?? "Unknown",
    model: Device.modelName ?? "Unknown",
    appVersion: "Unknown",
  };
}

// 📝 Реєстрація/оновлення пристрою
export async function registerDevice(userId) {
  if (!userId) return;

  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const snap = await getDoc(ref);
  const { name, platform, appVersion } = getDeviceInfo();

  if (snap.exists()) {
    const data = snap.data();

    if (data.isActive === false) {
      console.warn("⛔ Цей пристрій був від’єднаний → дозволяємо повторну авторизацію");
      await setDoc(ref, {
        name,
        platform,
        lastLogin: new Date().toISOString(),
        isActive: true,
        appVersion,
      });
      console.log(`🔓 Пристрій [${name}] (${platform}) повторно підключено`);
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
}


// 📥 Отримати всі пристрої юзера
export async function getDevices(userId) {
  if (!userId) return [];
  const devicesRef = collection(db, "users", userId, "devices");
  const snap = await getDocs(devicesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ❌ Вимкнути пристрій
export async function deactivateDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await updateDoc(ref, { isActive: false });

  const currentId = await getDeviceId(userId);
  if (deviceId === currentId) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Помилка при виході:", err);
    }
  }
}

// ❌ Вимкнути всі, крім поточного
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

// ✅ Перевірка статусу пристрою
export async function checkDeviceStatus(userId) {
  if (!userId) return false;
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().isActive !== false : true;
}

// 👂 Live-слухач для поточного пристрою
export async function listenDeviceStatus(userId) {
  if (!userId) return () => {};
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);

  return onSnapshot(ref, async (snap) => {
    if (snap.exists() && snap.data().isActive === false) {
      console.warn("⛔ Цей пристрій від’єднано → вихід з акаунта");
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Помилка при виході:", err);
      }
    }
  });
}

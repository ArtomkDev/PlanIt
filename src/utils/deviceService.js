import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
  getDoc,
  writeBatch,
  deleteField
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as Device from "expo-device";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { signOut } from "firebase/auth";

let isAccountBeingDeleted = false;

export function setIgnoreDeviceRemoval(status) {
  isAccountBeingDeleted = status;
}

export async function getDeviceId(userId) {
  let rawDeviceId;
  if (Platform.OS === "web") {
    rawDeviceId = navigator.userAgent || "WebBrowser";
  } else {
    rawDeviceId = `${Device.brand || "Unknown"}-${Device.modelName || "Unknown"}-${Device.deviceName || "Unknown"}`;
  }
  const input = `${userId}-${rawDeviceId}`;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export function getDeviceInfo() {
  if (Platform.OS === "web") {
    return { name: navigator.userAgent || "Web Browser", platform: "Web" };
  }
  return {
    name: Device.deviceName ?? "Unknown Device",
    platform: Device.osName ?? "Unknown",
    brand: Device.brand ?? "Unknown",
    model: Device.modelName ?? "Unknown",
  };
}

export async function registerDevice(userId) {
  if (!userId) return;

  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const deviceInfo = { ...getDeviceInfo(), lastLogin: new Date().toISOString() };
  await setDoc(ref, deviceInfo, { merge: true });
  console.log(`✅ Device [${deviceInfo.name}] registered/updated.`);

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.pendingEmail && userData.pendingEmail === currentUser.email.toLowerCase()) {
          console.log("🔒 Перший вхід після зміни пошти. Очищення бази від старих сесій...");
          const batch = writeBatch(db);

          const devicesRef = collection(db, "users", userId, "devices");
          const devicesSnap = await getDocs(devicesRef);
          
          devicesSnap.forEach(d => {
            if (d.id !== deviceId) {
              batch.delete(d.ref);
            }
          });

          batch.update(userRef, { pendingEmail: deleteField() });

          await batch.commit();
          console.log("✅ Старі сесії та pendingEmail успішно видалено.");
        }
      }
    } catch (error) {
      console.warn("Security check warning:", error);
    }
  }
}

export async function listenForDeviceRemoval(userId, onRemoved) {
  if (!userId) return () => {};
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);

  const unsubscribeDevice = onSnapshot(ref, (docSnap) => {
    if (!auth.currentUser) return;

    if (!docSnap.exists()) {
      if (isAccountBeingDeleted) return;
      console.log("Device was removed from another location. Forcing logout.");
      onRemoved();
    }
  }, (error) => {
    if (error.code === 'permission-denied') return;
    console.warn("Device listener error:", error);
  });

  const userRef = doc(db, "users", userId);
  let checkInterval = null;
  let isChecking = false;

  const unsubscribeSecurity = onSnapshot(userRef, (docSnap) => {
    if (!auth.currentUser) return;

    if (docSnap.exists()) {
      const userData = docSnap.data();

      if (userData.pendingEmail) {
        if (!checkInterval) {
          checkInterval = setInterval(async () => {
            if (isChecking) return;
            isChecking = true;

            const currentUser = auth.currentUser;
            if (currentUser) {
              try {
                await currentUser.reload();
                
                if (currentUser.email && currentUser.email.toLowerCase() === userData.pendingEmail.toLowerCase()) {
                  clearInterval(checkInterval);
                  checkInterval = null;
                  console.log("Пошту змінено, виходимо...");
                  signOut(auth);
                }
              } catch (error) {
                clearInterval(checkInterval);
                checkInterval = null;
                console.log("Токен анульовано сервером, виходимо...");
                signOut(auth);
              } finally {
                isChecking = false;
              }
            } else {
               isChecking = false;
            }
          }, 4000);
        }
      } else {
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    }
  }, (error) => {
    if (error.code === 'permission-denied') return;
    console.warn("Security listener error:", error);
  });

  return () => {
    unsubscribeDevice();
    unsubscribeSecurity();
    if (checkInterval) clearInterval(checkInterval);
  };
}

export async function getDevices(userId) {
  if (!userId) return [];
  const devicesRef = collection(db, "users", userId, "devices");
  const snap = await getDocs(devicesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function removeDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await deleteDoc(ref);
}

export async function removeAllOtherDevices(userId) {
  if (!userId) return;
  const currentId = await getDeviceId(userId);
  const devices = await getDevices(userId);
  for (const d of devices) {
    if (d.id !== currentId) {
      await removeDevice(userId, d.id);
    }
  }
}
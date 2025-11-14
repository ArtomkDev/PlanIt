import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "../../firebase";
import * as Device from "expo-device";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { signOut } from "firebase/auth";

// Generates a stable, unique ID for the device.
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

// Gathers information about the current device.
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

// Registers the device in Firestore on login.
export async function registerDevice(userId) {
  if (!userId) return;
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const deviceInfo = { ...getDeviceInfo(), lastLogin: new Date().toISOString() };
  await setDoc(ref, deviceInfo, { merge: true });
  console.log(`✅ Device [${deviceInfo.name}] registered/updated.`);
}

// Listens for changes to the current device's document in Firestore.
export async function listenForDeviceRemoval(userId, onRemoved) {
  if (!userId) return () => {};
  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);

  const unsubscribe = onSnapshot(ref, (docSnap) => {
    // If the document does not exist, it means the device was removed.
    if (!docSnap.exists()) {
      console.log("Device was removed from another location. Forcing logout.");
      onRemoved();
    }
  });

  return unsubscribe;
}

// Fetches the list of all devices for a user.
export async function getDevices(userId) {
  if (!userId) return [];
  const devicesRef = collection(db, "users", userId, "devices");
  const snap = await getDocs(devicesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Removes a specific device.
export async function removeDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await deleteDoc(ref);
  console.log(`🗑️ Device with ID: ${deviceId} has been removed.`);
}

// Removes all devices except the current one.
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

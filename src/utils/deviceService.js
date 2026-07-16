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
import { db, auth } from "../config/firebase";
import * as Device from "expo-device";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { signOut } from "firebase/auth";
import {
  NOTIFICATION_TYPES,
  createLoginNotification,
  getCurrentDevicePushRegistration,
  getUserNotificationContext,
  isNotificationPushEnabled,
  syncDevicePushRegistration,
} from "../services/notificationService";

let isAccountBeingDeleted = false;
const UNKNOWN_IP = "Unknown IP";
const PUBLIC_IP_ENDPOINT = "https://api.ipify.org?format=json";
const PUBLIC_IP_TIMEOUT_MS = 3500;

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
    return {
      name: navigator.userAgent || "Web Browser",
      platform: "Web",
      brand: "Web",
      model: "Browser",
    };
  }
  return {
    name: Device.deviceName ?? "Unknown Device",
    platform: Device.osName ?? "Unknown",
    brand: Device.brand ?? "Unknown",
    model: Device.modelName ?? "Unknown",
  };
}

export async function getPublicIpAddress() {
  try {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(UNKNOWN_IP), PUBLIC_IP_TIMEOUT_MS);
    });

    const fetchPromise = fetch(PUBLIC_IP_ENDPOINT, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return UNKNOWN_IP;
        const data = await response.json();
        const ip = typeof data?.ip === "string" ? data.ip.trim() : "";
        return ip || UNKNOWN_IP;
      })
      .catch(() => UNKNOWN_IP);

    const ipAddress = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return ipAddress || UNKNOWN_IP;
  } catch (error) {
    return UNKNOWN_IP;
  }
}

export async function registerDevice(userId, options = {}) {
  if (!userId) return;

  const deviceId = await getDeviceId(userId);
  const ref = doc(db, "users", userId, "devices", deviceId);
  const deviceInfo = getDeviceInfo();
  const now = new Date();
  const nowIso = now.toISOString();
  const ipAddress = await getPublicIpAddress();
  const shouldCreateLoginNotification = options.createLoginNotification === true;
  const notificationContext = await getUserNotificationContext(userId);
  const notificationPreferences = notificationContext.notificationPreferences || {};
  const shouldRequestPushPermissions = options.requestNotificationPermissions === true
    || (
      options.requestNotificationPermissions !== false
      && Platform.OS !== "web"
      && (
        isNotificationPushEnabled(notificationPreferences, NOTIFICATION_TYPES.ACCOUNT_LOGIN)
        || isNotificationPushEnabled(notificationPreferences, NOTIFICATION_TYPES.LESSON_REMINDER)
      )
    );
  let loginNotificationAt = null;
  const pushRegistration = await getCurrentDevicePushRegistration({
    request: shouldRequestPushPermissions,
  });

  if (shouldCreateLoginNotification) {
    try {
      await createLoginNotification(userId, {
        deviceId,
        deviceName: deviceInfo.name,
        platform: deviceInfo.platform,
        ipAddress,
        createdAt: nowIso,
        lang: options.lang || notificationContext.language,
        notificationPreferences,
        sourceExpoPushToken: pushRegistration?.expoPushToken,
        metadata: {
          brand: deviceInfo.brand || null,
          model: deviceInfo.model || null,
        },
      });
      loginNotificationAt = nowIso;
    } catch (error) {
      console.error(error);
    }
  }

  const deviceUpdate = {
    ...deviceInfo,
    lastLogin: nowIso,
    lastSeenAt: nowIso,
    lastIpAddress: ipAddress,
    lastIpUpdatedAt: nowIso,
  };

  if (loginNotificationAt) {
    deviceUpdate.lastLoginNotificationAt = loginNotificationAt;
  }

  if (pushRegistration) {
    Object.assign(deviceUpdate, pushRegistration);
  }
  
  await setDoc(ref, deviceUpdate, { merge: true });

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.pendingEmail && userData.pendingEmail === currentUser.email.toLowerCase()) {
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
        }
      }
    } catch (error) {
      console.error(error);
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
      onRemoved();
    }
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error(error);
    }
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
                  signOut(auth);
                }
              } catch (error) {
                clearInterval(checkInterval);
                checkInterval = null;
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
    if (error.code !== 'permission-denied') {
      console.error(error);
    }
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

export async function refreshCurrentDevicePushRegistration(userId, options = {}) {
  if (!userId) return null;

  const deviceId = await getDeviceId(userId);
  return syncDevicePushRegistration(userId, deviceId, options);
}

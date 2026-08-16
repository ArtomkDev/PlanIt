import {
  doc,
  setDoc,
  getDocs,
  collection,
  onSnapshot,
  getDoc,
  writeBatch,
  deleteField,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../config/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
const INSTALLATION_ID_STORAGE_KEY = "planit_installation_id_v1";
const INSTALLATION_ID_RE = /^[a-zA-Z0-9_-]{16,96}$/;
const DEVICE_INACTIVITY_EXPIRY_MS = 180 * 24 * 60 * 60 * 1000;
const DEVICE_WRITE_BATCH_LIMIT = 450;
let installationIdPromise = null;

export const DEVICE_STATUS = Object.freeze({
  ACTIVE: "active",
  REVOKED: "revoked",
  EXPIRED: "expired",
});

const createDeviceRevocationPatch = (
  reason = "user",
  status = DEVICE_STATUS.REVOKED
) => ({
  status,
  revokedAt: serverTimestamp(),
  revokedReason: reason,
  expoPushToken: deleteField(),
  pushPermissionStatus: deleteField(),
  pushTokenPlatform: deleteField(),
  pushTokenUpdatedAt: deleteField(),
  pushTokenError: deleteField(),
  lastIpAddress: deleteField(),
  lastIpUpdatedAt: deleteField(),
  lastSyncTime: deleteField(),
  name: deleteField(),
  platform: deleteField(),
  brand: deleteField(),
  model: deleteField(),
  createdAt: deleteField(),
  lastLogin: deleteField(),
  lastSeenAt: deleteField(),
  lastLoginNotificationAt: deleteField(),
});

const timestampToMs = (value) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return null;
};

const revokeDeviceRefsInChunks = async (
  deviceRefs,
  reason = "user",
  status = DEVICE_STATUS.REVOKED,
) => {
  for (let offset = 0; offset < deviceRefs.length; offset += DEVICE_WRITE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    deviceRefs
      .slice(offset, offset + DEVICE_WRITE_BATCH_LIMIT)
      .forEach((deviceRef) => {
        batch.set(deviceRef, createDeviceRevocationPatch(reason, status), { merge: true });
      });
    await batch.commit();
  }
};

const expireInactiveDevices = async (userId, currentDeviceId, nowMs = Date.now()) => {
  const devicesSnap = await getDocs(collection(db, "users", userId, "devices"));
  const staleDeviceRefs = [];

  devicesSnap.docs.forEach((deviceSnap) => {
    if (deviceSnap.id === currentDeviceId) return;
    const device = deviceSnap.data() || {};
    if ((device.status || DEVICE_STATUS.ACTIVE) !== DEVICE_STATUS.ACTIVE) return;
    const lastActivityAt = Math.max(
      timestampToMs(device.lastSeenAt) || 0,
      timestampToMs(device.lastLogin) || 0,
      timestampToMs(device.lastSyncTime) || 0,
    );
    if (lastActivityAt <= 0 || nowMs - lastActivityAt < DEVICE_INACTIVITY_EXPIRY_MS) return;

    staleDeviceRefs.push(deviceSnap.ref);
  });

  await revokeDeviceRefsInChunks(
    staleDeviceRefs,
    "inactivity",
    DEVICE_STATUS.EXPIRED,
  );
};

export function setIgnoreDeviceRemoval(status) {
  isAccountBeingDeleted = status;
}

const createInstallationId = async () => {
  if (typeof Crypto.randomUUID === "function") {
    return Crypto.randomUUID();
  }

  const entropy = `${Date.now()}-${Math.random()}-${Platform.OS}-${Device.modelName || "device"}`;
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, entropy);
  return `installation_${digest.slice(0, 48)}`;
};

const loadOrCreateInstallationId = async () => {
  try {
    const stored = await AsyncStorage.getItem(INSTALLATION_ID_STORAGE_KEY);
    if (stored && INSTALLATION_ID_RE.test(stored)) return stored;
  } catch (error) {}

  const installationId = await createInstallationId();
  try {
    await AsyncStorage.setItem(INSTALLATION_ID_STORAGE_KEY, installationId);
  } catch (error) {}
  return installationId;
};

export async function getDeviceId() {
  if (!installationIdPromise) {
    installationIdPromise = loadOrCreateInstallationId().catch((error) => {
      installationIdPromise = null;
      throw error;
    });
  }
  return installationIdPromise;
}

const boundedText = (value, fallback, maxLength) => {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return normalized.slice(0, maxLength);
};

export function getDeviceInfo() {
  if (Platform.OS === "web") {
    return {
      name: boundedText(navigator.userAgent, "Web Browser", 512),
      platform: "Web",
      brand: "Web",
      model: "Browser",
    };
  }
  return {
    name: boundedText(Device.deviceName, "Unknown Device", 512),
    platform: boundedText(Device.osName, "Unknown", 40),
    brand: boundedText(Device.brand, "Unknown", 80),
    model: boundedText(Device.modelName, "Unknown", 120),
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

  const deviceId = await getDeviceId();
  const ref = doc(db, "users", userId, "devices", deviceId);
  const existingSnap = await getDoc(ref);
  const existingData = existingSnap.exists() ? existingSnap.data() || {} : {};
  const existingStatus = existingData.status || DEVICE_STATUS.ACTIVE;
  const isBlocked = existingStatus === DEVICE_STATUS.REVOKED
    || existingStatus === DEVICE_STATUS.EXPIRED;

  if (isBlocked && options.allowReactivation !== true) {
    const error = new Error("This device session has been revoked.");
    error.code = "device/revoked";
    error.deviceId = deviceId;
    throw error;
  }

  const deviceInfo = getDeviceInfo();
  const now = Timestamp.now();
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
        createdAt: now,
        lang: options.lang || notificationContext.language,
        notificationPreferences,
        sourceExpoPushToken: pushRegistration?.expoPushToken,
        metadata: {
          brand: deviceInfo.brand || null,
          model: deviceInfo.model || null,
        },
      });
      loginNotificationAt = now;
    } catch (error) {
      console.error(error);
    }
  }

  const deviceUpdate = {
    ...deviceInfo,
    status: DEVICE_STATUS.ACTIVE,
    lastLogin: now,
    lastSeenAt: now,
    lastIpAddress: ipAddress,
    lastIpUpdatedAt: now,
    revokedAt: deleteField(),
    revokedReason: deleteField(),
  };

  if (!existingSnap.exists() || !existingData.createdAt) {
    deviceUpdate.createdAt = now;
  }

  if (loginNotificationAt) {
    deviceUpdate.lastLoginNotificationAt = loginNotificationAt;
  }

  if (pushRegistration) {
    Object.assign(deviceUpdate, pushRegistration);
  }
  
  await setDoc(ref, deviceUpdate, { merge: true });
  await expireInactiveDevices(userId, deviceId).catch(() => {});

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.pendingEmail && userData.pendingEmail === currentUser.email.toLowerCase()) {
          const devicesRef = collection(db, "users", userId, "devices");
          const devicesSnap = await getDocs(devicesRef);
          const otherActiveDeviceRefs = devicesSnap.docs
            .filter((deviceSnap) => (
              deviceSnap.id !== deviceId
              && (deviceSnap.data()?.status || DEVICE_STATUS.ACTIVE) === DEVICE_STATUS.ACTIVE
            ))
            .map((deviceSnap) => deviceSnap.ref);

          await revokeDeviceRefsInChunks(otherActiveDeviceRefs, "email_change");
          await setDoc(userRef, { pendingEmail: deleteField() }, { merge: true });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}

export async function listenForDeviceRemoval(userId, onRemoved) {
  if (!userId) return () => {};
  
  const deviceId = await getDeviceId();
  const ref = doc(db, "users", userId, "devices", deviceId);

  const unsubscribeDevice = onSnapshot(ref, (docSnap) => {
    if (!auth.currentUser) return;

    if (!docSnap.exists()) return;
    const status = docSnap.data()?.status || DEVICE_STATUS.ACTIVE;
    if (status !== DEVICE_STATUS.ACTIVE) {
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
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((device) => (device.status || DEVICE_STATUS.ACTIVE) === DEVICE_STATUS.ACTIVE);
}

export async function removeDevice(userId, deviceId) {
  if (!userId || !deviceId) return;
  const ref = doc(db, "users", userId, "devices", deviceId);
  await setDoc(ref, createDeviceRevocationPatch("user"), { merge: true });
}

export async function removeAllOtherDevices(userId) {
  if (!userId) return;
  const currentId = await getDeviceId();
  const devices = await getDevices(userId);
  for (const d of devices) {
    if (d.id !== currentId) {
      await removeDevice(userId, d.id);
    }
  }
}

export async function refreshCurrentDevicePushRegistration(userId, options = {}) {
  if (!userId) return null;

  const deviceId = await getDeviceId();
  return syncDevicePushRegistration(userId, deviceId, options);
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const NOTIFICATION_TYPES = {
  ACCOUNT_LOGIN: "account_login",
};

const notificationsCollection = (userId) => collection(db, "users", userId, "notifications");

const nowIso = () => new Date().toISOString();

export async function createLoginNotification(userId, loginInfo = {}) {
  if (!userId) return null;

  const createdAt = loginInfo.createdAt || nowIso();
  const deviceName = loginInfo.deviceName || "Unknown Device";
  const platform = loginInfo.platform || "Unknown";
  const ipAddress = loginInfo.ipAddress || "Unknown IP";

  const payload = {
    type: NOTIFICATION_TYPES.ACCOUNT_LOGIN,
    title: loginInfo.title || "Account login",
    message: loginInfo.message || `Signed in from ${deviceName}`,
    createdAt,
    readAt: null,
    deviceId: loginInfo.deviceId || null,
    deviceName,
    platform,
    ipAddress,
    metadata: {
      ...(loginInfo.metadata || {}),
    },
  };

  const notificationRef = await addDoc(notificationsCollection(userId), payload);
  return { id: notificationRef.id, ...payload };
}

export function subscribeToNotifications(userId, callback) {
  if (!userId) return () => {};

  const notificationsQuery = query(
    notificationsCollection(userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(notifications);
    },
    (error) => {
      console.error(error);
      callback([]);
    }
  );
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return;

  const notificationRef = doc(db, "users", userId, "notifications", notificationId);
  const batch = writeBatch(db);
  batch.update(notificationRef, { readAt: nowIso() });
  await batch.commit();
}

export async function markAllNotificationsAsRead(userId) {
  if (!userId) return;

  const snapshot = await getDocs(notificationsCollection(userId));
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  const readAt = nowIso();
  let hasUpdates = false;

  snapshot.docs.forEach((docSnap) => {
    if (!docSnap.data().readAt) {
      batch.update(docSnap.ref, { readAt });
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    await batch.commit();
  }
}

export async function deleteNotification(userId, notificationId) {
  if (!userId || !notificationId) return;

  await deleteDoc(doc(db, "users", userId, "notifications", notificationId));
}

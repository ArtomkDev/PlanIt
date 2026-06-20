import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export const generateShareCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createSharedSchedule = async (user, scheduleData, durationDays) => {
  if (!user || !scheduleData) throw new Error("Missing user or schedule data");

  const shareCode = generateShareCode();
  const createdAt = Date.now();
  const expiresAtDate = new Date(createdAt + durationDays * 24 * 60 * 60 * 1000);

  const sharedDoc = {
    id: shareCode,
    ownerId: user.uid,
    ownerName: user.displayName || user.email || "User",
    scheduleName: scheduleData.name || "Untitled",
    scheduleData: scheduleData,
    createdAt,
    expiresAt: expiresAtDate,
    isActive: true,
  };

  await setDoc(doc(db, "shared_schedules", shareCode), sharedDoc);
  return shareCode;
};

export const fetchSharedSchedule = async (shareCode) => {
  if (!shareCode) throw new Error("Code is required");

  const docRef = doc(db, "shared_schedules", shareCode.toUpperCase());
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("not_found");
  }

  const data = docSnap.data();

  if (!data.isActive) {
    throw new Error("inactive");
  }

  const expirationTime = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt;

  if (Date.now() > expirationTime) {
    throw new Error("expired");
  }

  return data;
};

export const getUserSharedSchedules = async (userId) => {
  if (!userId) return [];

  const q = query(collection(db, "shared_schedules"), where("ownerId", "==", userId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => doc.data()).sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteSharedSchedule = async (shareCode) => {
  const docRef = doc(db, "shared_schedules", shareCode);
  await deleteDoc(docRef);
};
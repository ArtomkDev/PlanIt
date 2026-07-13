import { doc, getDoc, collection, query, where, getDocs, deleteDoc, setDoc } from "firebase/firestore";
import * as Crypto from "expo-crypto";
import { db } from "../config/firebase";
import {
  decodeSharedScheduleDocument,
  encodeSharedScheduleDocument,
} from "../utils/scheduleDocumentCodec";

const SHARE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MIN_SHARE_CODE_LENGTH = 5;
const MAX_SHARE_CODE_LENGTH = 32;
const SHARE_CODE_ATTEMPTS_PER_LENGTH = 5;
const SHARE_CODE_RE = /^[A-Z0-9]{5,32}$/;

const normalizeCodeLength = (length) => {
  const numericLength = Math.floor(Number(length) || MIN_SHARE_CODE_LENGTH);
  return Math.min(MAX_SHARE_CODE_LENGTH, Math.max(MIN_SHARE_CODE_LENGTH, numericLength));
};

export const generateShareCode = (length = MIN_SHARE_CODE_LENGTH) => {
  const codeLength = normalizeCodeLength(length);
  let code = "";

  while (code.length < codeLength) {
    const bytes = Crypto.getRandomBytes(codeLength);

    for (const byte of bytes) {
      if (byte >= 252) continue;
      code += SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length];
      if (code.length === codeLength) break;
    }
  }

  return code;
};

const normalizeShareCode = (shareCode) => {
  const normalized = String(shareCode || "").trim().toUpperCase();
  if (!SHARE_CODE_RE.test(normalized)) {
    throw new Error("invalid_code");
  }
  return normalized;
};

export const createSharedSchedule = async (user, scheduleData, durationDays) => {
  if (!user || !scheduleData) throw new Error("Missing user or schedule data");

  const safeDurationDays = Math.min(30, Math.max(1, Number(durationDays) || 7));
  const createdAt = Date.now();
  const expiresAtDate = new Date(createdAt + safeDurationDays * 24 * 60 * 60 * 1000);

  for (let length = MIN_SHARE_CODE_LENGTH; length <= MAX_SHARE_CODE_LENGTH; length += 1) {
    for (let attempt = 0; attempt < SHARE_CODE_ATTEMPTS_PER_LENGTH; attempt += 1) {
      const shareCode = generateShareCode(length);
      const docRef = doc(db, "shared_schedules", shareCode);
      const sharedDoc = encodeSharedScheduleDocument({
        id: shareCode,
        ownerId: user.uid,
        ownerName: user.displayName || user.email || "User",
        scheduleName: scheduleData.name || "Untitled",
        scheduleData,
        createdAt,
        expiresAt: expiresAtDate,
        isActive: true,
      });

      try {
        await setDoc(docRef, sharedDoc);
        return shareCode;
      } catch (error) {
        if (error?.code === "permission-denied") continue;
        throw error;
      }
    }
  }

  throw new Error("share_code_generation_failed");
};

export const fetchSharedSchedule = async (shareCode) => {
  if (!shareCode) throw new Error("Code is required");

  const docRef = doc(db, "shared_schedules", normalizeShareCode(shareCode));
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("not_found");
  }

  const data = decodeSharedScheduleDocument(docSnap.data());

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

  return querySnapshot.docs
    .map(doc => decodeSharedScheduleDocument(doc.data()))
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteSharedSchedule = async (shareCode) => {
  const docRef = doc(db, "shared_schedules", normalizeShareCode(shareCode));
  await deleteDoc(docRef);
};

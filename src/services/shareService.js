import { doc, getDocFromServer, onSnapshot, collection, query, where, getDocs, deleteDoc, setDoc } from "firebase/firestore";
import * as Crypto from "expo-crypto";
import { db } from "../config/firebase";
import { WEB_APP_URL } from "../config/website.cjs";
import { sanitizeSharedScheduleForPreview } from "../utils/scheduleValidation";
import AsyncStorage from '@react-native-async-storage/async-storage';

const SHARE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MIN_SHARE_CODE_LENGTH = 5;
const DEFAULT_SHARE_CODE_LENGTH = 8;
const MAX_SHARE_CODE_LENGTH = 32;
const SHARE_CODE_ATTEMPTS_PER_LENGTH = 5;
const SHARE_CODE_RE = /^[A-Z0-9]{5,32}$/;
const IMPORT_INTENT_KEY = 'planit_shared_schedule_import_v1';
const IMPORT_INTENT_LIFETIME = 24 * 60 * 60 * 1000;
const ANDROID_PACKAGE_NAME = 'com.artomk.planit';
const GOOGLE_PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

export const readSharedScheduleImport = async () => {
  const raw = await AsyncStorage.getItem(IMPORT_INTENT_KEY);
  if (!raw) return null;
  let intent;
  try { intent = JSON.parse(raw); } catch { await AsyncStorage.removeItem(IMPORT_INTENT_KEY); return null; }
  if (!SHARE_CODE_RE.test(intent?.code || '') || !/^[A-Za-z0-9_-]{1,128}$/.test(intent?.copyId || '')
    || !['choosing', 'auth', 'ready'].includes(intent.stage) || !Number.isFinite(intent.createdAt)
    || (intent.scope != null && intent.scope !== 'guest' && !(typeof intent.scope === 'string' && intent.scope.startsWith('user:') && intent.scope.length > 5 && intent.scope.length <= 133))
    || (intent.authView != null && !['signin', 'signup'].includes(intent.authView))
    || intent.createdAt > Date.now() || Date.now() - intent.createdAt >= IMPORT_INTENT_LIFETIME) {
    await AsyncStorage.removeItem(IMPORT_INTENT_KEY);
    return null;
  }
  return intent;
};

export const prepareSharedScheduleImport = async (code, changes = {}) => {
  const normalizedCode = normalizeShareCodeInput(code);
  const previous = await readSharedScheduleImport();
  const intent = previous?.code === normalizedCode ? previous : {
    code: normalizedCode, copyId: Crypto.randomUUID(), createdAt: Date.now(), stage: 'choosing',
  };
  const next = { code: normalizedCode, copyId: intent.copyId, createdAt: intent.createdAt,
    stage: changes.stage ?? intent.stage, scope: changes.scope === undefined ? intent.scope : changes.scope,
    authView: changes.authView ?? intent.authView };
  await AsyncStorage.setItem(IMPORT_INTENT_KEY, JSON.stringify(next));
  return next;
};

export const clearSharedScheduleImport = async (copyId) => {
  const intent = await readSharedScheduleImport();
  if (intent && (!copyId || intent.copyId === copyId)) await AsyncStorage.removeItem(IMPORT_INTENT_KEY);
};

export const resolveSharedScheduleImportUrl = (url, intent, scope) => {
  if (!intent || intent.stage === 'choosing') return url;
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { return url; }
    const path = parsed.protocol === 'planit:' ? '/' + parsed.host + parsed.pathname : parsed.pathname;
    if (!['/', '/auth', `/share/${intent.code}`].includes(path.replace(/\/$/, '') || '/')) return url;
  }
  if (scope && (!intent.scope || intent.scope === scope)) return `planit://share/${intent.code}`;
  if (!scope && intent.stage === 'auth') return 'planit://auth';
  return url;
};

const normalizeCodeLength = (length) => {
  const numericLength = Math.floor(Number(length) || DEFAULT_SHARE_CODE_LENGTH);
  return Math.min(MAX_SHARE_CODE_LENGTH, Math.max(MIN_SHARE_CODE_LENGTH, numericLength));
};

export const generateShareCode = (length = DEFAULT_SHARE_CODE_LENGTH) => {
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

export const normalizeShareCodeInput = (shareInput) => {
  const rawInput = String(shareInput || "").trim();
  const sharedLinkMatch = rawInput.match(/^(?:https?:\/\/[^/?#]+\/|planit:\/\/(?:\/)?)(?:share)\/([a-z0-9]{5,32})\/?(?:[?#].*)?$/i);
  const normalized = String(sharedLinkMatch?.[1] || rawInput).trim().toUpperCase();
  if (!SHARE_CODE_RE.test(normalized)) {
    throw new Error("invalid_code");
  }
  return normalized;
};
export const createSharedSchedulePath = (shareCode) => `/share/${normalizeShareCodeInput(shareCode)}`;

export const createSharedScheduleLink = (shareCode) => `${WEB_APP_URL}${createSharedSchedulePath(shareCode)}`;

// Android browsers open the installed app for this intent and fall back to the Play listing otherwise.
export const createSharedScheduleAndroidIntentUrl = (shareCode) => `intent:/${createSharedSchedulePath(shareCode)}`
  + `#Intent;scheme=planit;package=${ANDROID_PACKAGE_NAME};S.browser_fallback_url=${encodeURIComponent(GOOGLE_PLAY_URL)};end`;

// Rules hide expired or revoked shares from other users, so a denied read also means the code exists.
const isShareCodeTaken = async (docRef) => {
  try { return (await getDocFromServer(docRef)).exists(); }
  catch (error) { if (error?.code === "permission-denied") return true; throw error; }
};

export const createSharedSchedule = async (user, scheduleData, durationDays) => {
  if (!user || !scheduleData) throw new Error("Missing user or schedule data");

  const safeDurationDays = Math.min(30, Math.max(1, Number(durationDays) || 7));
  const createdAt = Date.now();
  const expiresAtDate = new Date(createdAt + safeDurationDays * 24 * 60 * 60 * 1000);

  for (let length = DEFAULT_SHARE_CODE_LENGTH; length <= MAX_SHARE_CODE_LENGTH; length += 1) {
    for (let attempt = 0; attempt < SHARE_CODE_ATTEMPTS_PER_LENGTH; attempt += 1) {
      const shareCode = generateShareCode(length);
      const docRef = doc(db, "shared_schedules", shareCode);
      const sharedDoc = {
        id: shareCode,
        ownerId: user.uid,
        ownerName: (user.displayName || "User").slice(0, 120),
        scheduleName: scheduleData.name || "Untitled",
        scheduleData,
        createdAt,
        expiresAt: expiresAtDate,
        isActive: true,
      };

      try {
        await setDoc(docRef, sharedDoc);
        return shareCode;
      } catch (error) {
        // Rules allow only creating a new share, so an occupied code is rejected instead of overwritten.
        if (error?.code === "permission-denied" && await isShareCodeTaken(docRef)) continue;
        throw error;
      }
    }
  }

  throw new Error("share_code_generation_failed");
};

export const fetchSharedSchedule = async (shareCode) => {
  if (!shareCode) throw new Error("Code is required");

  const docRef = doc(db, "shared_schedules", normalizeShareCodeInput(shareCode));
  const docSnap = await getDocFromServer(docRef);
  return readSharedSchedule(docSnap);
};

const readSharedSchedule = (docSnap) => {
  if (!docSnap.exists()) {
    throw new Error("not_found");
  }

  const data = docSnap.data();

  if (!data.isActive) {
    throw new Error("inactive");
  }

  const expirationTime = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : Number(data.expiresAt);

  if (!Number.isFinite(expirationTime) || Date.now() >= expirationTime) {
    throw new Error("expired");
  }

  return { ...data, expiresAt: expirationTime, scheduleData: sanitizeSharedScheduleForPreview(data.scheduleData) };
};

export const subscribeToSharedSchedule = (shareCode, onData, onError) => {
  const docRef = doc(db, "shared_schedules", normalizeShareCodeInput(shareCode));
  return onSnapshot(docRef, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache) return;
    try { onData(readSharedSchedule(snapshot)); }
    catch (error) { onError(error); }
  }, onError);
};

export const getSharedScheduleErrorKey = (error) => {
  if (error?.code === 'permission-denied') return 'share.error_unavailable';
  switch (error?.message) {
    case 'not_found':
    case 'invalid_code': return 'share.error_not_found';
    case 'inactive': return 'share.error_inactive';
    case 'expired': return 'share.error_expired';
    case 'invalid_shared_schedule': return 'share.error_invalid_schedule';
    default: return 'common.action_failed';
  }
};

export const getUserSharedSchedules = async (userId) => {
  if (!userId) return [];

  const q = query(collection(db, "shared_schedules"), where("ownerId", "==", userId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs
    .map(doc => ({ ...doc.data(), id: doc.id }))
    .sort((a, b) => (getSharedScheduleTimestamp(b.createdAt) || 0) - (getSharedScheduleTimestamp(a.createdAt) || 0));
};

export const getSharedScheduleTimestamp = (value) => {
  if (value == null) return null;
  const timestamp = typeof value?.toMillis === 'function' ? value.toMillis()
    : typeof value?.seconds === 'number' ? value.seconds * 1000 : Number(value);
  return Number.isFinite(timestamp) && Math.abs(timestamp) <= 8640000000000000 ? timestamp : null;
};

export const getSharedScheduleStatus = (share, now = Date.now()) => {
  if (!share?.isActive) return 'inactive';
  const expiresAt = getSharedScheduleTimestamp(share.expiresAt);
  return expiresAt !== null && expiresAt > now ? 'active' : 'expired';
};

export const getOwnedSharedSchedule = async (userId, shareCode) => {
  if (!userId) throw new Error('auth_required');
  const code = normalizeShareCodeInput(shareCode);
  const snapshot = await getDocFromServer(doc(db, 'shared_schedules', code));
  if (!snapshot.exists()) throw new Error('not_found');
  const data = snapshot.data();
  if (data.ownerId !== userId) throw new Error('not_found');
  let scheduleData;
  try { scheduleData = sanitizeSharedScheduleForPreview(data.scheduleData); }
  catch (error) {
    if (error?.message !== 'invalid_shared_schedule') throw error;
    return { ...data, id: code, scheduleData: null, previewError: 'share.manager_preview_failed' };
  }
  return { ...data, id: code, scheduleData };
};

export const deleteSharedSchedule = async (shareCode) => {
  const docRef = doc(db, "shared_schedules", normalizeShareCodeInput(shareCode));
  await deleteDoc(docRef);
};

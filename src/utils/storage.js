import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_KEY = 'guest_schedule';
const DEVICE_SETTINGS_KEY = 'app_device_settings';
const LOCAL_PENDING_SUFFIX = '.pending';
const LOCAL_MIRROR_SUFFIX = '.mirror';
const LOCAL_BACKUP_SUFFIX = '.backup';
const LOCAL_RECOVERY_SUFFIX = '.recovery';
const LOCAL_SCOPE_OWNER_KEY = '_localScopeOwner';
const MAX_RECOVERY_SNAPSHOTS = 5;

const parseJson = (raw, fallback = null) => {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
};

const serializeJson = (value) => JSON.stringify(value ?? null);

const getStorageKey = (userId) => {
  return userId ? `user_schedule_${userId}` : GUEST_KEY;
};

const getScheduleStorageKeys = (userId) => {
  const primary = getStorageKey(userId);
  return {
    primary,
    pending: `${primary}${LOCAL_PENDING_SUFFIX}`,
    mirror: `${primary}${LOCAL_MIRROR_SUFFIX}`,
    backup: `${primary}${LOCAL_BACKUP_SUFFIX}`,
    recovery: `${primary}${LOCAL_RECOVERY_SUFFIX}`,
  };
};

const getStorageScope = (userId) => (userId ? `user:${userId}` : 'guest');

const withLocalScope = (data, userId) => ({
  ...data,
  [LOCAL_SCOPE_OWNER_KEY]: getStorageScope(userId),
});

const withoutLocalScope = (data) => {
  const { [LOCAL_SCOPE_OWNER_KEY]: _scope, ...scheduleData } = data;
  return scheduleData;
};

const decodeScheduleCandidate = (raw, expectedScope = null) => {
  if (!raw) return null;
  const decoded = parseJson(raw);
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
  if (!decoded.global || !Array.isArray(decoded.schedules)) return null;
  const storedScope = decoded[LOCAL_SCOPE_OWNER_KEY];
  if (storedScope && expectedScope && storedScope !== expectedScope) return null;
  return withoutLocalScope(decoded);
};

export async function getLocalSchedule(userId = null) {
  const keys = getScheduleStorageKeys(userId);
  const scope = getStorageScope(userId);
  try {
    const [primaryRaw, pendingRaw, mirrorRaw, backupRaw, recoveryRaw] = await Promise.all([
      AsyncStorage.getItem(keys.primary),
      AsyncStorage.getItem(keys.pending),
      AsyncStorage.getItem(keys.mirror),
      AsyncStorage.getItem(keys.backup),
      AsyncStorage.getItem(keys.recovery),
    ]);
    const recoverySnapshots = parseJson(recoveryRaw, []);
    const recoveryData = Array.isArray(recoverySnapshots)
      ? recoverySnapshots
        .map((snapshot) => decodeScheduleCandidate(snapshot?.data, scope))
        .find(Boolean)
      : null;

    // A valid pending value means a previous write was interrupted after the
    // journal was durable but before the primary slot was confirmed.
    const candidates = [
      { source: 'pending', raw: pendingRaw, data: decodeScheduleCandidate(pendingRaw, scope) },
      { source: 'primary', raw: primaryRaw, data: decodeScheduleCandidate(primaryRaw, scope) },
      { source: 'mirror', raw: mirrorRaw, data: decodeScheduleCandidate(mirrorRaw, scope) },
      { source: 'backup', raw: backupRaw, data: decodeScheduleCandidate(backupRaw, scope) },
      { source: 'recovery', raw: null, data: recoveryData },
    ];
    const selected = candidates.find((candidate) => candidate.data);
    if (!selected) return null;

    if (selected.source !== 'primary') {
      try {
        const serialized = serializeJson(withLocalScope(selected.data, userId));
        await AsyncStorage.setItem(keys.primary, serialized);
        await AsyncStorage.setItem(keys.mirror, serialized);
        if (selected.source === 'pending') {
          await AsyncStorage.removeItem(keys.pending);
        }
      } catch (repairError) {
        console.warn(`Failed to repair local schedule for key: ${keys.primary}`, repairError);
      }
    }

    return selected.data;
  } catch (e) {
    console.error(`Failed to read local schedule for key: ${keys.primary}`, e);
    throw e;
  }
}

export async function saveLocalSchedule(data, userId = null) {
  const keys = getScheduleStorageKeys(userId);
  try {
    const scope = getStorageScope(userId);
    const serialized = serializeJson(withLocalScope(data, userId));
    const currentRaw = await AsyncStorage.getItem(keys.primary);

    // Write-ahead journal: on a crash, getLocalSchedule prefers this complete
    // value. The previous valid primary is retained as a rollback copy.
    await AsyncStorage.setItem(keys.pending, serialized);
    if (currentRaw && currentRaw !== serialized && decodeScheduleCandidate(currentRaw, scope)) {
      await AsyncStorage.setItem(keys.backup, currentRaw);
    }
    await AsyncStorage.setItem(keys.primary, serialized);

    const persistedRaw = await AsyncStorage.getItem(keys.primary);
    if (persistedRaw !== serialized || !decodeScheduleCandidate(persistedRaw, scope)) {
      const error = new Error(`Local schedule verification failed for key: ${keys.primary}`);
      error.code = 'local-storage/verification-failed';
      throw error;
    }

    await AsyncStorage.setItem(keys.mirror, serialized);
    await AsyncStorage.removeItem(keys.pending);
    return true;
  } catch (e) {
    console.error(`Failed to save local schedule for key: ${keys.primary}`, e);
    throw e;
  }
}

export async function saveScheduleRecoverySnapshot(data, userId = null, reason = 'sync') {
  if (!data) return;
  const { recovery } = getScheduleStorageKeys(userId);
  const raw = await AsyncStorage.getItem(recovery);
  const existing = parseJson(raw, []);
  const snapshots = Array.isArray(existing) ? existing : [];
  snapshots.unshift({
    createdAt: Date.now(),
    reason: String(reason || 'sync'),
    data: withLocalScope(data, userId),
  });
  await AsyncStorage.setItem(
    recovery,
    serializeJson(snapshots.slice(0, MAX_RECOVERY_SNAPSHOTS)),
  );
}

export async function getScheduleRecoverySnapshots(userId = null) {
  const { recovery } = getScheduleStorageKeys(userId);
  const snapshots = parseJson(await AsyncStorage.getItem(recovery), []);
  if (!Array.isArray(snapshots)) return [];
  const scope = getStorageScope(userId);
  return snapshots
    .map((snapshot) => ({
      ...snapshot,
      data: decodeScheduleCandidate(snapshot?.data, scope),
    }))
    .filter((snapshot) => snapshot.data);
}

export async function clearLocalSchedule(userId = null, options = {}) {
  const keys = getScheduleStorageKeys(userId);
  try {
    await Promise.all([
      AsyncStorage.removeItem(keys.primary),
      AsyncStorage.removeItem(keys.pending),
      AsyncStorage.removeItem(keys.mirror),
      AsyncStorage.removeItem(keys.backup),
      AsyncStorage.removeItem(keys.recovery),
    ]);
  } catch (e) {
    console.error(`Failed to clear local schedule for key: ${keys.primary}`, e);
    if (options.throwOnError) throw e;
  }
}

export async function getDevicePrefs() {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_SETTINGS_KEY);
    if (!raw) return {};

    return parseJson(raw, {});
  } catch (e) {
    return {};
  }
}

export async function saveDevicePrefs(prefs) {
  try {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, serializeJson(prefs));
  } catch (e) {
    console.error('Failed to save device settings', e);
  }
}

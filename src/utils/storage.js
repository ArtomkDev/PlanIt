import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_KEY = 'guest_schedule';
const DEVICE_SETTINGS_KEY = 'app_device_settings';
const LOCAL_PENDING_SUFFIX = '.pending';
const LOCAL_MIRROR_SUFFIX = '.mirror';
const LOCAL_BACKUP_SUFFIX = '.backup';
const LOCAL_RECOVERY_SUFFIX = '.recovery';
const LOCAL_SCOPE_OWNER_KEY = '_localScopeOwner';
const MAX_RECOVERY_SNAPSHOTS = 5;
const STORAGE_CHUNK_LENGTH = 256 * 1024;
const CHUNK_FORMAT = 'planit/chunks/v1';
const scheduleStorageOperations = new Map();
const deletedAccountScopes = new Set();
let chunkSequence = 0;

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

const getChunkDescriptor = (raw) => {
  const value = parseJson(raw);
  return value?.format === CHUNK_FORMAT && typeof value.id === 'string'
    && Number.isInteger(value.count) && value.count > 0 && value.count <= 10000
    ? value : null;
};

const getChunkKeys = (key, descriptor) => descriptor
  ? Array.from({ length: descriptor.count }, (_, index) => `${key}.chunks.${descriptor.id}.${index}`)
  : [];

const removeStorageKeys = async (keys) => {
  const results = await Promise.allSettled(keys.map((key) => AsyncStorage.removeItem(key)));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
};

const readStorageValue = async (key) => {
  const raw = await AsyncStorage.getItem(key);
  const descriptor = getChunkDescriptor(raw);
  if (!descriptor) return raw;
  const chunks = [];
  for (const chunkKey of getChunkKeys(key, descriptor)) {
    const chunk = await AsyncStorage.getItem(chunkKey);
    if (chunk === null) {
      const error = new Error('A local storage chunk is missing.');
      error.code = 'local-storage/corrupt-data';
      throw error;
    }
    chunks.push(chunk);
  }
  return chunks.join('');
};

const writeStorageValue = async (key, value) => {
  const previous = getChunkDescriptor(await AsyncStorage.getItem(key));
  let descriptor = null;
  const newKeys = [];
  try {
    if (value.length > STORAGE_CHUNK_LENGTH) {
      const chunks = [];
      for (let start = 0; start < value.length;) {
        let end = Math.min(start + STORAGE_CHUNK_LENGTH, value.length);
        const last = value.charCodeAt(end - 1);
        const next = value.charCodeAt(end);
        // A native UTF-8 conversion would replace a split surrogate pair.
        if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end -= 1;
        chunks.push(value.slice(start, end));
        start = end;
      }
      descriptor = {
        format: CHUNK_FORMAT,
        id: `${Date.now().toString(36)}-${++chunkSequence}-${Math.random().toString(36).slice(2, 10)}`,
        count: chunks.length,
      };
      newKeys.push(...getChunkKeys(key, descriptor));
      for (let index = 0; index < newKeys.length; index += 1) {
        await AsyncStorage.setItem(newKeys[index], chunks[index]);
      }
    }
    // The slot points at the new generation only after every chunk is durable.
    await AsyncStorage.setItem(key, descriptor ? serializeJson(descriptor) : value);
  } catch (error) {
    try {
      if (getChunkDescriptor(await AsyncStorage.getItem(key))?.id !== descriptor?.id) {
        await Promise.allSettled(newKeys.map((chunkKey) => AsyncStorage.removeItem(chunkKey)));
      }
    } catch (_) {}
    throw error;
  }
  await removeStorageKeys(getChunkKeys(key, previous));
};

const removeStorageValue = async (key) => {
  const descriptor = getChunkDescriptor(await AsyncStorage.getItem(key));
  await AsyncStorage.removeItem(key);
  await removeStorageKeys(getChunkKeys(key, descriptor));
};

const getStorageKey = (userId) => {
  return userId ? `user_schedule_${userId}` : GUEST_KEY;
};

// Reads can repair the journal, so they share the same queue as writes and deletion.
const runScheduleStorageOperation = (userId, operation) => {
  const key = getStorageKey(userId);
  const previous = scheduleStorageOperations.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request(`planit:${key}`, operation);
    }
    return operation();
  });
  scheduleStorageOperations.set(key, next);
  const release = () => {
    if (scheduleStorageOperations.get(key) === next) scheduleStorageOperations.delete(key);
  };
  next.then(release, release);
  return next;
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

const assertScheduleWritesAllowed = (userId) => {
  if (!deletedAccountScopes.has(getStorageScope(userId))) return;
  const error = new Error('Local writes are disabled for the deleted account.');
  error.code = 'local-storage/account-deleted';
  throw error;
};

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
  if (!decoded.global || typeof decoded.global !== 'object' || Array.isArray(decoded.global)) return null;
  if (!Array.isArray(decoded.schedules)) return null;
  const storedScope = decoded[LOCAL_SCOPE_OWNER_KEY];
  if (storedScope && expectedScope && storedScope !== expectedScope) return null;
  return withoutLocalScope(decoded);
};

export async function getLocalSchedule(userId = null) {
  return runScheduleStorageOperation(userId, async () => {
    const keys = getScheduleStorageKeys(userId);
    const scope = getStorageScope(userId);
    try {
      // A valid pending value means a previous write was interrupted after the
      // journal was durable but before the primary slot was confirmed.
      let selected = null;
      let failedRead = null;
      let hasStoredData = false;
      for (const source of ['pending', 'primary', 'mirror', 'backup', 'recovery']) {
        let raw;
        try {
          raw = await readStorageValue(keys[source]);
        } catch (error) {
          // An unreadable journal or primary may contain a newer draft. Do not
          // silently replace it with an older backup after a transient error.
          if ((source === 'pending' || source === 'primary') && error?.code !== 'local-storage/corrupt-data') throw error;
          failedRead ||= error;
          continue;
        }
        if (raw !== null) hasStoredData = true;
        let candidate = null;
        if (source === 'recovery') {
          const snapshots = parseJson(raw, []);
          for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
            candidate = decodeScheduleCandidate(snapshot?.data, scope);
            if (candidate) break;
          }
        } else candidate = decodeScheduleCandidate(raw, scope);
        if (candidate) {
          selected = { source, data: candidate };
          break;
        }
      }
      if (!selected) {
        if (failedRead) throw failedRead;
        if (hasStoredData) {
          const error = new Error('Local schedule data is unreadable and has been preserved for recovery.');
          error.code = 'local-storage/corrupt-data';
          throw error;
        }
        return null;
      }

      if (selected.source !== 'primary') {
        try {
          const serialized = serializeJson(withLocalScope(selected.data, userId));
          await writeStorageValue(keys.primary, serialized);
          await writeStorageValue(keys.mirror, serialized);
          if (selected.source === 'pending') {
            await removeStorageValue(keys.pending);
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
  });
}

export async function saveLocalSchedule(data, userId = null) {
  const serialized = serializeJson(withLocalScope(data, userId));
  if (!decodeScheduleCandidate(serialized, getStorageScope(userId))) {
    const error = new Error('Invalid local schedule data.');
    error.code = 'local-storage/invalid-data';
    throw error;
  }
  return runScheduleStorageOperation(userId, async () => {
    const keys = getScheduleStorageKeys(userId);
    try {
      assertScheduleWritesAllowed(userId);
      const scope = getStorageScope(userId);
      const currentRaw = await readStorageValue(keys.primary);

      // Write-ahead journal: on a crash, getLocalSchedule prefers this complete
      // value. The previous valid primary is retained as a rollback copy.
      await writeStorageValue(keys.pending, serialized);
      if (currentRaw && currentRaw !== serialized && decodeScheduleCandidate(currentRaw, scope)) {
        await writeStorageValue(keys.backup, currentRaw);
      }
      await writeStorageValue(keys.primary, serialized);

      const persistedRaw = await readStorageValue(keys.primary);
      if (persistedRaw !== serialized || !decodeScheduleCandidate(persistedRaw, scope)) {
        const error = new Error(`Local schedule verification failed for key: ${keys.primary}`);
        error.code = 'local-storage/verification-failed';
        throw error;
      }

      await writeStorageValue(keys.mirror, serialized);
      await removeStorageValue(keys.pending);
      return true;
    } catch (e) {
      console.error(`Failed to save local schedule for key: ${keys.primary}`, e);
      throw e;
    }
  });
}

export async function saveScheduleRecoverySnapshot(data, userId = null, reason = 'sync') {
  if (!data) return;
  return runScheduleStorageOperation(userId, async () => {
    assertScheduleWritesAllowed(userId);
    const { recovery } = getScheduleStorageKeys(userId);
    const raw = await readStorageValue(recovery);
    const existing = parseJson(raw, []);
    const snapshots = Array.isArray(existing) ? existing : [];
    snapshots.unshift({
      createdAt: Date.now(),
      reason: String(reason || 'sync'),
      data: withLocalScope(data, userId),
    });
    await writeStorageValue(
      recovery,
      serializeJson(snapshots.slice(0, MAX_RECOVERY_SNAPSHOTS)),
    );
  });
}

export async function getScheduleRecoverySnapshots(userId = null) {
  return runScheduleStorageOperation(userId, async () => {
    const { recovery } = getScheduleStorageKeys(userId);
    const snapshots = parseJson(await readStorageValue(recovery), []);
    if (!Array.isArray(snapshots)) return [];
    const scope = getStorageScope(userId);
    return snapshots
      .map((snapshot) => ({
        ...snapshot,
        data: decodeScheduleCandidate(snapshot?.data, scope),
      }))
      .filter((snapshot) => snapshot.data);
  });
}

export async function clearLocalSchedule(userId = null, options = {}) {
  return runScheduleStorageOperation(userId, async () => {
    const keys = getScheduleStorageKeys(userId);
    try {
      if (userId && options.preventWrites) deletedAccountScopes.add(getStorageScope(userId));
      const removals = await Promise.allSettled([
        removeStorageValue(keys.primary),
        removeStorageValue(keys.pending),
        removeStorageValue(keys.mirror),
        removeStorageValue(keys.backup),
        removeStorageValue(keys.recovery),
      ]);
      const failure = removals.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
      const allKeys = await AsyncStorage.getAllKeys();
      const chunkPrefixes = Object.values(keys).map((key) => `${key}.chunks.`);
      await removeStorageKeys(allKeys.filter((key) => chunkPrefixes.some((prefix) => key.startsWith(prefix))));
    } catch (e) {
      console.error(`Failed to clear local schedule for key: ${keys.primary}`, e);
      if (options.throwOnError) throw e;
    }
  });
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

export async function saveDevicePrefs(prefs, { throwOnError = false } = {}) {
  try {
    await AsyncStorage.setItem(DEVICE_SETTINGS_KEY, serializeJson(prefs));
  } catch (e) {
    if (throwOnError) throw e;
    console.error('Failed to save device settings', e);
  }
}

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, useColorScheme, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { app, auth } from "../config/firebase";
import { saveSchedule, subscribeToSchedule, getScheduleFromServer, updateDeviceSyncTimeAndCleanUp } from "../config/firestore";
import {
  getLocalSchedule,
  saveLocalSchedule,
  getDevicePrefs,
  saveDevicePrefs,
  clearLocalSchedule,
  saveScheduleRecoverySnapshot,
} from "../utils/storage";
import createDefaultData from "../config/createDefaultData";
import useAppLanguage from "../hooks/useAppLanguage";
import {
  getWidgetSelectedScheduleId,
  setWidgetSelectedScheduleId,
  syncScheduleToWidget,
} from "../widgets/widgetService";
import { getScheduleDataFingerprint, hasScheduleDataChanged } from "../utils/scheduleDataFingerprint";
import {
  cancelLessonRemindersForSchedule,
  reconcileLessonRemindersForSchedule,
} from "../services/notificationService";
import { setHapticsEnabled } from "../utils/haptics";
import { generateId } from "../utils/idGenerator";
import {
  getCloudSubscriptionUserId,
  isSyncEntityDirty,
  markScheduleDataDirty,
  nextLogicalTimestamp,
  resolveConflictChoice,
  resolveSyncConflict,
} from "../utils/scheduleSync";

const ScheduleContext = createContext(null);
const ScheduleDataContext = createContext(null);
const ScheduleActionsContext = createContext(null);
const ScheduleSyncContext = createContext(null);
const ScheduleLayoutContext = createContext(null);

const logSyncDiagnostic = (event, details = {}) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info(`[PlanIt Sync] ${event}`, details);
  }
};

const summarizeSyncData = (scheduleData) => ({
  scheduleCount: (scheduleData?.schedules || []).length,
  schedules: (scheduleData?.schedules || []).map((schedule) => ({
    id: schedule?.id,
    version: Number(schedule?.version) || 0,
    baseVersion: Number(schedule?.baseVersion) || 0,
    dirty: isSyncEntityDirty(schedule),
    deleted: !!schedule?.isDeleted,
  })),
  globalVersion: Number(scheduleData?.global?.version) || 0,
  globalDirty: isSyncEntityDirty(scheduleData?.global),
});

const shallowEqualObjects = (left = {}, right = {}) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const hasDirtyScheduleData = (scheduleData) => {
  if (!scheduleData) return false;

  const isGlobalDirty = isSyncEntityDirty(scheduleData.global);
  const hasDirtySchedules = (scheduleData.schedules || []).some(isSyncEntityDirty);

  return isGlobalDirty || hasDirtySchedules;
};

const getActiveScheduleFromData = (scheduleData, prefs = {}) => {
  const schedules = (scheduleData?.schedules || []).filter((item) => !item.isDeleted);
  const currentScheduleId = prefs.currentScheduleId || scheduleData?.global?.currentScheduleId;
  if (!currentScheduleId || schedules.length === 0) return null;
  return schedules.find((item) => item.id === currentScheduleId) || null;
};

const isSameGlobalDraft = (currentGlobal = {}, nextGlobal = {}) => {
  const keys = new Set([...Object.keys(currentGlobal || {}), ...Object.keys(nextGlobal || {})]);
  keys.delete("lastModified");

  for (const key of keys) {
    const left = currentGlobal?.[key];
    const right = nextGlobal?.[key];

    if (Array.isArray(left) || Array.isArray(right)) {
      if (JSON.stringify(left || []) !== JSON.stringify(right || [])) return false;
    } else if (left !== right) {
      return false;
    }
  }

  return true;
};

const calculateNextLesson = (scheduleData) => {
  if (!scheduleData || !scheduleData.days) return null;
  const date = new Date();
  let dayIndex = date.getDay() - 1;
  if (dayIndex < 0) dayIndex = 6;
  
  const currentDay = scheduleData.days.find(d => String(d.id) === String(dayIndex));
  if (!currentDay || !currentDay.lessons) return null;

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  
  for (const lesson of currentDay.lessons) {
    if (!lesson.startTime) continue;
    const [h, m] = lesson.startTime.split(':').map(Number);
    const lessonMinutes = h * 60 + m;
    
    if (lessonMinutes > nowMinutes) {
      return {
        title: lesson.subject || lesson.name || '',
        time: `${lesson.startTime} - ${lesson.endTime || ''}`,
        room: lesson.room || lesson.location || ''
      };
    }
  }
  return null;
};

const mergeCommittedEntity = (current, saved, committed) => {
  if (!committed) return current;
  if (getScheduleDataFingerprint(current) === getScheduleDataFingerprint(saved)) {
    return committed;
  }

  // The user edited again while the transaction was in flight. Advance the
  // compare-and-set base, but keep the newer draft dirty for the next save.
  return {
    ...current,
    version: committed.version,
    baseVersion: committed.version,
    lastSynced: committed.lastSynced,
    lastModified: nextLogicalTimestamp(current, committed.lastSynced + 1),
  };
};

const applyCommittedSync = (currentData, savedData, committed) => {
  if (!currentData || !committed) return currentData;
  const savedSchedules = new Map(
    (savedData.schedules || []).map((schedule) => [schedule.id, schedule]),
  );
  const committedSchedules = new Map(
    (committed.schedules || []).map((schedule) => [schedule.id, schedule]),
  );

  return {
    ...currentData,
    global: committed.global
      ? mergeCommittedEntity(currentData.global, savedData.global, committed.global)
      : currentData.global,
    schedules: (currentData.schedules || []).map((schedule) => {
      const acknowledged = committedSchedules.get(schedule.id);
      if (!acknowledged) return schedule;
      return mergeCommittedEntity(schedule, savedSchedules.get(schedule.id), acknowledged);
    }),
  };
};

export const ScheduleProvider = ({ children, guest = false, user = null }) => {
  const [data, setData] = useState(null);
  const systemColorScheme = useColorScheme();

  const [devicePrefs, setDevicePrefs] = useState({});
  const devicePrefsRef = useRef(devicePrefs);

  const [tabBarHeight, setTabBarHeightState] = useState(0);
  const setTabBarHeight = useCallback((nextValue) => {
    setTabBarHeightState((previousHeight) => {
      const resolvedValue = typeof nextValue === "function" ? nextValue(previousHeight) : nextValue;
      const nextHeight = Math.max(0, Math.round(Number(resolvedValue) || 0));

      if (Math.abs(previousHeight - nextHeight) <= 1) return previousHeight;
      return nextHeight;
    });
  }, []);

  const syncDevicePrefsUpdate = useCallback((newPrefs) => {
    if (shallowEqualObjects(devicePrefsRef.current, newPrefs)) return;
    devicePrefsRef.current = newPrefs;
    setDevicePrefs(newPrefs);
    saveDevicePrefs(newPrefs);
  }, []);

  useEffect(() => { devicePrefsRef.current = devicePrefs; }, [devicePrefs]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadedScopeKey, setLoadedScopeKey] = useState(null);
  const [error, setError] = useState(null);
  const [widgetScheduleId, setWidgetScheduleId] = useState(undefined);

  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const updateIsDirty = useCallback((val) => {
    const nextValue = !!val;
    if (isDirtyRef.current === nextValue) return;
    isDirtyRef.current = nextValue;
    setIsDirty(nextValue);
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const isCloudSavingRef = useRef(false);

  const [conflictQueue, setConflictQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const prevOnlineRef = useRef(isOnline);

  const [cloudSyncState, setCloudSyncState] = useState('synced');
  const [pendingImmediateSave, setPendingImmediateSave] = useState(false);
  const [deferredCloudRefreshSeq, setDeferredCloudRefreshSeq] = useState(0);
  const deferredCloudRefreshRef = useRef(false);
  const autoSaveFailureCountRef = useRef(0);
  const autoSaveFingerprintRef = useRef(null);

  const { lang, isLangLoading } = useAppLanguage(data?.global?.language);

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const lastLocalSaveFingerprintRef = useRef(null);
  const saveLocalScheduleIfChanged = useCallback(async (nextData, userId = null) => {
    const nextFingerprint = getScheduleDataFingerprint(nextData);
    const nextSaveKey = `${userId || "guest"}:${nextFingerprint}`;
    if (lastLocalSaveFingerprintRef.current === nextSaveKey) return;

    await saveLocalSchedule(nextData, userId);
    lastLocalSaveFingerprintRef.current = nextSaveKey;
  }, []);

  const conflictQueueRef = useRef(conflictQueue);
  useEffect(() => { conflictQueueRef.current = conflictQueue; }, [conflictQueue]);

  useEffect(() => {
    let cancelled = false;
    const scopeUserId = guest ? null : user?.uid || null;
    const loadLocal = async () => {
      setLoadedScopeKey(null);
      setIsLoading(true);
      conflictQueueRef.current = [];
      setConflictQueue([]);
      setPendingImmediateSave(false);
      updateIsDirty(false);
      const prefs = await getDevicePrefs();
      if (cancelled) return;
      setDevicePrefs(prefs);

      if (guest) {
        let local = null;
        try {
          local = await getLocalSchedule(null);
        } catch (localError) {
          setError(localError?.message || 'Unable to read local data');
        }
        if (cancelled) return;
        if (local) lastLocalSaveFingerprintRef.current = `guest:${getScheduleDataFingerprint(local)}`;
        const initialData = local || createDefaultData();
        dataRef.current = initialData;
        setData(initialData);
        setLoadedScopeKey('guest');
        setIsLoading(false);
        setCloudSyncState('synced');
      } else if (user) {
        let local = null;
        try {
          local = await getLocalSchedule(user.uid);
        } catch (localError) {
          setError(localError?.message || 'Unable to read local data');
        }
        if (cancelled) return;

        if (local) {
          lastLocalSaveFingerprintRef.current = `${user.uid}:${getScheduleDataFingerprint(local)}`;
          dataRef.current = local;
          setData(local);
          updateIsDirty(hasDirtyScheduleData(local));
          setLoadedScopeKey(user.uid);
          setIsLoading(false);
          setCloudSyncState('syncing');
        } else {
          setCloudSyncState('syncing');
          try {
            const cloudData = await getScheduleFromServer(user.uid);
            if (cancelled) return;

            if (cloudData) {
              const initialCloudData = cloudData.global?._cloudMissing
                ? {
                  ...cloudData,
                  global: {
                    ...cloudData.global,
                    lastModified: nextLogicalTimestamp(cloudData.global),
                  },
                }
                : cloudData;
              dataRef.current = initialCloudData;
              setData(initialCloudData);
              await saveLocalScheduleIfChanged(initialCloudData, user.uid);
              updateDeviceSyncTimeAndCleanUp(user.uid, { force: true });
              updateIsDirty(hasDirtyScheduleData(initialCloudData));
            } else {
              const defaultData = createDefaultData();
              dataRef.current = defaultData;
              setData(defaultData);
              await saveLocalScheduleIfChanged(defaultData, user.uid);
              updateIsDirty(true);
            }
          } catch (e) {
            if (cancelled) return;
            const defaultData = createDefaultData();
            dataRef.current = defaultData;
            setData(defaultData);
            updateIsDirty(true);
            setError(e?.message || 'Cloud data is temporarily unavailable');
            try {
              await saveLocalScheduleIfChanged(defaultData, user.uid);
            } catch (localError) {
              setError(localError?.message || 'Unable to save local data');
            }
          } finally {
            if (cancelled) return;
            setLoadedScopeKey(user.uid);
            setIsLoading(false);
            setCloudSyncState(prevOnlineRef.current ? 'syncing' : 'offline');
          }
        }
      } else {
        dataRef.current = null;
        setData(null);
        setLoadedScopeKey('none');
        setIsLoading(false);
      }
    };

    loadLocal().catch((loadError) => {
      if (cancelled) return;
      setError(loadError?.message || 'Unable to initialize local data');
      setLoadedScopeKey(guest ? 'guest' : (user?.uid || 'none'));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
      const latestData = dataRef.current;
      if (latestData && (guest || user?.uid)) {
        saveLocalSchedule(latestData, scopeUserId).catch(() => {});
      }
    };
  }, [guest, user, saveLocalScheduleIfChanged, updateIsDirty]);

  useEffect(() => {
    if (!data || isLoading) return;

    const currentPrefs = devicePrefsRef.current;
    let prefsNeedSave = false;
    const newPrefs = { ...currentPrefs };

    if (!newPrefs.language && lang && !isLangLoading) {
      newPrefs.language = lang;
      prefsNeedSave = true;
    }

    if (!newPrefs.theme) {
      const defaultMode = systemColorScheme === 'light' ? 'light' : 'dark';
      newPrefs.theme = data.global?.theme || [defaultMode, 'blue'];
      prefsNeedSave = true;
    }

    if (newPrefs.blur === undefined) {
      newPrefs.blur = data.global?.blur ?? true;
      prefsNeedSave = true;
    }

    if (!newPrefs.navigationStyle) {
      newPrefs.navigationStyle = data.global?.navigationStyle || 'classic';
      prefsNeedSave = true;
    }

    if (newPrefs.navigationLabels === undefined) {
      newPrefs.navigationLabels = data.global?.navigationLabels ?? true;
      prefsNeedSave = true;
    }

    if (newPrefs.navigationAnimations === undefined) {
      newPrefs.navigationAnimations = data.global?.navigationAnimations ?? true;
      prefsNeedSave = true;
    }

    if (newPrefs.hapticsEnabled === undefined) {
      newPrefs.hapticsEnabled = data.global?.hapticsEnabled ?? true;
      prefsNeedSave = true;
    }

    if (data.global && data.global.language === undefined && lang && !isLangLoading) {
      setData(prev => {
        const nextData = {
          ...prev,
          global: {
            ...prev.global,
            language: lang,
            lastModified: nextLogicalTimestamp(prev.global)
          }
        };
        dataRef.current = nextData;
        return nextData;
      });
      if (!guest) updateIsDirty(true);
    }

    const activeSchedules = (data.schedules || []).filter(s => !s.isDeleted);

    if (activeSchedules.length > 0) {
      const hasValidScheduleId = newPrefs.currentScheduleId && activeSchedules.some(s => s.id === newPrefs.currentScheduleId);

      if (!hasValidScheduleId) {
        let fallbackId = null;

        if (data.global?.currentScheduleId && activeSchedules.some(s => s.id === data.global.currentScheduleId)) {
          fallbackId = data.global.currentScheduleId;
        }
        else {
          const sorted = [...activeSchedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
          fallbackId = sorted[0].id;
        }

        newPrefs.currentScheduleId = fallbackId;

        if (newPrefs.currentScheduleId !== currentPrefs.currentScheduleId) {
          prefsNeedSave = true;
        }
      }
    } else {
      if (newPrefs.currentScheduleId !== null) {
        newPrefs.currentScheduleId = null;
        prefsNeedSave = true;
      }
    }

    if (prefsNeedSave) {
      syncDevicePrefsUpdate(newPrefs);
    }
  }, [data, isLoading, guest, user, systemColorScheme, updateIsDirty, syncDevicePrefsUpdate, lang, isLangLoading]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentlyOnline = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(currentlyOnline);

      if (!currentlyOnline) {
        setCloudSyncState('offline');
      } else if (currentlyOnline && !prevOnlineRef.current && user && !guest) {
        setCloudSyncState('syncing');
      }
      prevOnlineRef.current = currentlyOnline;
    });
    return () => unsubscribe();
  }, [user, guest]);

  const cloudSubscriptionUserId = getCloudSubscriptionUserId({
    guest,
    userId: user?.uid || null,
    isLoading,
    loadedScopeKey,
  });

  useEffect(() => {
    let unsubscribeCloud = null;
    if (!cloudSubscriptionUserId) return;

    logSyncDiagnostic('subscription-start', {
      userId: cloudSubscriptionUserId,
      projectId: app?.options?.projectId || null,
      local: summarizeSyncData(dataRef.current),
    });

    unsubscribeCloud = subscribeToSchedule(
      cloudSubscriptionUserId,
      async (fetchedCloudData, isFromCache, metadata = {}) => {
        if (conflictQueueRef.current.length > 0) {
          deferredCloudRefreshRef.current = true;
          return;
        }
        if (isCloudSavingRef.current) {
          deferredCloudRefreshRef.current = true;
          return;
        }

        setCloudSyncState(isFromCache ? 'syncing' : 'synced');

        if (metadata.hasPendingWrites) {
          deferredCloudRefreshRef.current = true;
          return;
        }
        if (
          metadata.hasDataChanged === false &&
          metadata.cacheStateChanged !== true &&
          metadata.pendingStateChanged !== true
        ) return;
        deferredCloudRefreshRef.current = false;

        if (!isFromCache) {
          updateDeviceSyncTimeAndCleanUp(cloudSubscriptionUserId);
        }

        try {
          const currentLocal = dataRef.current || await getLocalSchedule(cloudSubscriptionUserId);
          if (!currentLocal) return;
          const localChangedWhileReading = dataRef.current && hasScheduleDataChanged(currentLocal, dataRef.current);
          if (localChangedWhileReading) return;

          const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedCloudData);

          logSyncDiagnostic('cloud-snapshot-resolved', {
            fromCache: !!isFromCache,
            local: summarizeSyncData(currentLocal),
            cloud: summarizeSyncData(fetchedCloudData),
            needsPushToCloud,
            conflicts: conflicts.map(({ kind, id, reason }) => ({ kind, id, reason })),
          });

          if (conflicts.length > 0) {
            await saveScheduleRecoverySnapshot(
              currentLocal,
              cloudSubscriptionUserId,
              'conflict-detected',
            ).catch(() => {});
            conflictQueueRef.current = conflicts;
            setConflictQueue(conflicts);
            setCloudSyncState('synced');
            return;
          }

          const mergedChanged = hasScheduleDataChanged(currentLocal, mergedData);

          if (mergedChanged) {
            await saveScheduleRecoverySnapshot(
              currentLocal,
              cloudSubscriptionUserId,
              'before-cloud-merge',
            ).catch(() => {});
            // The user may have edited locally while the recovery snapshot was
            // being written. Never apply a cloud result calculated from an old
            // local base; schedule one authoritative server reconciliation.
            if (
              dataRef.current &&
              hasScheduleDataChanged(currentLocal, dataRef.current)
            ) {
              deferredCloudRefreshRef.current = true;
              setDeferredCloudRefreshSeq((sequence) => sequence + 1);
              return;
            }
            setData(mergedData);
            dataRef.current = mergedData;
            await saveLocalScheduleIfChanged(mergedData, cloudSubscriptionUserId);
          }

          if (needsPushToCloud) {
            updateIsDirty(true);
            setPendingImmediateSave(true);
          } else {
            updateIsDirty(hasDirtyScheduleData(mergedChanged ? mergedData : currentLocal));
          }
        } catch (e) {
          setError(e?.message || 'Unable to merge cloud data');
          updateIsDirty(hasDirtyScheduleData(dataRef.current));
        }
      },
      (subscriptionError) => {
        logSyncDiagnostic('subscription-error', {
          code: subscriptionError?.code || null,
          message: subscriptionError?.message || 'Cloud synchronization failed',
        });
        setError(subscriptionError?.message || 'Cloud synchronization failed');
        setCloudSyncState(prevOnlineRef.current ? 'syncing' : 'offline');
      }
    );

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [cloudSubscriptionUserId, updateIsDirty, saveLocalScheduleIfChanged]);

  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalScheduleIfChanged(data, user?.uid || null).catch((localError) => {
        setError(localError?.message || 'Unable to save local data');
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [data, isLoading, user, saveLocalScheduleIfChanged]);

  const mergedGlobal = useMemo(() => {
    const baseGlobal = data?.global || {};
    const fallbackMode = systemColorScheme === 'dark' ? 'dark' : 'light';

    return {
      ...baseGlobal,
      theme: devicePrefs.theme || baseGlobal.theme || [fallbackMode, "blue"],
      blur: devicePrefs.blur !== undefined ? devicePrefs.blur : (baseGlobal.blur ?? true),
      navigationStyle: devicePrefs.navigationStyle || baseGlobal.navigationStyle || 'classic',
      navigationLabels: devicePrefs.navigationLabels !== undefined
        ? devicePrefs.navigationLabels
        : (baseGlobal.navigationLabels ?? true),
      navigationAnimations: devicePrefs.navigationAnimations !== undefined
        ? devicePrefs.navigationAnimations
        : (baseGlobal.navigationAnimations ?? true),
      hapticsEnabled: devicePrefs.hapticsEnabled !== undefined
        ? devicePrefs.hapticsEnabled
        : (baseGlobal.hapticsEnabled ?? true),
      currentScheduleId: devicePrefs.currentScheduleId || baseGlobal.currentScheduleId,
      watermark: baseGlobal.watermark || 0,
      language: lang
    };
  }, [data?.global, devicePrefs, lang, systemColorScheme]);

  const currentScheduleId = mergedGlobal?.currentScheduleId || null;

  useEffect(() => {
    setHapticsEnabled(mergedGlobal?.hapticsEnabled !== false);
  }, [mergedGlobal?.hapticsEnabled]);

  const activeSchedules = useMemo(() => {
    return (data?.schedules || []).filter(s => !s.isDeleted);
  }, [data?.schedules]);

  const schedule = useMemo(() => {
    if (!activeSchedules.length) return null;
    if (!currentScheduleId) return null; 
    
    return activeSchedules.find((s) => s.id === currentScheduleId) || null;
  }, [activeSchedules, currentScheduleId]);

  const reminderScheduleIdRef = useRef(null);
  const reminderSyncSeqRef = useRef(0);

  useEffect(() => {
    if (isLoading) return undefined;

    const previousScheduleId = reminderScheduleIdRef.current;
    const nextScheduleId = schedule?.id || null;
    reminderScheduleIdRef.current = nextScheduleId;

    if (previousScheduleId && previousScheduleId !== nextScheduleId) {
      cancelLessonRemindersForSchedule(previousScheduleId).catch(() => {});
    }

    const syncSeq = reminderSyncSeqRef.current + 1;
    reminderSyncSeqRef.current = syncSeq;
    const scheduleSnapshot = schedule;

    const timeoutId = setTimeout(() => {
      if (reminderSyncSeqRef.current !== syncSeq || !scheduleSnapshot) return;
      reconcileLessonRemindersForSchedule(scheduleSnapshot, {
        lang,
        notificationPreferences: mergedGlobal?.notificationPreferences,
      }).catch(() => {});
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [schedule, isLoading, lang, mergedGlobal?.notificationPreferences]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let isMounted = true;
    getWidgetSelectedScheduleId().then((storedId) => {
      if (isMounted) setWidgetScheduleId(storedId || null);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const widgetSchedule = useMemo(() => {
    if (!activeSchedules.length) return null;
    if (!widgetScheduleId) return schedule;
    return activeSchedules.find((s) => s.id === widgetScheduleId) || schedule;
  }, [activeSchedules, schedule, widgetScheduleId]);

  const prevWidgetScheduleFingerprint = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'android' || isLoading) return;
    if (widgetScheduleId === undefined) return;

    const currentScheduleFingerprint = widgetSchedule
      ? getScheduleDataFingerprint({ global: {}, schedules: [widgetSchedule] })
      : null;

    if (prevWidgetScheduleFingerprint.current !== currentScheduleFingerprint) {
      prevWidgetScheduleFingerprint.current = currentScheduleFingerprint;
      setTimeout(() => {
        syncScheduleToWidget(widgetSchedule);
      }, 0);
    }
  }, [widgetSchedule, widgetScheduleId, isLoading]);

  const selectWidgetSchedule = useCallback(async (scheduleId) => {
    const selected = activeSchedules.find((item) => item.id === scheduleId) || null;
    if (!selected) return;

    setWidgetScheduleId(scheduleId);
    await setWidgetSelectedScheduleId(scheduleId);
  }, [activeSchedules]);

  const setDataDraft = useCallback((updater) => {
    setData((previousData) => {
      const proposedData = typeof updater === "function" ? updater(previousData) : updater;

      if (!hasScheduleDataChanged(previousData, proposedData)) {
        return previousData;
      }

      const nextData = markScheduleDataDirty(previousData, proposedData);

      dataRef.current = nextData;
      if (!guest) updateIsDirty(true);
      return nextData;
    });
  }, [guest, updateIsDirty]);

  const setScheduleDraft = useCallback((updater) => {
    const currentId = devicePrefsRef.current.currentScheduleId || dataRef.current?.global?.currentScheduleId;
    if (!currentId) return;

    setData((prev) => {
      if (!prev) return prev;

      let changed = false;
      const nextSchedules = prev.schedules.map((s) => {
        if (s.id === currentId) {
          const updated = typeof updater === "function" ? updater(s) : updater;
          if (updated === s) return s;
          changed = true;
          return updated;
        }
        return s;
      });

      if (!changed) return prev;

      const nextData = markScheduleDataDirty(prev, { ...prev, schedules: nextSchedules });
      if (!hasScheduleDataChanged(prev, nextData)) return prev;
      dataRef.current = nextData;
      if (!guest) updateIsDirty(true);
      return nextData;
    });
  }, [guest, updateIsDirty]);

  const setGlobalDraft = useCallback((updater) => {
    const currentPrev = dataRef.current;
    if (!currentPrev) return;

    const currentMerged = {
      ...currentPrev.global,
      theme: devicePrefsRef.current.theme || currentPrev.global?.theme,
      blur: devicePrefsRef.current.blur !== undefined ? devicePrefsRef.current.blur : (currentPrev.global?.blur ?? true),
      navigationStyle: devicePrefsRef.current.navigationStyle || currentPrev.global?.navigationStyle || 'classic',
      navigationLabels: devicePrefsRef.current.navigationLabels !== undefined
        ? devicePrefsRef.current.navigationLabels
        : (currentPrev.global?.navigationLabels ?? true),
      navigationAnimations: devicePrefsRef.current.navigationAnimations !== undefined
        ? devicePrefsRef.current.navigationAnimations
        : (currentPrev.global?.navigationAnimations ?? true),
      hapticsEnabled: devicePrefsRef.current.hapticsEnabled !== undefined
        ? devicePrefsRef.current.hapticsEnabled
        : (currentPrev.global?.hapticsEnabled ?? true),
      currentScheduleId: devicePrefsRef.current.currentScheduleId,
      language: devicePrefsRef.current.language
    };

    const nextGlobal = typeof updater === "function" ? updater(currentMerged) : updater;
    if (!nextGlobal) return;

    let prefsChanged = false;
    const newPrefs = { ...devicePrefsRef.current };

    if (nextGlobal.theme && JSON.stringify(nextGlobal.theme) !== JSON.stringify(currentMerged.theme)) {
      newPrefs.theme = nextGlobal.theme;
      prefsChanged = true;
    }
    
    if (nextGlobal.blur !== undefined && nextGlobal.blur !== currentMerged.blur) {
      newPrefs.blur = nextGlobal.blur;
      prefsChanged = true;
    }

    if (nextGlobal.navigationStyle && nextGlobal.navigationStyle !== currentMerged.navigationStyle) {
      newPrefs.navigationStyle = nextGlobal.navigationStyle;
      prefsChanged = true;
    }

    if (nextGlobal.navigationLabels !== undefined && nextGlobal.navigationLabels !== currentMerged.navigationLabels) {
      newPrefs.navigationLabels = nextGlobal.navigationLabels;
      prefsChanged = true;
    }

    if (nextGlobal.navigationAnimations !== undefined && nextGlobal.navigationAnimations !== currentMerged.navigationAnimations) {
      newPrefs.navigationAnimations = nextGlobal.navigationAnimations;
      prefsChanged = true;
    }

    if (nextGlobal.hapticsEnabled !== undefined && nextGlobal.hapticsEnabled !== currentMerged.hapticsEnabled) {
      newPrefs.hapticsEnabled = nextGlobal.hapticsEnabled;
      prefsChanged = true;
    }

    if (nextGlobal.currentScheduleId && nextGlobal.currentScheduleId !== currentMerged.currentScheduleId) {
      newPrefs.currentScheduleId = nextGlobal.currentScheduleId;
      prefsChanged = true;
    }
    if (nextGlobal.language && nextGlobal.language !== currentMerged.language) {
      newPrefs.language = nextGlobal.language;
      prefsChanged = true;
    }

    if (prefsChanged) {
      syncDevicePrefsUpdate(newPrefs);
    }

    if (!prefsChanged && isSameGlobalDraft(currentMerged, nextGlobal)) {
      return;
    }

    setData((prev) => {
      if (!prev) return prev;
      const nextData = {
        ...prev,
        global: {
          ...prev.global,
          ...nextGlobal,
          lastModified: nextLogicalTimestamp(prev.global),
        },
      };
      dataRef.current = nextData;
      return nextData;
    });

    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty, syncDevicePrefsUpdate]);

  const addSchedule = useCallback((scheduleObj) => {
    setData((prev) => {
      if (!prev) return prev;
      const newSchedule = {
        ...scheduleObj,
        version: 0,
        baseVersion: 0,
        lastModified: nextLogicalTimestamp(scheduleObj),
        lastSynced: 0
      };
      const nextData = { ...prev, schedules: [...(prev.schedules || []), newSchedule] };
      dataRef.current = nextData;
      return nextData;
    });
    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty]);

  const removeSchedule = useCallback(async (scheduleId) => {
    const prev = dataRef.current;
    if (!prev) return;

    const now = Date.now();
    let fallbackId = null;

    const nextSchedules = prev.schedules.map(s => {
      if (s.id === scheduleId) {
        const deletedAt = nextLogicalTimestamp(s, now);
        return {
          ...s,
          isDeleted: true,
          deletedAt,
          lastModified: deletedAt,
        };
      }
      return s;
    });

    const activeNext = nextSchedules.filter(s => !s.isDeleted);
    let nextGlobal = { ...prev.global };
    const currentId = devicePrefsRef.current.currentScheduleId || prev.global?.currentScheduleId;

    if (currentId === scheduleId) {
      if (activeNext.length > 0) {
        const sorted = [...activeNext].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        fallbackId = sorted[0].id;
      }
      nextGlobal.currentScheduleId = fallbackId;
      nextGlobal.lastModified = nextLogicalTimestamp(prev.global, now);
    }

    if (fallbackId !== null) {
      syncDevicePrefsUpdate({ ...devicePrefsRef.current, currentScheduleId: fallbackId });
    }

    setData(current => {
      if (!current) return current;
      const nextData = {
        ...current,
        global: nextGlobal,
        schedules: nextSchedules
      };
      dataRef.current = nextData;
      return nextData;
    });

    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty, syncDevicePrefsUpdate]);

  const saveNow = useCallback(async (force = false) => {
    if (guest || !user || !dataRef.current || isSavingRef.current || conflictQueueRef.current.length > 0) return false;
    if (!isDirtyRef.current && force !== true) return true;

    const prev = dataRef.current;
    const isGlobalDirty = isSyncEntityDirty(prev.global);
    const dirtySchedules = (prev.schedules || []).filter(isSyncEntityDirty);

    if (!isGlobalDirty && dirtySchedules.length === 0) {
      updateIsDirty(false);
      return true;
    }

    let dataToSave = null;
    try {
      setIsSaving(true);
      isSavingRef.current = true;
      setIsCloudSaving(true);
      isCloudSavingRef.current = true;

      dataToSave = {
        ...(isGlobalDirty ? {
          global: {
            ...prev.global,
            language: prev.global?.language || lang || 'en',
          },
        } : {}),
        ...(dirtySchedules.length > 0 ? { schedules: dirtySchedules } : {}),
      };

      logSyncDiagnostic('cloud-save-start', {
        userId: user.uid,
        projectId: app?.options?.projectId || null,
        globalDirty: isGlobalDirty,
        dirtyScheduleIds: dirtySchedules.map((schedule) => schedule.id),
      });

      // Make the exact outgoing draft durable before attempting the network.
      // If local storage is unavailable, still try the cloud so there remains
      // at least one durable copy.
      try {
        await saveLocalScheduleIfChanged(prev, user.uid);
      } catch (localError) {
        setError(localError?.message || 'Unable to save local data');
      }
      await saveScheduleRecoverySnapshot(prev, user.uid, 'before-cloud-save').catch(() => {});

      const committed = await saveSchedule(user.uid, dataToSave, true);
      logSyncDiagnostic('cloud-save-committed', summarizeSyncData(committed));
      const currentData = dataRef.current || prev;
      const committedData = applyCommittedSync(currentData, dataToSave, committed);
      dataRef.current = committedData;
      setData(committedData);
      updateIsDirty(hasDirtyScheduleData(committedData));
      setCloudSyncState('synced');

      let localBackupSaved = true;
      try {
        await saveLocalScheduleIfChanged(committedData, user.uid);
      } catch (localError) {
        localBackupSaved = false;
        // The cloud commit is already durable; retain the dirty/error signal so
        // the local journal can be repaired on the next state change.
        setError(localError?.message || 'Cloud saved, local backup failed');
      }
      if (localBackupSaved) setError(null);
      return true;

    } catch (e) {
      logSyncDiagnostic('cloud-save-error', {
        code: e?.code || null,
        message: e?.message || 'Error saving',
      });
      const isExpectedConflict = e?.code === 'sync/conflict';
      // A version conflict is a normal synchronization state handled by the
      // conflict sheet. Treating it as a fatal application error leaves the
      // main layout blocked even after the user's choice was saved.
      if (!isExpectedConflict) {
        setError(e?.message || "Error saving");
      }
      updateIsDirty(true);

      // Each schedule is committed independently. Preserve acknowledgements
      // from the documents that succeeded even if another document conflicted
      // or failed, so unrelated schedules are never rolled back together.
      if (e?.committed) {
        const currentData = dataRef.current || prev;
        const partiallyCommittedData = applyCommittedSync(
          currentData,
          dataToSave,
          e.committed,
        );
        dataRef.current = partiallyCommittedData;
        setData(partiallyCommittedData);
        updateIsDirty(hasDirtyScheduleData(partiallyCommittedData));
        await saveLocalScheduleIfChanged(partiallyCommittedData, user.uid).catch(() => {});
      }

      if (isExpectedConflict) {
        try {
          const cloudData = await getScheduleFromServer(user.uid);
          const currentLocal = dataRef.current || prev;
          if (cloudData) {
            const resolution = resolveSyncConflict(currentLocal, cloudData);
            await saveScheduleRecoverySnapshot(
              currentLocal,
              user.uid,
              'transaction-conflict',
            ).catch(() => {});
            if (hasScheduleDataChanged(currentLocal, resolution.mergedData)) {
              dataRef.current = resolution.mergedData;
              setData(resolution.mergedData);
              await saveLocalScheduleIfChanged(resolution.mergedData, user.uid);
            }
            conflictQueueRef.current = resolution.conflicts;
            setConflictQueue(resolution.conflicts);
            updateIsDirty(
              resolution.needsPushToCloud || hasDirtyScheduleData(resolution.mergedData),
            );
            setError(null);
          }
        } catch (conflictRefreshError) {
          setError(conflictRefreshError?.message || e?.message || 'Synchronization conflict');
        }
      }
      return false;
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
      setIsCloudSaving(false);
      isCloudSavingRef.current = false;
      if (deferredCloudRefreshRef.current) {
        deferredCloudRefreshRef.current = false;
        setDeferredCloudRefreshSeq((sequence) => sequence + 1);
      }
    }
  }, [user, guest, updateIsDirty, lang, saveLocalScheduleIfChanged]);

  // Data safety must not depend on AutoSaveManager being mounted or on a
  // particular screen re-rendering. This provider-owned loop is a second,
  // independent path that saves any durable local draft and retries transient
  // failures with bounded backoff. Firestore transactions remain the final
  // conflict guard.
  useEffect(() => {
    if (
      !cloudSubscriptionUserId ||
      !data ||
      !isDirty ||
      !isOnline ||
      isCloudSaving ||
      conflictQueue.length > 0
    ) {
      return undefined;
    }

    const fingerprint = getScheduleDataFingerprint(data);
    if (autoSaveFingerprintRef.current !== fingerprint) {
      autoSaveFingerprintRef.current = fingerprint;
      autoSaveFailureCountRef.current = 0;
    }

    const failures = autoSaveFailureCountRef.current;
    const delay = failures === 0
      ? 2500
      : Math.min(30000, 5000 * (2 ** Math.min(failures - 1, 3)));

    const timeoutId = setTimeout(async () => {
      if (
        !isDirtyRef.current ||
        isSavingRef.current ||
        isCloudSavingRef.current ||
        conflictQueueRef.current.length > 0
      ) {
        return;
      }

      const saved = await saveNow();
      if (saved === true) {
        autoSaveFailureCountRef.current = 0;
      } else {
        autoSaveFailureCountRef.current = Math.min(
          autoSaveFailureCountRef.current + 1,
          5,
        );
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [
    cloudSubscriptionUserId,
    data,
    isDirty,
    isOnline,
    isCloudSaving,
    conflictQueue.length,
    saveNow,
  ]);

  const safeLogout = useCallback(async () => {
    if (guest || !user) {
      if (guest && dataRef.current) {
        try {
          await saveLocalScheduleIfChanged(dataRef.current, null);
        } catch (localError) {
          setError(localError?.message || 'Logout cancelled because local data is not durable.');
          return false;
        }
      }
      await AsyncStorage.setItem("manual_logout", "true");
      await signOut(auth);
      return true;
    }

    let attempts = 0;
    while ((isSavingRef.current || isCloudSavingRef.current) && attempts < 50) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }

    if (isDirtyRef.current) {
      let localDurable = false;
      try {
        await saveLocalScheduleIfChanged(dataRef.current, user.uid);
        localDurable = true;
      } catch (localError) {
        setError(localError?.message || 'Unable to preserve data before logout');
      }
      const cloudDurable = await saveNow(true);

      if (!localDurable && cloudDurable !== true) {
        setError('Logout cancelled because unsaved data could not be preserved.');
        return false;
      }

      attempts = 0;
      while ((isSavingRef.current || isCloudSavingRef.current) && attempts < 50) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
    }

    await AsyncStorage.setItem("manual_logout", "true");
    await signOut(auth);
    return true;
  }, [guest, user, saveNow, saveLocalScheduleIfChanged]);

  const reloadAllSchedules = useCallback(async () => {
    if (guest || !user) return;
    setCloudSyncState('syncing');
    try {
      const fetchedData = await getScheduleFromServer(user.uid);
      if (fetchedData) {
        const currentLocal = dataRef.current || await getLocalSchedule(user.uid);
        const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedData);
        if (conflicts.length > 0) {
          await saveScheduleRecoverySnapshot(
            currentLocal,
            user.uid,
            'manual-refresh-conflict',
          ).catch(() => {});
          conflictQueueRef.current = conflicts;
          setConflictQueue(conflicts);
        } else {
          const mergedChanged = hasScheduleDataChanged(currentLocal, mergedData);
          if (mergedChanged) {
            await saveScheduleRecoverySnapshot(
              currentLocal,
              user.uid,
              'before-manual-cloud-merge',
            ).catch(() => {});
            setData(mergedData);
            dataRef.current = mergedData;
            await saveLocalScheduleIfChanged(mergedData, user.uid);
          }
          updateIsDirty(needsPushToCloud || hasDirtyScheduleData(mergedChanged ? mergedData : currentLocal));
          if (needsPushToCloud) setPendingImmediateSave(true);
        }
      }
      setCloudSyncState('synced');
    } catch (e) {
      setCloudSyncState(prevOnlineRef.current ? 'syncing' : 'offline');
      setError(e?.message || "Error");
    }
  }, [guest, user, isLoading, loadedScopeKey, updateIsDirty, saveLocalScheduleIfChanged]);

  useEffect(() => {
    if (deferredCloudRefreshSeq === 0 || guest || !user || conflictQueueRef.current.length > 0) {
      return;
    }
    reloadAllSchedules();
  }, [deferredCloudRefreshSeq, guest, user, reloadAllSchedules]);

  useEffect(() => {
    if (pendingImmediateSave && conflictQueue.length === 0) {
      setPendingImmediateSave(false);
      saveNow(true);
    }
  }, [pendingImmediateSave, conflictQueue.length, saveNow]);

  const refreshActiveLessonReminders = useCallback(() => {
    const activeSchedule = getActiveScheduleFromData(dataRef.current, devicePrefsRef.current);
    if (!activeSchedule) return;

    reconcileLessonRemindersForSchedule(activeSchedule, {
      lang: devicePrefsRef.current.language || dataRef.current?.global?.language || lang,
      notificationPreferences: dataRef.current?.global?.notificationPreferences,
    }).catch(() => {});
  }, [lang]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isDirtyRef.current && isOnline && cloudSyncState === 'synced') {
          saveNow();
        }
      } else if (nextAppState === "active") {
        refreshActiveLessonReminders();
        // iOS may suspend Firestore listeners while the app is backgrounded.
        // Verify against the server on foreground so a missed remote conflict
        // resolution never requires a full application restart.
        if (
          user &&
          !guest &&
          isOnline &&
          !isCloudSavingRef.current &&
          conflictQueueRef.current.length === 0
        ) {
          reloadAllSchedules();
        }
      }
    });
    return () => subscription.remove();
  }, [isOnline, cloudSyncState, saveNow, refreshActiveLessonReminders, user, guest, reloadAllSchedules]);

  const resetApplication = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentGlobal = dataRef.current?.global || createDefaultData().global;
      const currentSchedules = dataRef.current?.schedules || [];
      
      const now = Date.now();
      const newSchedules = currentSchedules.map(s => {
        const deletedAt = nextLogicalTimestamp(s, now);
        return {
          ...s,
          isDeleted: true,
          deletedAt,
          lastModified: deletedAt,
        };
      });

      const newData = {
        global: {
          ...currentGlobal,
          lastModified: nextLogicalTimestamp(currentGlobal, now),
          currentScheduleId: null,
        },
        schedules: newSchedules
      };

      const retainedPrefs = {
        theme: devicePrefsRef.current.theme,
        blur: devicePrefsRef.current.blur,
        language: devicePrefsRef.current.language,
        navigationStyle: devicePrefsRef.current.navigationStyle,
        navigationLabels: devicePrefsRef.current.navigationLabels,
        navigationAnimations: devicePrefsRef.current.navigationAnimations,
        hapticsEnabled: devicePrefsRef.current.hapticsEnabled
      };
      syncDevicePrefsUpdate(retainedPrefs);

      setData(newData);
      dataRef.current = newData;

      if (user) {
        await saveScheduleRecoverySnapshot(
          { global: currentGlobal, schedules: currentSchedules },
          user.uid,
          'before-reset',
        );
        const committed = await saveSchedule(user.uid, {
          global: newData.global,
          schedules: newData.schedules
        }, true);
        const committedData = applyCommittedSync(newData, newData, committed);
        dataRef.current = committedData;
        setData(committedData);
        await saveLocalScheduleIfChanged(committedData, user.uid);
      } else {
        await saveLocalScheduleIfChanged(newData, null);
      }
      updateIsDirty(false);
    } catch (e) {
      updateIsDirty(hasDirtyScheduleData(dataRef.current));
      setError(e?.message || "Error");
    } finally {
      setIsLoading(false);
    }
  }, [user, updateIsDirty, syncDevicePrefsUpdate, saveLocalScheduleIfChanged]);

  const deleteGuestSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearLocalSchedule(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResolveConflict = useCallback(async (conflictId, action) => {
    const currentQueue = conflictQueueRef.current;
    const conflictIndex = currentQueue.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) return false;

    const currentConflict = currentQueue[conflictIndex];
    const prev = dataRef.current;
    if (!prev) return false;
    await saveScheduleRecoverySnapshot(
      prev,
      user?.uid || null,
      `before-conflict-choice:${action}`,
    ).catch(() => {});
    const updatedData = resolveConflictChoice(
      prev,
      currentConflict,
      action,
      generateId,
    );

    setData(updatedData);
    dataRef.current = updatedData;
    let resolutionDurable = true;
    try {
      await saveLocalScheduleIfChanged(updatedData, user?.uid || null);
    } catch (localError) {
      resolutionDurable = false;
      setError(localError?.message || 'Unable to preserve conflict resolution');
    }

    const filteredQ = currentQueue.filter(c => c.id !== conflictId);
    conflictQueueRef.current = filteredQ;
    setConflictQueue(filteredQ);

    if (filteredQ.length === 0) {
      if (!guest) {
        updateIsDirty(hasDirtyScheduleData(updatedData));
        // Re-read the server before any push: more changes may have arrived
        // while the conflict screen was open.
        setTimeout(() => reloadAllSchedules(), 0);
      }
    }
    if (resolutionDurable) setError(null);
    return resolutionDurable;
  }, [guest, updateIsDirty, user, saveLocalScheduleIfChanged, reloadAllSchedules]);

  const dataValue = useMemo(() => ({
    user,
    guest,
    schedule,
    global: mergedGlobal,
    schedules: activeSchedules,
    widgetScheduleId,
    isLoading,
    error,
    lang,
    isLangLoading,
  }), [user, guest, schedule, mergedGlobal, activeSchedules, widgetScheduleId, isLoading, error, lang, isLangLoading]);

  const actionsValue = useMemo(() => ({
    selectWidgetSchedule,
    setData: setDataDraft,
    setScheduleDraft,
    setGlobalDraft,
    addSchedule,
    removeSchedule,
    saveNow,
    safeLogout,
    reloadAllSchedules,
    resetApplication,
    deleteGuestSchedules,
  }), [
    selectWidgetSchedule,
    setDataDraft,
    setScheduleDraft,
    setGlobalDraft,
    addSchedule,
    removeSchedule,
    saveNow,
    safeLogout,
    reloadAllSchedules,
    resetApplication,
    deleteGuestSchedules,
  ]);

  const syncValue = useMemo(() => ({
    isDirty,
    isSaving,
    isCloudSaving,
    isOnline,
    conflictQueue,
    handleResolveConflict,
    cloudSyncState,
  }), [isDirty, isSaving, isCloudSaving, isOnline, conflictQueue, handleResolveConflict, cloudSyncState]);

  const layoutValue = useMemo(() => ({
    tabBarHeight,
    setTabBarHeight,
  }), [tabBarHeight, setTabBarHeight]);

  const value = useMemo(() => ({
    ...dataValue,
    ...actionsValue,
    ...syncValue,
    ...layoutValue,
  }), [dataValue, actionsValue, syncValue, layoutValue]);

  return (
    <ScheduleDataContext.Provider value={dataValue}>
      <ScheduleActionsContext.Provider value={actionsValue}>
        <ScheduleSyncContext.Provider value={syncValue}>
          <ScheduleLayoutContext.Provider value={layoutValue}>
            <ScheduleContext.Provider value={value}>
              {children}
            </ScheduleContext.Provider>
          </ScheduleLayoutContext.Provider>
        </ScheduleSyncContext.Provider>
      </ScheduleActionsContext.Provider>
    </ScheduleDataContext.Provider>
  );
};

const useRequiredScheduleContext = (context, hookName) => {
  const ctx = useContext(context);
  if (!ctx) throw new Error(`${hookName} must be used within ScheduleProvider`);
  return ctx;
};

export const useSchedule = () => useRequiredScheduleContext(ScheduleContext, "useSchedule");
export const useScheduleData = () => useRequiredScheduleContext(ScheduleDataContext, "useScheduleData");
export const useScheduleActions = () => useRequiredScheduleContext(ScheduleActionsContext, "useScheduleActions");
export const useScheduleSync = () => useRequiredScheduleContext(ScheduleSyncContext, "useScheduleSync");
export const useScheduleLayout = () => useRequiredScheduleContext(ScheduleLayoutContext, "useScheduleLayout");

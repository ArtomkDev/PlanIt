import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, useColorScheme, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from 'uuid';
import { signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { db, auth } from "../config/firebase";
import { saveSchedule, resetUserSchedules, subscribeToSchedule, getScheduleFromServer, deleteAllUserData, updateDeviceSyncTimeAndCleanUp } from "../config/firestore";
import { getLocalSchedule, saveLocalSchedule, getDevicePrefs, saveDevicePrefs, clearLocalSchedule } from "../utils/storage";
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

let requestWidgetUpdate = null;
let ScheduleWidget = null;
if (Platform.OS === 'android') {
  try {
    requestWidgetUpdate = require('react-native-android-widget').requestWidgetUpdate;
    ScheduleWidget = require('../widgets/ScheduleWidget').ScheduleWidget;
  } catch (e) {}
}

const ScheduleContext = createContext(null);
const ScheduleDataContext = createContext(null);
const ScheduleActionsContext = createContext(null);
const ScheduleSyncContext = createContext(null);
const ScheduleLayoutContext = createContext(null);

const shallowEqualObjects = (left = {}, right = {}) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const hasDirtyScheduleData = (scheduleData) => {
  if (!scheduleData) return false;

  const isGlobalDirty = (scheduleData.global?.lastModified || 0) > (scheduleData.global?.lastSynced || 0);
  const hasDirtySchedules = (scheduleData.schedules || []).some(
    (s) => (s.lastModified || 0) > (s.lastSynced || 0)
  );

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

function resolveSyncConflict(localData, cloudData) {
  if (!localData) return { mergedData: cloudData, needsPushToCloud: false, conflicts: [] };
  if (!cloudData) return { mergedData: localData, needsPushToCloud: true, conflicts: [] };

  const watermark = Math.max(cloudData.global?.watermark || 0, localData.global?.watermark || 0);

  const mergedSchedulesMap = new Map();
  const conflicts = [];
  let needsPushToCloud = false;

  const cloudMap = new Map();
  (cloudData.schedules || []).forEach(s => {
    if (s && s.id) cloudMap.set(s.id, s);
  });

  const allIds = new Set([
    ...(localData.schedules || []).map(s => s.id),
    ...(cloudData.schedules || []).map(s => s.id)
  ]);

  allIds.forEach(id => {
    const localSch = (localData.schedules || []).find(s => s.id === id);
    const cloudSch = cloudMap.get(id);

    if (localSch && !cloudSch) {
      if (localSch.lastSynced > 0) {
      } else {
        mergedSchedulesMap.set(id, localSch);
        needsPushToCloud = true;
      }
    } else if (!localSch && cloudSch) {
      if (!(cloudSch.isDeleted && (cloudSch.deletedAt || cloudSch.lastModified || 0) <= watermark + 2000)) {
        mergedSchedulesMap.set(id, cloudSch);
      }
    } else {
      const localBase = Number(localSch.baseVersion) || 1;
      const cloudVer = Number(cloudSch.version) || 1;
      const isLocalDirty = (localSch.lastModified || 0) > (localSch.lastSynced || 0);

      if (localSch.isDeleted && cloudSch.isDeleted) {
        const latest = (localSch.deletedAt || 0) > (cloudSch.deletedAt || 0) ? localSch : cloudSch;
        mergedSchedulesMap.set(id, latest);
        if (latest === localSch && isLocalDirty) needsPushToCloud = true;
      } else if (localSch.isDeleted && !cloudSch.isDeleted) {
        if (localSch.lastModified > cloudSch.lastModified) {
          mergedSchedulesMap.set(id, localSch);
          needsPushToCloud = true;
        } else {
          mergedSchedulesMap.set(id, cloudSch);
        }
      } else if (!localSch.isDeleted && cloudSch.isDeleted) {
        if (cloudSch.lastModified > localSch.lastModified) {
          mergedSchedulesMap.set(id, cloudSch);
        } else {
          mergedSchedulesMap.set(id, localSch);
          needsPushToCloud = true;
        }
      } else {
        if (!isLocalDirty) {
          mergedSchedulesMap.set(id, localBase > cloudVer ? localSch : cloudSch);
        } else if (cloudVer > localBase) {
          conflicts.push({ local: localSch, cloud: cloudSch });
          mergedSchedulesMap.set(id, localSch);
        } else {
          mergedSchedulesMap.set(id, localSch);
          needsPushToCloud = true;
        }
      }
    }
  });

  for (const [id, sch] of mergedSchedulesMap.entries()) {
    if (sch.isDeleted && (sch.deletedAt || sch.lastModified || 0) <= watermark + 2000) {
      mergedSchedulesMap.delete(id);
    }
  }

  const isGlobalDirty = (localData.global?.lastModified || 0) > (localData.global?.lastSynced || 0);
  const localGlobalBase = Number(localData.global?.baseVersion) || 1;
  const cloudGlobalVer = Number(cloudData.global?.version) || 1;
  let mergedGlobal;

  if (!isGlobalDirty) {
    if (localGlobalBase > cloudGlobalVer) {
      mergedGlobal = localData.global;
    } else {
      mergedGlobal = cloudData.global;
    }
  } else if (cloudGlobalVer > localGlobalBase) {
    mergedGlobal = { ...cloudData.global, ...localData.global, version: cloudGlobalVer, baseVersion: cloudGlobalVer };
    needsPushToCloud = true;
  } else {
    mergedGlobal = localData.global;
    needsPushToCloud = true;
  }

  return {
    mergedData: {
      global: mergedGlobal,
      schedules: Array.from(mergedSchedulesMap.values())
    },
    needsPushToCloud,
    conflicts
  };
}

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

  const { lang, isLangLoading } = useAppLanguage(data?.global?.language);

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const lastLocalSaveFingerprintRef = useRef(null);
  const saveLocalScheduleIfChanged = useCallback(async (nextData, userId = null) => {
    const nextFingerprint = getScheduleDataFingerprint(nextData);
    const nextSaveKey = `${userId || "guest"}:${nextFingerprint}`;
    if (lastLocalSaveFingerprintRef.current === nextSaveKey) return;

    lastLocalSaveFingerprintRef.current = nextSaveKey;
    await saveLocalSchedule(nextData, userId);
  }, []);

  const conflictQueueRef = useRef(conflictQueue);
  useEffect(() => { conflictQueueRef.current = conflictQueue; }, [conflictQueue]);

  useEffect(() => {
    const loadLocal = async () => {
      const prefs = await getDevicePrefs();
      setDevicePrefs(prefs);

      if (guest) {
        const local = await getLocalSchedule(null);
        if (local) lastLocalSaveFingerprintRef.current = `guest:${getScheduleDataFingerprint(local)}`;
        setData(local || createDefaultData());
        setIsLoading(false);
        setCloudSyncState('synced');
      } else if (user) {
        const local = await getLocalSchedule(user.uid);

        if (local) {
          lastLocalSaveFingerprintRef.current = `${user.uid}:${getScheduleDataFingerprint(local)}`;
          setData(local);
          setIsLoading(false);
          setCloudSyncState('synced');
        } else {
          setCloudSyncState('syncing');
          try {
            const cloudData = await getScheduleFromServer(user.uid);

            if (cloudData && cloudData.schedules && cloudData.schedules.length > 0) {
              setData(cloudData);
              await saveLocalScheduleIfChanged(cloudData, user.uid);
              updateDeviceSyncTimeAndCleanUp(user.uid, { force: true });
            } else {
              const defaultData = createDefaultData();
              setData(defaultData);
              await saveLocalScheduleIfChanged(defaultData, user.uid);
            }
          } catch (e) {
            const defaultData = createDefaultData();
            setData(defaultData);
            await saveLocalScheduleIfChanged(defaultData, user.uid);
          } finally {
            setIsLoading(false);
            setCloudSyncState('synced');
          }
        }
      } else {
        setData(null);
        setIsLoading(false);
      }
    };

    loadLocal();
  }, [guest, user, saveLocalScheduleIfChanged]);

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
            lastModified: Date.now()
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
      const currentlyOnline = !!state.isConnected;
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

  useEffect(() => {
    let unsubscribeCloud = null;
    if (guest || !user) return;

    unsubscribeCloud = subscribeToSchedule(
      user.uid,
      async (fetchedCloudData, isFromCache, metadata = {}) => {
        if (conflictQueueRef.current.length > 0) return;

        setCloudSyncState(isFromCache ? 'syncing' : 'synced');

        if (metadata.hasPendingWrites) return;
        if (metadata.hasDataChanged === false) return;

        if (!isFromCache) {
          updateDeviceSyncTimeAndCleanUp(user.uid);
        }

        try {
          const currentLocal = dataRef.current || await getLocalSchedule(user.uid);
          if (!currentLocal) return;
          const localChangedWhileReading = dataRef.current && hasScheduleDataChanged(currentLocal, dataRef.current);
          if (localChangedWhileReading) return;

          const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedCloudData);

          if (conflicts.length > 0) {
            setConflictQueue(conflicts);
            setCloudSyncState('synced');
            return;
          }

          const mergedChanged = hasScheduleDataChanged(currentLocal, mergedData);

          if (mergedChanged) {
            setData(mergedData);
            dataRef.current = mergedData;
            await saveLocalScheduleIfChanged(mergedData, user.uid);
          }

          if (needsPushToCloud) {
            updateIsDirty(true);
            setPendingImmediateSave(true);
          } else {
            updateIsDirty(hasDirtyScheduleData(mergedChanged ? mergedData : currentLocal));
          }
        } catch (e) { }
      },
      () => { }
    );

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [guest, user, updateIsDirty, saveLocalScheduleIfChanged]);

  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalScheduleIfChanged(data, user?.uid || null);
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
      const nextData = typeof updater === "function" ? updater(previousData) : updater;

      if (!hasScheduleDataChanged(previousData, nextData)) {
        return previousData;
      }

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
          return { ...updated, lastModified: Date.now() };
        }
        return s;
      });

      if (!changed) return prev;

      const nextData = { ...prev, schedules: nextSchedules };
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
      const nextData = { ...prev, global: { ...prev.global, ...nextGlobal, lastModified: Date.now() } };
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
        version: 1,
        baseVersion: 1,
        lastModified: Date.now(),
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
        return {
          ...s,
          isDeleted: true,
          deletedAt: now,
          lastModified: now,
          lastSynced: 0,
          version: (s.version || 1) + 1,
          baseVersion: (s.baseVersion || 1) + 1
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
      nextGlobal.lastModified = now;
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
    if (guest || !dataRef.current || isSavingRef.current || conflictQueueRef.current.length > 0) return;
    if (!isDirtyRef.current && force !== true) return;

    const prev = dataRef.current;
    const isGlobalDirty = (prev.global?.lastModified || 0) > (prev.global?.lastSynced || 0);
    const dirtySchedules = (prev.schedules || []).filter(
      s => (s.lastModified || 0) > (s.lastSynced || 0)
    );

    if (!isGlobalDirty && dirtySchedules.length === 0) {
      updateIsDirty(false);
      return;
    }

    try {
      setIsSaving(true);
      isSavingRef.current = true;
      setIsCloudSaving(true);
      isCloudSavingRef.current = true;

      const now = Date.now();

      const dataToSave = {};
      let nextGlobal = { ...prev.global };
      let nextSchedules = [...prev.schedules];

      if (isGlobalDirty) {
        const nextGlobalVer = (prev.global?.version || 1) + 1;

        const updatedGlobal = {
          ...prev.global,
          language: prev.global?.language || lang || 'en',
          version: nextGlobalVer,
          baseVersion: nextGlobalVer,
          lastSynced: now
        };

        Object.keys(updatedGlobal).forEach(key => {
          if (updatedGlobal[key] === undefined) {
            delete updatedGlobal[key];
          }
        });

        dataToSave.global = updatedGlobal;
        nextGlobal = updatedGlobal;
      }

      if (dirtySchedules.length > 0) {
        dataToSave.schedules = dirtySchedules.map(s => {
          const nextVer = (s.version || 1) + 1;
          return { ...s, version: nextVer, baseVersion: nextVer, lastSynced: now };
        });

        nextSchedules = prev.schedules.map(currentSch => {
          const savedSch = dataToSave.schedules?.find(s => s.id === currentSch.id);
          if (savedSch) return savedSch;
          return currentSch;
        });
      }

      const watermark = prev.global?.watermark || 0;
      nextSchedules = nextSchedules.filter(s => !(s.isDeleted && (s.deletedAt || s.lastModified || 0) <= watermark + 2000));

      const optimisticData = { ...prev, global: nextGlobal, schedules: nextSchedules };

      setData(optimisticData);
      dataRef.current = optimisticData;
      await saveLocalScheduleIfChanged(optimisticData, user.uid);

      updateIsDirty(false);

      await saveSchedule(user.uid, dataToSave, true);

    } catch (e) {
      setError(e?.message || "Error saving");
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
      setIsCloudSaving(false);
      isCloudSavingRef.current = false;
    }
  }, [user, guest, updateIsDirty, lang, saveLocalScheduleIfChanged]);

  const safeLogout = useCallback(async () => {
    if (guest || !user) {
      await AsyncStorage.setItem("manual_logout", "true");
      await signOut(auth);
      return;
    }

    let attempts = 0;
    while ((isSavingRef.current || isCloudSavingRef.current) && attempts < 50) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }

    if (isDirtyRef.current) {
      await saveNow(true);

      attempts = 0;
      while ((isSavingRef.current || isCloudSavingRef.current) && attempts < 50) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
    }

    await AsyncStorage.setItem("manual_logout", "true");
    await signOut(auth);
  }, [guest, user, saveNow]);

  const reloadAllSchedules = useCallback(async () => {
    if (guest || !user) return;
    setCloudSyncState('syncing');
    try {
      const fetchedData = await getScheduleFromServer(user.uid);
      if (fetchedData) {
        const currentLocal = dataRef.current || await getLocalSchedule(user.uid);
        const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedData);
        if (conflicts.length > 0) {
          setConflictQueue(conflicts);
        } else {
          const mergedChanged = hasScheduleDataChanged(currentLocal, mergedData);
          if (mergedChanged) {
            setData(mergedData);
            dataRef.current = mergedData;
            await saveLocalScheduleIfChanged(mergedData, user.uid);
          }
          updateIsDirty(needsPushToCloud || hasDirtyScheduleData(mergedChanged ? mergedData : currentLocal));
        }
      }
      setCloudSyncState('synced');
    } catch (e) {
      setCloudSyncState('synced');
      setError(e?.message || "Error");
    }
  }, [guest, user, updateIsDirty, saveLocalScheduleIfChanged]);

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
        if (user && !guest && isOnline) {
          updateDeviceSyncTimeAndCleanUp(user.uid);
        }
      }
    });
    return () => subscription.remove();
  }, [isOnline, cloudSyncState, saveNow, user, guest, refreshActiveLessonReminders]);

  const resetApplication = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentGlobal = dataRef.current?.global || createDefaultData().global;
      const currentSchedules = dataRef.current?.schedules || [];
      
      const now = Date.now();
      const newSchedules = currentSchedules.map(s => ({
        ...s,
        isDeleted: true,
        deletedAt: now,
        lastModified: now,
        lastSynced: 0
      }));

      const newData = {
        global: { ...currentGlobal, lastModified: now, currentScheduleId: null },
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
        await resetUserSchedules(user.uid);
        await saveSchedule(user.uid, {
          global: newData.global,
          schedules: newData.schedules
        }, true);
        await saveLocalScheduleIfChanged(newData, user.uid);
      } else {
        await saveLocalScheduleIfChanged(newData, null);
      }
      updateIsDirty(false);
    } catch (e) {
      setError("Error");
    } finally {
      setIsLoading(false);
    }
  }, [user, updateIsDirty, syncDevicePrefsUpdate, saveLocalScheduleIfChanged]);

  const hardDeleteEverything = useCallback(async () => {
    setIsLoading(true);
    try {
      isDirtyRef.current = false;
      updateIsDirty(false);

      if (user) {
        await deleteAllUserData(user.uid);
        await clearLocalSchedule(user.uid);
      }
      
      await clearLocalSchedule(null);
      await AsyncStorage.removeItem('app_device_settings');
      await safeLogout();
    } catch (e) {
      setError("Error hard deleting");
    } finally {
      setIsLoading(false);
    }
  }, [user, safeLogout, updateIsDirty]);

  const deleteGuestSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearLocalSchedule(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleResolveConflict = useCallback((conflictId, action) => {
    const conflictIndex = conflictQueue.findIndex(c => c.local?.id === conflictId);
    if (conflictIndex === -1) return;

    const currentConflict = conflictQueue[conflictIndex];
    const prev = dataRef.current;
    if (!prev) return;
    let nextSchedules = [...prev.schedules];

    if (action === 'local') {
      nextSchedules = nextSchedules.map(s => {
        if (s.id === conflictId) {
          return {
            ...currentConflict.local,
            baseVersion: currentConflict.cloud.version,
            lastModified: Date.now()
          };
        }
        return s;
      });
    } else if (action === 'cloud') {
      nextSchedules = nextSchedules.map(s => {
        if (s.id === conflictId) {
          return {
            ...currentConflict.cloud,
            lastSynced: currentConflict.cloud.lastModified
          };
        }
        return s;
      });
    } else if (action === 'both') {
      nextSchedules = nextSchedules.map(s => {
        if (s.id === conflictId) {
          return {
            ...currentConflict.cloud,
            lastSynced: currentConflict.cloud.lastModified
          };
        }
        return s;
      });
      const newLocalSchedule = {
        ...currentConflict.local,
        id: uuidv4(),
        name: `${currentConflict.local.name || ""} (Copy)`,
        baseVersion: 1,
        version: 1,
        lastModified: Date.now(),
        lastSynced: 0
      };
      nextSchedules.push(newLocalSchedule);
    }

    const updatedData = { ...prev, schedules: nextSchedules };

    setData(updatedData);
    dataRef.current = updatedData;
    saveLocalScheduleIfChanged(updatedData, user?.uid || null);

    const filteredQ = conflictQueue.filter(c => c.local?.id !== conflictId);
    setConflictQueue(filteredQ);

    if (filteredQ.length === 0) {
      if (!guest) {
        const hasDirtySchedules = nextSchedules.some(s => (s.lastModified || 0) > (s.lastSynced || 0));
        const isGlobalDirty = (updatedData.global?.lastModified || 0) > (updatedData.global?.lastSynced || 0);

        if (hasDirtySchedules || isGlobalDirty) {
          updateIsDirty(true);
          if (action !== 'cloud') {
            setPendingImmediateSave(true);
          }
        } else {
          updateIsDirty(false);
        }
      }
    }
  }, [conflictQueue, guest, updateIsDirty, user, saveLocalScheduleIfChanged]);

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
    hardDeleteEverything,
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
    hardDeleteEverything,
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

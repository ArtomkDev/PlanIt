import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, useColorScheme } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from 'uuid';
import { db } from "../../firebase"; 
import { saveSchedule, resetUserSchedules, subscribeToSchedule, getScheduleFromServer } from "../../firestore";
import { getLocalSchedule, saveLocalSchedule, getDevicePrefs, saveDevicePrefs } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";
import SyncConflictScreen from "../components/SyncConflictScreen";

const ScheduleContext = createContext(null);

function resolveSyncConflict(localData, cloudData) {
  if (!localData) return { mergedData: cloudData, needsPushToCloud: false, conflicts: [] };
  if (!cloudData) return { mergedData: localData, needsPushToCloud: true, conflicts: [] };

  const mergedSchedulesMap = new Map();
  const conflicts = [];
  let needsPushToCloud = false;

  const cloudMap = new Map();
  (cloudData.schedules || []).forEach(s => {
    if (s && s.id) cloudMap.set(s.id, s);
  });

  (localData.schedules || []).forEach(localSch => {
    if (!localSch || !localSch.id) return;
    const cloudSch = cloudMap.get(localSch.id);

    if (!cloudSch) {
      if ((localSch.lastSynced || 0) > 0) {
      } else {
        mergedSchedulesMap.set(localSch.id, localSch);
        needsPushToCloud = true;
      }
    } else {
      const localBase = Number(localSch.baseVersion) || 1;
      const cloudVer = Number(cloudSch.version) || 1;
      const isLocalDirty = (localSch.lastModified || 0) > (localSch.lastSynced || 0);

      if (!isLocalDirty) {
        if (localBase > cloudVer) {
          mergedSchedulesMap.set(localSch.id, localSch);
        } else {
          mergedSchedulesMap.set(cloudSch.id, cloudSch);
        }
      } else if (cloudVer > localBase) {
        if (cloudSch.isDeleted && !localSch.isDeleted) {
          mergedSchedulesMap.set(cloudSch.id, cloudSch);
        } else {
          conflicts.push({ local: localSch, cloud: cloudSch });
          mergedSchedulesMap.set(localSch.id, localSch);
        }
      } else {
        mergedSchedulesMap.set(localSch.id, localSch);
        needsPushToCloud = true;
      }
    }
  });

  (cloudData.schedules || []).forEach(cloudSch => {
    if (cloudSch && cloudSch.id && !mergedSchedulesMap.has(cloudSch.id)) {
      mergedSchedulesMap.set(cloudSch.id, cloudSch);
    }
  });

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
  useEffect(() => { devicePrefsRef.current = devicePrefs; }, [devicePrefs]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [conflictQueue, setConflictQueue] = useState([]);

  const [isOnline, setIsOnline] = useState(true);
  const prevOnlineRef = useRef(isOnline);

  const [cloudSyncState, setCloudSyncState] = useState('syncing');
  const [pendingImmediateSave, setPendingImmediateSave] = useState(false);

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const conflictQueueRef = useRef(conflictQueue);
  useEffect(() => { conflictQueueRef.current = conflictQueue; }, [conflictQueue]);

  useEffect(() => {
    const loadLocal = async () => {
      const prefs = await getDevicePrefs(user?.uid);
      setDevicePrefs(prefs);

      if (guest) {
        const local = await getLocalSchedule(null);
        setData(local || createDefaultData());
        setIsLoading(false);
      } else if (user) {
        const local = await getLocalSchedule(user.uid);
        if (local) setData(local);
        else setData(createDefaultData());
        setIsLoading(false);
      } else {
        setData(null);
        setIsLoading(false);
      }
    };
    loadLocal();
  }, [guest, user]);

  useEffect(() => {
    if (!data || isLoading) return;

    if (guest || cloudSyncState === 'synced' || cloudSyncState === 'offline') {
        const currentPrefs = devicePrefsRef.current;
        let prefsNeedSave = false;
        const newPrefs = { ...currentPrefs };

        if (!newPrefs.theme) {
            const defaultMode = systemColorScheme === 'light' ? 'light' : 'dark';
            newPrefs.theme = data.global?.theme || [defaultMode, 'red'];
            prefsNeedSave = true;
        }

        if (!newPrefs.currentScheduleId) {
            const activeSchedules = (data.schedules || []).filter(s => !s.isDeleted);
            if (activeSchedules.length > 0) {
                const sorted = [...activeSchedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
                newPrefs.currentScheduleId = sorted[0].id;
            } else if (data.global?.currentScheduleId) {
                newPrefs.currentScheduleId = data.global.currentScheduleId;
            }

            if (newPrefs.currentScheduleId) {
                prefsNeedSave = true;
            }
        }

        if (prefsNeedSave) {
            setDevicePrefs(newPrefs);
            saveDevicePrefs(newPrefs, user?.uid);
        }
    }
  }, [data, isLoading, guest, cloudSyncState, user, systemColorScheme]);

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
      async (fetchedCloudData, isFromCache) => {
        if (conflictQueueRef.current.length > 0) return;

        try {
          const currentLocal = dataRef.current || await getLocalSchedule(user.uid);
          if (!currentLocal) return;

          const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedCloudData);

          if (conflicts.length > 0) {
            setConflictQueue(conflicts);
            setCloudSyncState('synced');
            return;
          }

          setData(mergedData);
          await saveLocalSchedule(mergedData, user.uid);

          if (needsPushToCloud) setIsDirty(true);
          else setIsDirty(false);

          if (!isFromCache) {
             setCloudSyncState('synced');
          }
        } catch (e) {}
      },
      () => {}
    );

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [guest, user]);

  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalSchedule(data, user?.uid || null);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [data, isLoading, user]);

  const mergedGlobal = useMemo(() => {
    if (!data?.global) return null;
    return {
      ...data.global,
      ...(devicePrefs.theme ? { theme: devicePrefs.theme } : {}),
      ...(devicePrefs.currentScheduleId ? { currentScheduleId: devicePrefs.currentScheduleId } : {})
    };
  }, [data?.global, devicePrefs]);

  const currentScheduleId = mergedGlobal?.currentScheduleId || null;

  const activeSchedules = useMemo(() => {
    return (data?.schedules || []).filter(s => !s.isDeleted);
  }, [data?.schedules]);

  const schedule = useMemo(() => {
    if (!activeSchedules.length) return null;
    return (currentScheduleId
      ? activeSchedules.find((s) => s.id === currentScheduleId)
      : null) || activeSchedules[0];
  }, [activeSchedules, currentScheduleId]);

  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const currentId = devicePrefsRef.current.currentScheduleId || prev?.global?.currentScheduleId;
      if (!currentId) return prev;

      const nextSchedules = prev.schedules.map((s) => {
        if (s.id === currentId) {
          const updated = typeof updater === "function" ? updater(s) : updater;
          return { ...updated, lastModified: Date.now() };
        }
        return s;
      });
      return { ...prev, schedules: nextSchedules };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  const setGlobalDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;

      const currentMerged = {
        ...prev.global,
        ...(devicePrefsRef.current.theme ? { theme: devicePrefsRef.current.theme } : {}),
        ...(devicePrefsRef.current.currentScheduleId ? { currentScheduleId: devicePrefsRef.current.currentScheduleId } : {})
      };

      const nextGlobal = typeof updater === "function" ? updater(currentMerged) : updater;

      const newPrefs = { ...devicePrefsRef.current };
      let prefsChanged = false;

      if (nextGlobal.theme && JSON.stringify(nextGlobal.theme) !== JSON.stringify(currentMerged.theme)) {
        newPrefs.theme = nextGlobal.theme;
        prefsChanged = true;
      }
      if (nextGlobal.currentScheduleId && nextGlobal.currentScheduleId !== currentMerged.currentScheduleId) {
        newPrefs.currentScheduleId = nextGlobal.currentScheduleId;
        prefsChanged = true;
      }

      if (prefsChanged) {
        setDevicePrefs(newPrefs);
        saveDevicePrefs(newPrefs, user?.uid);
      }

      return { ...prev, global: { ...prev.global, ...nextGlobal, lastModified: Date.now() } };
    });

    if (!guest) setIsDirty(true);
  }, [guest, user]);

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
      return { ...prev, schedules: [...(prev.schedules || []), newSchedule] };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  const removeSchedule = useCallback(async (scheduleId) => {
    let fallbackId = null;

    setData(prev => {
      if (!prev) return prev;
      const nextSchedules = prev.schedules.map(s => {
        if (s.id === scheduleId) {
          return {
            id: s.id, 
            isDeleted: true, 
            version: s.version || 1, 
            baseVersion: s.baseVersion || 1,
            lastSynced: s.lastSynced || 0,
            lastModified: Date.now()
          };
        }
        return s;
      });
      
      const availableSchedules = nextSchedules.filter(s => !s.isDeleted);
      let nextGlobal = { ...prev.global };

      const currentId = devicePrefsRef.current.currentScheduleId || prev.global?.currentScheduleId;

      if (currentId === scheduleId && availableSchedules.length > 0) {
        const sorted = [...availableSchedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        fallbackId = sorted[0].id;
        nextGlobal.currentScheduleId = fallbackId;
        nextGlobal.lastModified = Date.now();
      } else if (currentId === scheduleId) {
        fallbackId = null;
        nextGlobal.currentScheduleId = null;
        nextGlobal.lastModified = Date.now();
      }

      return { ...prev, global: nextGlobal, schedules: nextSchedules };
    });

    if (fallbackId !== null) {
      const newPrefs = { ...devicePrefsRef.current, currentScheduleId: fallbackId };
      setDevicePrefs(newPrefs);
      saveDevicePrefs(newPrefs, user?.uid);
    }

    if (!guest) setIsDirty(true);
  }, [guest, user]);

  const saveNow = useCallback(async (force = false) => {
    if (guest || !dataRef.current || isSaving || conflictQueue.length > 0) return;
    if (!isDirty && force !== true) return;

    setIsSaving(true);
    setIsCloudSaving(true);

    try {
      const now = Date.now();
      const prev = dataRef.current;

      const isGlobalDirty = force || (prev.global?.lastModified || 0) > (prev.global?.lastSynced || 0);
      const dirtySchedules = prev.schedules.filter(s => force || (s.lastModified || 0) > (s.lastSynced || 0));

      if (!isGlobalDirty && dirtySchedules.length === 0 && !force) {
        setIsDirty(false);
        setIsSaving(false);
        setIsCloudSaving(false);
        return;
      }

      const dataToSave = {};
      let nextGlobal = { ...prev.global };
      let nextSchedules = [...prev.schedules];

      if (isGlobalDirty) {
        const nextGlobalVer = (prev.global?.version || 1) + 1;
        const updatedGlobal = { ...prev.global, version: nextGlobalVer, baseVersion: nextGlobalVer, lastSynced: now };
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
          if (savedSch) {
            return { 
              ...currentSch, 
              version: savedSch.version, 
              baseVersion: savedSch.baseVersion, 
              lastSynced: savedSch.lastSynced 
            };
          }
          return currentSch;
        });
      }

      const optimisticData = { ...prev, global: nextGlobal, schedules: nextSchedules };

      setData(optimisticData);
      dataRef.current = optimisticData;
      await saveLocalSchedule(optimisticData, user.uid);
      setIsDirty(false);

      await saveSchedule(user.uid, dataToSave, true);

    } catch (e) {
      setError(e?.message || "Error saving");
    } finally {
      setIsSaving(false);
      setIsCloudSaving(false);
    }
  }, [user, isSaving, isDirty, guest, conflictQueue.length]);

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
            setData(mergedData);
            await saveLocalSchedule(mergedData, user.uid);
            if (needsPushToCloud) setIsDirty(true);
            else setIsDirty(false);
          }
      }
      setCloudSyncState('synced');
    } catch (e) {
      setCloudSyncState('synced');
      setError(e?.message || "Error");
    }
  }, [guest, user]);

  useEffect(() => {
    if (pendingImmediateSave && conflictQueue.length === 0) {
      setPendingImmediateSave(false);
      saveNow(true);
    }
  }, [pendingImmediateSave, conflictQueue.length, saveNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isDirty && isOnline && cloudSyncState === 'synced') {
          saveNow();
        }
      }
    });
    return () => subscription.remove();
  }, [isDirty, isOnline, cloudSyncState, saveNow]);

  const resetApplication = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentGlobal = dataRef.current?.global || createDefaultData().global;
      const defaultData = createDefaultData();

      // 🔥 ЧИСТИЙ НАДГРОБОК
      const oldTombstones = (dataRef.current?.schedules || []).map(s => ({
          id: s.id, 
          isDeleted: true,
          version: (s.version || 1) + 1,
          baseVersion: (s.version || 1) + 1,
          lastModified: Date.now(),
          lastSynced: 0
      }));

      const newData = { 
        global: { ...currentGlobal, lastModified: Date.now() }, 
        schedules: [...oldTombstones, ...defaultData.schedules] 
      };

      setDevicePrefs({});
      await saveDevicePrefs({}, user?.uid);

      setData(newData);
      
      if (user) {
        await resetUserSchedules(user.uid); 
        await saveSchedule(user.uid, { global: newData.global, schedules: defaultData.schedules }, true);
        await saveLocalSchedule(newData, user.uid);
      } else {
        await saveLocalSchedule(newData, null);
      }
      setIsDirty(false);
    } catch (e) {
      setError("Error");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleResolveConflict = (conflictId, action) => {
    const conflictIndex = conflictQueue.findIndex(c => c.local?.id === conflictId);
    if (conflictIndex === -1) return;

    const currentConflict = conflictQueue[conflictIndex];
    const prev = dataRef.current;
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
    saveLocalSchedule(updatedData, user?.uid || null);

    const filteredQ = conflictQueue.filter(c => c.local?.id !== conflictId);
    setConflictQueue(filteredQ);

    if (filteredQ.length === 0) {
      if (!guest) {
        const hasDirtySchedules = nextSchedules.some(s => (s.lastModified || 0) > (s.lastSynced || 0));
        const isGlobalDirty = (updatedData.global?.lastModified || 0) > (updatedData.global?.lastSynced || 0);

        if (hasDirtySchedules || isGlobalDirty) {
          setIsDirty(true);
          if (action !== 'cloud') {
             setPendingImmediateSave(true);
          }
        } else {
          setIsDirty(false);
        }
      }
    }
  };

  const value = {
    user, guest, schedule,
    global: mergedGlobal,
    schedules: activeSchedules, 
    setData, setScheduleDraft, setGlobalDraft, addSchedule, removeSchedule, saveNow,
    reloadAllSchedules, resetApplication, isDirty, isSaving, isCloudSaving,
    isLoading, error, isOnline,
    conflictQueue, handleResolveConflict,
    cloudSyncState
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
      <SyncConflictScreen 
        conflictQueue={conflictQueue} 
        handleResolveConflict={handleResolveConflict} 
      />
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};
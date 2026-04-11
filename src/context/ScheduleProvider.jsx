import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, useColorScheme } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from 'uuid';
import { signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { db, auth } from "../../firebase"; 
import { saveSchedule, resetUserSchedules, subscribeToSchedule, getScheduleFromServer } from "../../firestore";
import { getLocalSchedule, saveLocalSchedule, getDevicePrefs, saveDevicePrefs } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";
import useAppLanguage from "../hooks/useAppLanguage";

const ScheduleContext = createContext(null);

function resolveSyncConflict(localData, cloudData) {
  if (!localData) return { mergedData: cloudData, needsPushToCloud: false, conflicts: [] };
  if (!cloudData) return { mergedData: localData, needsPushToCloud: true, conflicts: [] };

  const mergedSchedulesMap = new Map();
  const conflicts = [];
  let needsPushToCloud = false;

  const mergedDeletedMap = new Map();
  const localDeleted = localData.deletedSchedules || [];
  const cloudDeleted = cloudData.deletedSchedules || cloudData.global?.deletedSchedules || [];

  localDeleted.forEach(ld => mergedDeletedMap.set(ld.id, ld));
  cloudDeleted.forEach(cd => {
    const existing = mergedDeletedMap.get(cd.id);
    if (!existing || cd.deletedAt > existing.deletedAt) {
      mergedDeletedMap.set(cd.id, cd);
    }
    if (!existing && !localData.schedules?.some(s => s.id === cd.id)) {
       needsPushToCloud = true; 
    }
  });

  const cloudMap = new Map();
  (cloudData.schedules || []).forEach(s => {
    if (s && s.id) {
      cloudMap.set(s.id, s);
      if (s.isDeleted && !mergedDeletedMap.has(s.id)) {
        mergedDeletedMap.set(s.id, {
          id: s.id,
          deletedAt: s.lastModified || Date.now(),
          lastSynced: s.lastModified || Date.now()
        });
      }
    }
  });

  (localData.schedules || []).forEach(localSch => {
    if (!localSch || !localSch.id) return;
    
    const deletionRecord = mergedDeletedMap.get(localSch.id);
    if (deletionRecord) {
      if ((localSch.lastModified || 0) > deletionRecord.deletedAt) {
         mergedDeletedMap.delete(localSch.id);
         needsPushToCloud = true;
      } else {
         return; 
      }
    }

    const cloudSch = cloudMap.get(localSch.id);

    if (!cloudSch) {
      if (!((localSch.lastSynced || 0) > 0)) {
        mergedSchedulesMap.set(localSch.id, localSch);
        needsPushToCloud = true;
      }
    } else {
      if (cloudSch.isDeleted) return;

      const localBase = Number(localSch.baseVersion) || 1;
      const cloudVer = Number(cloudSch.version) || 1;
      const isLocalDirty = (localSch.lastModified || 0) > (localSch.lastSynced || 0);

      if (!isLocalDirty) {
        mergedSchedulesMap.set(localBase > cloudVer ? localSch.id : cloudSch.id, localBase > cloudVer ? localSch : cloudSch);
      } else if (cloudVer > localBase) {
        conflicts.push({ local: localSch, cloud: cloudSch });
        mergedSchedulesMap.set(localSch.id, localSch);
      } else {
        mergedSchedulesMap.set(localSch.id, localSch);
        needsPushToCloud = true;
      }
    }
  });

  (cloudData.schedules || []).forEach(cloudSch => {
    if (cloudSch && cloudSch.id && !mergedSchedulesMap.has(cloudSch.id)) {
      if (!mergedDeletedMap.has(cloudSch.id) && !cloudSch.isDeleted) {
        mergedSchedulesMap.set(cloudSch.id, cloudSch);
      }
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
      schedules: Array.from(mergedSchedulesMap.values()),
      deletedSchedules: Array.from(mergedDeletedMap.values())
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
  
  const syncDevicePrefsUpdate = useCallback((newPrefs) => {
    devicePrefsRef.current = newPrefs;
    setDevicePrefs(newPrefs);
    saveDevicePrefs(newPrefs);
  }, []);

  useEffect(() => { devicePrefsRef.current = devicePrefs; }, [devicePrefs]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const updateIsDirty = useCallback((val) => {
    setIsDirty(val);
    isDirtyRef.current = val;
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const isCloudSavingRef = useRef(false);

  const [conflictQueue, setConflictQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const prevOnlineRef = useRef(isOnline);

  const [cloudSyncState, setCloudSyncState] = useState('syncing');
  const [pendingImmediateSave, setPendingImmediateSave] = useState(false);

  const { lang, isLangLoading } = useAppLanguage(data?.global?.language);

  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  const conflictQueueRef = useRef(conflictQueue);
  useEffect(() => { conflictQueueRef.current = conflictQueue; }, [conflictQueue]);

  useEffect(() => {
    const loadLocal = async () => {
      const prefs = await getDevicePrefs();
      setDevicePrefs(prefs);

      if (guest) {
        const local = await getLocalSchedule(null);
        setData(local || createDefaultData());
        setIsLoading(false);
      } else if (user) {
        const local = await getLocalSchedule(user.uid);
        if (local) {
            setData(local);
        } else {
            const defaultData = createDefaultData();
            setData(defaultData);
            await saveLocalSchedule(defaultData, user.uid);
        }
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
            newPrefs.theme = data.global?.theme || [defaultMode, 'blue'];
            prefsNeedSave = true;
        }

        const activeSchedules = data.schedules || [];

        if (activeSchedules.length === 0) {
            const defaultData = createDefaultData();
            const newSchedule = defaultData.schedules[0];
            
            newSchedule.version = 1;
            newSchedule.baseVersion = 1;
            newSchedule.lastModified = Date.now();
            newSchedule.lastSynced = 0;
            newSchedule.isCloud = !guest;

            setData(prev => ({
                ...prev,
                schedules: [...(prev.schedules || []), newSchedule]
            }));

            newPrefs.currentScheduleId = newSchedule.id;
            prefsNeedSave = true;

            if (!guest) updateIsDirty(true);
        } else {
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
        }

        if (prefsNeedSave) {
            syncDevicePrefsUpdate(newPrefs);
        }
    }
  }, [data, isLoading, guest, cloudSyncState, user, systemColorScheme, updateIsDirty, syncDevicePrefsUpdate]);

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

          if (needsPushToCloud) {
             updateIsDirty(true);
             setPendingImmediateSave(true);
          } else {
             updateIsDirty(false);
          }

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
  }, [guest, user, updateIsDirty]);

  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalSchedule(data, user?.uid || null);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [data, isLoading, user]);

  const mergedGlobal = useMemo(() => {
    const baseGlobal = data?.global || {};
    const fallbackMode = systemColorScheme === 'dark' ? 'dark' : 'light';

    return {
      ...baseGlobal,
      theme: devicePrefs.theme || baseGlobal.theme || [fallbackMode, "blue"],
      currentScheduleId: devicePrefs.currentScheduleId || baseGlobal.currentScheduleId,
      language: lang 
    };
  }, [data?.global, devicePrefs, lang, systemColorScheme]);

  const currentScheduleId = mergedGlobal?.currentScheduleId || null;

  const activeSchedules = useMemo(() => {
    return data?.schedules || [];
  }, [data?.schedules]);

  const schedule = useMemo(() => {
    if (!activeSchedules.length) return null;
    return (currentScheduleId
      ? activeSchedules.find((s) => s.id === currentScheduleId)
      : null) || activeSchedules[0];
  }, [activeSchedules, currentScheduleId]);

  const setScheduleDraft = useCallback((updater) => {
    const currentId = devicePrefsRef.current.currentScheduleId || dataRef.current?.global?.currentScheduleId;
    if (!currentId) return;

    setData((prev) => {
      if (!prev) return prev;
      
      const nextSchedules = prev.schedules.map((s) => {
        if (s.id === currentId) {
          const updated = typeof updater === "function" ? updater(s) : updater;
          return { ...updated, lastModified: Date.now() };
        }
        return s;
      });
      return { ...prev, schedules: nextSchedules };
    });
    
    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty]);

  const setGlobalDraft = useCallback((updater) => {
    const currentPrev = dataRef.current;
    if (!currentPrev) return;

    const currentMerged = {
      ...currentPrev.global,
      theme: devicePrefsRef.current.theme,
      currentScheduleId: devicePrefsRef.current.currentScheduleId,
      language: devicePrefsRef.current.language
    };

    const nextGlobal = typeof updater === "function" ? updater(currentMerged) : updater;

    let prefsChanged = false;
    const newPrefs = { ...devicePrefsRef.current };

    if (nextGlobal.theme && JSON.stringify(nextGlobal.theme) !== JSON.stringify(currentMerged.theme)) {
      newPrefs.theme = nextGlobal.theme;
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

    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, global: { ...prev.global, ...nextGlobal, lastModified: Date.now() } };
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
      return { ...prev, schedules: [...(prev.schedules || []), newSchedule] };
    });
    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty]);

  const removeSchedule = useCallback(async (scheduleId) => {
    const prev = dataRef.current;
    if (!prev) return;

    const nextSchedules = prev.schedules.filter(s => s.id !== scheduleId);
    let fallbackId = null;

    const nextDeleted = [...(prev.deletedSchedules || [])];
    if (!nextDeleted.some(d => d.id === scheduleId)) {
      nextDeleted.push({ id: scheduleId, deletedAt: Date.now(), lastSynced: 0 });
    }

    let nextGlobal = { ...prev.global };
    const currentId = devicePrefsRef.current.currentScheduleId || prev.global?.currentScheduleId;

    if (currentId === scheduleId) {
      if (nextSchedules.length > 0) {
        const sorted = [...nextSchedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        fallbackId = sorted[0].id;
      }
      nextGlobal.currentScheduleId = fallbackId;
      nextGlobal.lastModified = Date.now();
    }

    if (fallbackId !== null) {
      syncDevicePrefsUpdate({ ...devicePrefsRef.current, currentScheduleId: fallbackId });
    }

    setData(current => {
      if (!current) return current;
      return { 
        ...current, 
        global: nextGlobal, 
        schedules: current.schedules.filter(s => s.id !== scheduleId), 
        deletedSchedules: nextDeleted 
      };
    });

    if (!guest) updateIsDirty(true);
  }, [guest, updateIsDirty, syncDevicePrefsUpdate]);

  const saveNow = useCallback(async (force = false) => {
    if (guest || !dataRef.current || isSavingRef.current || conflictQueueRef.current.length > 0) return;
    if (!isDirtyRef.current && force !== true) return;

    setIsSaving(true);
    isSavingRef.current = true;
    setIsCloudSaving(true);
    isCloudSavingRef.current = true;

    try {
      const now = Date.now();
      const prev = dataRef.current;

      const isGlobalDirty = force || (prev.global?.lastModified || 0) > (prev.global?.lastSynced || 0);
      const dirtySchedules = prev.schedules.filter(s => force || (s.lastModified || 0) > (s.lastSynced || 0));
      const dirtyDeleted = (prev.deletedSchedules || []).filter(d => force || (d.deletedAt || 0) > (d.lastSynced || 0));

      if (!isGlobalDirty && dirtySchedules.length === 0 && dirtyDeleted.length === 0 && !force) {
        updateIsDirty(false);
        return;
      }

      const dataToSave = {};
      let nextGlobal = { ...prev.global };
      let nextSchedules = [...prev.schedules];
      let nextDeleted = [...(prev.deletedSchedules || [])];

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

      if (dirtyDeleted.length > 0 || force) {
        dataToSave.deletedSchedules = nextDeleted.map(d => {
           if (force || (d.deletedAt || 0) > (d.lastSynced || 0)) {
               return { ...d, lastSynced: now };
           }
           return d;
        });
        nextDeleted = dataToSave.deletedSchedules;
      }

      const optimisticData = { ...prev, global: nextGlobal, schedules: nextSchedules, deletedSchedules: nextDeleted };

      setData(optimisticData);
      dataRef.current = optimisticData;
      await saveLocalSchedule(optimisticData, user.uid);
      
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
  }, [user, guest, updateIsDirty]);

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
            setData(mergedData);
            await saveLocalSchedule(mergedData, user.uid);
            updateIsDirty(needsPushToCloud);
          }
      }
      setCloudSyncState('synced');
    } catch (e) {
      setCloudSyncState('synced');
      setError(e?.message || "Error");
    }
  }, [guest, user, updateIsDirty]);

  useEffect(() => {
    if (pendingImmediateSave && conflictQueue.length === 0) {
      setPendingImmediateSave(false);
      saveNow(true);
    }
  }, [pendingImmediateSave, conflictQueue.length, saveNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isDirtyRef.current && isOnline && cloudSyncState === 'synced') {
          saveNow();
        }
      }
    });
    return () => subscription.remove();
  }, [isOnline, cloudSyncState, saveNow]);

  const resetApplication = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentGlobal = dataRef.current?.global || createDefaultData().global;
      const defaultData = createDefaultData();

      const currentSchedules = dataRef.current?.schedules || [];
      const newDeletions = currentSchedules.map(s => ({
          id: s.id,
          deletedAt: Date.now(),
          lastSynced: 0
      }));
      const existingDeletions = dataRef.current?.deletedSchedules || [];

      const newData = { 
        global: { ...currentGlobal, lastModified: Date.now() }, 
        schedules: [...defaultData.schedules],
        deletedSchedules: [...existingDeletions, ...newDeletions]
      };

      const retainedPrefs = { 
        theme: devicePrefsRef.current.theme, 
        language: devicePrefsRef.current.language 
      };
      syncDevicePrefsUpdate(retainedPrefs);

      setData(newData);
      
      if (user) {
        await resetUserSchedules(user.uid); 
        await saveSchedule(user.uid, { 
            global: newData.global, 
            schedules: newData.schedules,
            deletedSchedules: newData.deletedSchedules 
        }, true);
        await saveLocalSchedule(newData, user.uid);
      } else {
        await saveLocalSchedule(newData, null);
      }
      updateIsDirty(false);
    } catch (e) {
      setError("Error");
    } finally {
      setIsLoading(false);
    }
  }, [user, updateIsDirty, syncDevicePrefsUpdate]);

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
          updateIsDirty(true);
          if (action !== 'cloud') {
              setPendingImmediateSave(true);
          }
        } else {
          updateIsDirty(false);
        }
      }
    }
  };

  const value = {
    user, guest, schedule,
    global: mergedGlobal,
    schedules: activeSchedules, 
    setData, setScheduleDraft, setGlobalDraft, addSchedule, removeSchedule, saveNow,
    safeLogout,
    reloadAllSchedules, resetApplication, isDirty, isSaving, isCloudSaving,
    isLoading, error, isOnline,
    conflictQueue, handleResolveConflict,
    cloudSyncState,
    lang, isLangLoading
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};
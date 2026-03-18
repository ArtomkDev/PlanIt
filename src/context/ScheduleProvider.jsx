import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, useColorScheme } from "react-native"; // 🔥 ДОДАНО: useColorScheme
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from 'uuid'; 
import { enableNetwork, disableNetwork } from "firebase/firestore";
import { db } from "../../firebase";
import { saveSchedule, resetUserSchedules, subscribeToSchedule, getScheduleFromServer } from "../../firestore"; 
import { getLocalSchedule, saveLocalSchedule, getDevicePrefs, saveDevicePrefs } from "../utils/storage"; 
import createDefaultData from "../config/createDefaultData";
import SyncConflictScreen from "../components/SyncConflictScreen";

const ScheduleContext = createContext(null);

const checkIsOnline = async () => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    await fetch('https://firestore.googleapis.com/favicon.ico?_=' + new Date().getTime(), { 
       mode: 'no-cors',
       signal: controller.signal
    });
    clearTimeout(id);
    return true;
  } catch (e) {
    return false;
  }
};

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
      mergedSchedulesMap.set(localSch.id, localSch);
      needsPushToCloud = true;
    } else {
      if (localSch.lastModified === cloudSch.lastModified) {
        mergedSchedulesMap.set(cloudSch.id, cloudSch);
      } else {
        const localBase = Number(localSch.baseVersion) || 1;
        const cloudVer = Number(cloudSch.version) || 1;
        const isLocalDirty = (localSch.lastModified || 0) > (localSch.lastSynced || 0);

        if (cloudVer > localBase) {
          if (isLocalDirty) {
            conflicts.push({ local: localSch, cloud: cloudSch });
            mergedSchedulesMap.set(localSch.id, localSch); 
          } else {
            mergedSchedulesMap.set(cloudSch.id, cloudSch);
          }
        } else {
          if (isLocalDirty) {
             mergedSchedulesMap.set(localSch.id, localSch);
             needsPushToCloud = true;
          } else {
             mergedSchedulesMap.set(cloudSch.id, cloudSch);
          }
        }
      }
    }
  });

  (cloudData.schedules || []).forEach(cloudSch => {
    if (cloudSch && cloudSch.id && !mergedSchedulesMap.has(cloudSch.id)) {
      mergedSchedulesMap.set(cloudSch.id, cloudSch);
    }
  });

  const localGlobalMod = localData.global?.lastModified || 0;
  const cloudGlobalMod = cloudData.global?.lastModified || 0;
  let mergedGlobal;

  if (localGlobalMod === cloudGlobalMod) {
    mergedGlobal = cloudData.global;
  } else if (localGlobalMod > cloudGlobalMod) {
    mergedGlobal = { ...cloudData.global, ...localData.global };
    needsPushToCloud = true;
  } else {
    mergedGlobal = { ...localData.global, ...cloudData.global };
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
  
  // 🔥 Отримуємо системну тему пристрою (світла або темна)
  const systemColorScheme = useColorScheme(); 

  // Стейт для налаштувань пристрою
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
  const isOnlineRef = useRef(isOnline); 
  
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

  // ФІКСАЦІЯ (LOCKING) ДЛЯ НОВИХ ПРИСТРОЇВ
  useEffect(() => {
    if (!data || isLoading) return;
    
    // Чекаємо, поки хмара дасть дані, або якщо ми офлайн / гості
    if (guest || cloudSyncState === 'synced' || cloudSyncState === 'offline') {
        const currentPrefs = devicePrefsRef.current;
        let prefsNeedSave = false;
        const newPrefs = { ...currentPrefs };

        // 1. Фіксуємо тему
        if (!newPrefs.theme) {
            // 🔥 ВИПРАВЛЕНО: Беремо шаблон з хмари, інакше системну тему + червоний акцент
            const defaultMode = systemColorScheme === 'light' ? 'light' : 'dark';
            newPrefs.theme = data.global?.theme || [defaultMode, 'red'];
            prefsNeedSave = true;
        }

        // 2. Фіксуємо розклад (Беремо останньо змінений, інакше з шаблону)
        if (!newPrefs.currentScheduleId) {
            if (data.schedules && data.schedules.length > 0) {
                // Шукаємо останньо змінений розклад
                const sorted = [...data.schedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
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
  }, [data, isLoading, guest, cloudSyncState, user, systemColorScheme]); // 🔥 Додано systemColorScheme в залежності

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentlyOnline = !!state.isConnected;
      setIsOnline(currentlyOnline);
      isOnlineRef.current = currentlyOnline;

      if (!currentlyOnline) {
         setCloudSyncState('offline');
         disableNetwork(db).catch(() => {}); 
      } else if (currentlyOnline && !prevOnlineRef.current && user && !guest) {
         setCloudSyncState('syncing');
         enableNetwork(db).catch(() => {}); 
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
      (cloudError) => {}
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

  // Зливаємо дані: локальні преференції ПЕРЕЗАПИСУЮТЬ хмарні для цього пристрою
  const mergedGlobal = useMemo(() => {
    if (!data?.global) return null;
    return {
      ...data.global,
      ...(devicePrefs.theme ? { theme: devicePrefs.theme } : {}),
      ...(devicePrefs.currentScheduleId ? { currentScheduleId: devicePrefs.currentScheduleId } : {})
    };
  }, [data?.global, devicePrefs]);

  const currentScheduleId = mergedGlobal?.currentScheduleId || null;

  const schedule = useMemo(() => {
    if (!data?.schedules?.length) return null;
    return (currentScheduleId 
      ? data.schedules.find((s) => s.id === currentScheduleId) 
      : null) || data.schedules[0];
  }, [data, currentScheduleId]);

  // Захист, якщо обраний розклад видалили
  useEffect(() => {
    if (!data?.schedules?.length) return;
    const exists = data.schedules.some((s) => s.id === currentScheduleId);
    if (!exists && currentScheduleId) {
      // Перемикаємо на останньо змінений розклад
      const sorted = [...data.schedules].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      const fallbackId = sorted[0].id;
      
      const newPrefs = { ...devicePrefsRef.current, currentScheduleId: fallbackId };
      setDevicePrefs(newPrefs);
      saveDevicePrefs(newPrefs, user?.uid);

      setData((prev) => ({
        ...prev,
        global: { 
          ...(prev?.global || {}), 
          currentScheduleId: fallbackId,
          lastModified: Date.now() 
        },
      }));
      if (!guest) setIsDirty(true);
    }
  }, [data?.schedules, currentScheduleId, guest, user]);

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

  // Записуємо і в налаштування пристрою, І В ХМАРУ (як шаблон)
  const setGlobalDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;

      // Спочатку формуємо поточний стан як його бачить користувач
      const currentMerged = {
        ...prev.global,
        ...(devicePrefsRef.current.theme ? { theme: devicePrefsRef.current.theme } : {}),
        ...(devicePrefsRef.current.currentScheduleId ? { currentScheduleId: devicePrefsRef.current.currentScheduleId } : {})
      };

      const nextGlobal = typeof updater === "function" ? updater(currentMerged) : updater;
      
      const newPrefs = { ...devicePrefsRef.current };
      let prefsChanged = false;

      // Якщо користувач змінив тему - запам'ятовуємо для цього пристрою
      if (nextGlobal.theme && JSON.stringify(nextGlobal.theme) !== JSON.stringify(currentMerged.theme)) {
        newPrefs.theme = nextGlobal.theme;
        prefsChanged = true;
      }
      // Якщо змінив розклад - запам'ятовуємо для цього пристрою
      if (nextGlobal.currentScheduleId && nextGlobal.currentScheduleId !== currentMerged.currentScheduleId) {
        newPrefs.currentScheduleId = nextGlobal.currentScheduleId;
        prefsChanged = true;
      }

      if (prefsChanged) {
        setDevicePrefs(newPrefs);
        saveDevicePrefs(newPrefs, user?.uid);
      }

      // ТАКОЖ оновлюємо prev.global, щоб цей "шаблон" відправився в хмару
      return { ...prev, global: { ...prev.global, ...nextGlobal, lastModified: Date.now() } };
    });
    
    // Ставимо прапорець, що є зміни для відправки в Firebase
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

  const saveNow = useCallback(async (force = false) => {
    if (cloudSyncState === 'syncing' || guest || !dataRef.current || isSaving || conflictQueue.length > 0) return;
    if (!isDirty && force !== true) return; 
    
    setIsSaving(true);
    setIsCloudSaving(true);

    const online = await checkIsOnline();
    if (!online) {
      setIsSaving(false);
      setIsCloudSaving(false);
      return; 
    }

    try {
      const latestCloud = await getScheduleFromServer(user.uid);
      
      if (latestCloud) {
         const { conflicts } = resolveSyncConflict(dataRef.current, latestCloud);
         if (conflicts.length > 0) {
            setConflictQueue(conflicts);
            setIsSaving(false);
            setIsCloudSaving(false);
            return; 
         }
      }

      const now = Date.now();
      const prev = dataRef.current;

      const dataToSave = {
        ...prev,
        global: {
          ...(prev?.global || {}),
          lastSynced: (prev.global?.lastModified || 0) > (prev.global?.lastSynced || 0) ? now : prev.global?.lastSynced
        },
        schedules: prev.schedules.map(s => {
          const isModified = (s.lastModified || 0) > (s.lastSynced || 0);
          if (isModified || force) {
            const nextVer = (s.version || 1) + 1;
            return { ...s, version: nextVer, baseVersion: nextVer, lastSynced: now };
          }
          return s;
        })
      };
      
      await saveSchedule(user.uid, dataToSave);
      
      const nextSchedules = prev.schedules.map(pSch => {
        const savedSch = dataToSave.schedules.find(s => s.id === pSch.id);
        if (savedSch && pSch.lastModified === savedSch.lastModified) {
          return { ...pSch, version: savedSch.version, baseVersion: savedSch.baseVersion, lastSynced: savedSch.lastSynced };
        }
        return pSch;
      });

      const nextGlobal = prev.global?.lastModified === dataToSave.global.lastModified
        ? { ...prev.global, lastSynced: dataToSave.global.lastSynced }
        : prev.global;

      const finalDataToLocal = { ...prev, global: nextGlobal, schedules: nextSchedules };

      await saveLocalSchedule(finalDataToLocal, user.uid);
      setData(finalDataToLocal);

      setIsDirty(false);

    } catch (e) {
      setError(e?.message || "Помилка збереження");
    } finally {
      setIsSaving(false);
      setIsCloudSaving(false);
    }
  }, [user, isSaving, isDirty, guest, conflictQueue.length, cloudSyncState]);

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
      setError(e?.message || "Помилка оновлення розкладу");
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
      const newData = { global: currentGlobal, schedules: createDefaultData().schedules };
      
      setDevicePrefs({});
      await saveDevicePrefs({}, user?.uid);

      setData(newData);
      if (user) {
        await resetUserSchedules(user.uid);
        await saveSchedule(user.uid, newData);
        await saveLocalSchedule(newData, user.uid);
      } else {
        await saveLocalSchedule(newData, null);
      }
      setIsDirty(false);
    } catch (e) {
      setError("Не вдалося скинути розклади");
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
        name: `${currentConflict.local.name || "Без назви"} (Копія)`, 
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
    global: mergedGlobal, // Віддаємо мердж!
    schedules: data?.schedules || [],
    setData, setScheduleDraft, setGlobalDraft, addSchedule, saveNow,
    reloadAllSchedules, resetApplication, isDirty, isSaving, isCloudSaving,
    isLoading, error, isOnline,
    conflictQueue, handleResolveConflict,
    cloudSyncState
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
      <SyncConflictScreen />
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};
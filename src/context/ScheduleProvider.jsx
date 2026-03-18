import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { v4 as uuidv4 } from 'uuid'; 
import { enableNetwork, disableNetwork } from "firebase/firestore"; // 🔥 ДОДАНО: Інструменти для миттєвого пробудження
import { db } from "../../firebase"; // 🔥 ДОДАНО: Доступ до бази
import { saveSchedule, resetUserSchedules, subscribeToSchedule, getScheduleFromServer } from "../../firestore"; 
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
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

  // 🔥 1. ВІДСТЕЖУЄМО ІНТЕРНЕТ (Ідеальна інтеграція з Firebase)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const currentlyOnline = !!state.isConnected;
      setIsOnline(currentlyOnline);
      isOnlineRef.current = currentlyOnline;

      if (!currentlyOnline) {
         setCloudSyncState('offline');
         // Миттєво переводимо Firebase в офлайн-режим (щоб не чекав тайм-аутів)
         disableNetwork(db).catch(() => {}); 
      } else if (currentlyOnline && !prevOnlineRef.current && user && !guest) {
         setCloudSyncState('syncing');
         // 🔥 МИТТЄВО будимо Firebase! Це прибирає 5 секунд затримки
         enableNetwork(db).catch(() => {}); 
      }
      prevOnlineRef.current = currentlyOnline;
    });
    return () => unsubscribe();
  }, [user, guest]);

  // 🔥 2. СЛУХАЧ FIREBASE (Більше ніяких перезапусків!)
  useEffect(() => {
    let unsubscribeCloud = null;
    if (guest || !user) return;

    // Слухач створюється лише ОДИН РАЗ. Коли інтернет з'являється, 
    // він автоматично і миттєво відправить сюди нові дані.
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
  }, [guest, user]); // Прибрали reconnectCounter!

  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalSchedule(data, user?.uid || null);
    }, 500); 
    return () => clearTimeout(timeoutId);
  }, [data, isLoading, user]);

  const currentScheduleId = data?.global?.currentScheduleId || null;

  const schedule = useMemo(() => {
    if (!data?.schedules?.length) return null;
    return (currentScheduleId 
      ? data.schedules.find((s) => s.id === currentScheduleId) 
      : null) || data.schedules[0];
  }, [data, currentScheduleId]);

  const global = data?.global || null;

  useEffect(() => {
    if (!data?.schedules?.length) return;
    const exists = data.schedules.some((s) => s.id === currentScheduleId);
    if (!exists) {
      setData((prev) => ({
        ...prev,
        global: { 
          ...(prev?.global || {}), 
          currentScheduleId: data.schedules[0].id,
          lastModified: Date.now() 
        },
      }));
      if (!guest) setIsDirty(true);
    }
  }, [data, currentScheduleId, guest]);

  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const currentId = prev?.global?.currentScheduleId;
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
      const nextGlobal = typeof updater === "function" ? updater(prev.global) : updater;
      return { ...prev, global: { ...nextGlobal, lastModified: Date.now() } };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

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

  // Ручне оновлення кнопкою
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
    user, guest, schedule, global, schedules: data?.schedules || [],
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
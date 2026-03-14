import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AppState, View, Text, Pressable, StyleSheet } from "react-native";
import { getSchedule, saveSchedule, resetUserSchedules, subscribeToSchedule } from "../../firestore";
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";

const ScheduleContext = createContext(null);

// Швидка і надійна перевірка інтернету без проблем з CORS на Web
const checkIsOnline = async () => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    await fetch('https://www.google.com/favicon.ico?_=' + new Date().getTime(), { 
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
  (cloudData.schedules || []).forEach(s => cloudMap.set(s.id, s));

  (localData.schedules || []).forEach(localSch => {
    const cloudSch = cloudMap.get(localSch.id);

    if (!cloudSch) {
      mergedSchedulesMap.set(localSch.id, localSch);
      needsPushToCloud = true;
    } else {
      if (localSch.lastModified === cloudSch.lastModified) {
        mergedSchedulesMap.set(cloudSch.id, cloudSch);
      } else {
        const isLocalDirty = (localSch.lastModified || 0) > (localSch.lastSynced || 0);

        if (isLocalDirty) {
          const localBase = localSch.baseVersion || 1;
          const cloudVer = cloudSch.version || 1;

          if (cloudVer > localBase) {
            // КОНФЛІКТ: Локально змінено, але на сервері вже є новіша версія
            conflicts.push({ local: localSch, cloud: cloudSch });
            mergedSchedulesMap.set(localSch.id, localSch); 
          } else {
            // Наші зміни найновіші, відправляємо в хмару
            mergedSchedulesMap.set(localSch.id, localSch);
            needsPushToCloud = true;
          }
        } else {
          // Ми нічого не міняли, просто завантажуємо зміни з іншого пристрою
          mergedSchedulesMap.set(cloudSch.id, cloudSch);
        }
      }
    }
  });

  (cloudData.schedules || []).forEach(cloudSch => {
    if (!mergedSchedulesMap.has(cloudSch.id)) {
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [conflictQueue, setConflictQueue] = useState([]);

  // Завжди маємо доступ до свіжого стейту
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let unsubscribeCloud = null;

    const load = async () => {
      setIsLoading(true);
      try {
        if (guest) {
          const local = await getLocalSchedule(null);
          setData(local || createDefaultData());
          setIsLoading(false);
        } else if (user) {
          const local = await getLocalSchedule(user.uid);
          if (local) setData(local);

          unsubscribeCloud = subscribeToSchedule(
            user.uid,
            async (fetchedCloudData) => {
              const currentLocal = dataRef.current || await getLocalSchedule(user.uid);
              
              if (!currentLocal) {
                setData(fetchedCloudData);
                await saveLocalSchedule(fetchedCloudData, user.uid);
                setIsLoading(false);
                return;
              }

              const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(currentLocal, fetchedCloudData);
              
              setData(mergedData);
              await saveLocalSchedule(mergedData, user.uid); 
              
              if (conflicts.length > 0) {
                setConflictQueue(conflicts);
              }

              if (needsPushToCloud) setIsDirty(true);
              
              setIsLoading(false);
            },
            (cloudError) => {
              console.warn("Помилка хмари. Працюємо офлайн.", cloudError);
              if (!local) setData(createDefaultData());
              setIsLoading(false);
            }
          );
        } else {
          setData(null);
          setIsLoading(false);
        }
        setError(null);
      } catch (e) {
        setError(e?.message || "Помилка завантаження");
        setIsLoading(false);
      }
    };
    
    load();

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, [guest, user]);

  // НАДІЙНЕ АВТОЗБЕРЕЖЕННЯ КОЖНОЇ ЛОКАЛЬНОЇ ЗМІНИ
  useEffect(() => {
    if (!data || isLoading) return;
    const timeoutId = setTimeout(() => {
      saveLocalSchedule(data, user?.uid || null);
    }, 500); // Зменшено до 500мс для моментальної реакції
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

  const saveNow = useCallback(async () => {
    if (guest || !dataRef.current || isSaving || !isDirty || conflictQueue.length > 0) return;
    
    setIsSaving(true);
    setIsCloudSaving(true);

    const online = await checkIsOnline();
    if (!online) {
      setIsSaving(false);
      setIsCloudSaving(false);
      return; 
    }

    try {
      // PRE-FLIGHT CHECK: Завантажуємо свіжі дані з хмари перед записом, щоб не затерти чужі зміни
      const latestCloud = await getSchedule(user.uid);
      if (latestCloud) {
         const { conflicts } = resolveSyncConflict(dataRef.current, latestCloud);
         if (conflicts.length > 0) {
            setConflictQueue(conflicts); // Знайшли конфлікт!
            setIsSaving(false);
            setIsCloudSaving(false);
            return; // ЗУПИНЯЄМО збереження і чекаємо рішення юзера
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
          if (isModified) {
            const nextVer = (s.version || 1) + 1;
            return { ...s, version: nextVer, baseVersion: nextVer, lastSynced: now };
          }
          return s;
        })
      };
      
      await saveSchedule(user.uid, dataToSave);
      
      // ГАРАНТОВАНЕ СИНХРОННЕ ОБЧИСЛЕННЯ:
      const nextSchedules = prev.schedules.map(pSch => {
        const savedSch = dataToSave.schedules.find(s => s.id === pSch.id);
        if (savedSch && pSch.lastModified === savedSch.lastModified) {
          return { ...pSch, version: savedSch.version, baseVersion: savedSch.baseVersion, lastSynced: savedSch.lastSynced };
        }
        return pSch;
      });

      const nextGlobal = prev.global?.lastModified === prev.global?.lastModified
         ? { ...prev.global, lastSynced: dataToSave.global.lastSynced }
         : prev.global;

      const finalDataToLocal = { ...prev, global: nextGlobal, schedules: nextSchedules };

      // ГАРАНТОВАНЕ збереження в локальну пам'ять найсвіжіших версій!
      await saveLocalSchedule(finalDataToLocal, user.uid);
      setData(finalDataToLocal);

      const isFullySaved = finalDataToLocal.schedules.every(cSch => {
         const savedSch = dataToSave.schedules.find(s => s.id === cSch.id);
         return savedSch && cSch.lastModified === savedSch.lastModified;
      }) && finalDataToLocal.global?.lastModified === prev.global?.lastModified;

      if (isFullySaved) {
         setIsDirty(false);
      }

    } catch (e) {
      setError(e?.message || "Помилка збереження");
    } finally {
      setIsSaving(false);
      setIsCloudSaving(false);
    }
  }, [user, isSaving, isDirty, guest, conflictQueue.length]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isDirty) saveNow();
      }
    });
    return () => subscription.remove();
  }, [isDirty, saveNow]);

  const reloadAllSchedules = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (guest) {
        const local = await getLocalSchedule(null);
        setData(local || createDefaultData());
      } else if (user) {
        const fetchedData = await getSchedule(user.uid);
        const localData = dataRef.current || await getLocalSchedule(user.uid);
        if (fetchedData) {
           const { mergedData, needsPushToCloud, conflicts } = resolveSyncConflict(localData, fetchedData);
           setData(mergedData);
           await saveLocalSchedule(mergedData, user.uid);
           
           if (conflicts.length > 0) setConflictQueue(conflicts);
           if (needsPushToCloud) setIsDirty(true);
        }
      }
      setError(null);
    } catch (e) {
      setError(e?.message || "Помилка оновлення розкладу");
    } finally {
      setIsRefreshing(false);
    }
  }, [guest, user]);

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

  const handleResolveConflict = (keepLocal) => {
    const currentConflict = conflictQueue[0];
    
    // Вирішуємо конфлікт і ОДРАЗУ зберігаємо в локальну пам'ять
    const prev = dataRef.current;
    const nextSchedules = prev.schedules.map(s => {
      if (s.id === currentConflict.local.id) {
        if (keepLocal) {
          return { 
            ...currentConflict.local, 
            baseVersion: currentConflict.cloud.version,
            lastModified: Date.now() 
          };
        } else {
          return currentConflict.cloud;
        }
      }
      return s;
    });
    
    const updatedData = { ...prev, schedules: nextSchedules };
    
    setData(updatedData);
    saveLocalSchedule(updatedData, user?.uid || null); // ГАРАНТІЯ ЗБЕРЕЖЕННЯ ВИБОРУ
    
    setConflictQueue(prevQ => prevQ.slice(1));
    if (keepLocal && !guest) setIsDirty(true);
  };

  const value = {
    user, guest, schedule, global, schedules: data?.schedules || [],
    setData, setScheduleDraft, setGlobalDraft, addSchedule, saveNow,
    reloadAllSchedules, resetApplication, isDirty, isSaving, isCloudSaving,
    isLoading, isRefreshing, error,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
      
      {conflictQueue.length > 0 && (
        <View style={styles.conflictOverlay}>
          <View style={styles.conflictBox}>
            <Text style={styles.conflictTitle}>⚠️ Конфлікт синхронізації</Text>
            <Text style={styles.conflictDesc}>
              Розклад <Text style={{fontWeight: 'bold'}}>"{conflictQueue[0].local.title || "Без назви"}"</Text> був змінений на іншому пристрої, поки ви були офлайн. Що хочете зробити?
            </Text>
            
            <Pressable style={[styles.conflictBtn, styles.btnLocal]} onPress={() => handleResolveConflict(true)}>
              <Text style={styles.btnLocalText}>Залишити мою версію (Перезаписати хмару)</Text>
            </Pressable>
            
            <Pressable style={[styles.conflictBtn, styles.btnCloud]} onPress={() => handleResolveConflict(false)}>
              <Text style={styles.btnCloudText}>Завантажити з хмари (Втратити мої зміни)</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};

const styles = StyleSheet.create({
  conflictOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  conflictBox: {
    backgroundColor: '#1C1C1E',
    width: '85%',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  conflictTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF4D4D',
    marginBottom: 12,
  },
  conflictDesc: {
    fontSize: 15,
    color: '#EBEBF5',
    marginBottom: 24,
    lineHeight: 22,
  },
  conflictBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  btnLocal: {
    backgroundColor: '#32D74B', 
  },
  btnLocalText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  btnCloud: {
    backgroundColor: '#3A3A3C',
  },
  btnCloudText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  }
});
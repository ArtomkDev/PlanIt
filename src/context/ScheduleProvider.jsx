import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AppState } from "react-native";
import { getSchedule, saveSchedule, resetUserSchedules } from "../../firestore";
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children, guest = false, user = null }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (guest) {
          const local = await getLocalSchedule();
          setData(local || createDefaultData());
        } else if (user) {
          const fetched = await getSchedule(user.uid);
          setData(fetched);
        } else {
          setData(null);
        }
        setError(null);
      } catch (e) {
        setError(e?.message || "Помилка завантаження розкладу");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [guest, user]);

  useEffect(() => {
    if (!guest || !data || isLoading) return;
    
    const timeoutId = setTimeout(async () => {
      await saveLocalSchedule(data);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [data, guest, isLoading]);

  const currentScheduleId = data?.global?.currentScheduleId || null;

  const schedule = useMemo(() => {
    if (!data?.schedules?.length) return null;
    const found = currentScheduleId
      ? data.schedules.find((s) => s.id === currentScheduleId)
      : null;
    return found || data.schedules[0];
  }, [data, currentScheduleId]);

  const global = data?.global || null;

  useEffect(() => {
    if (!data?.schedules?.length) return;
    const exists = data.schedules.some((s) => s.id === currentScheduleId);
    if (!exists) {
      const firstId = data.schedules[0].id;
      setData((prev) => ({
        ...prev,
        global: { ...(prev?.global || {}), currentScheduleId: firstId },
      }));
      if (!guest) setIsDirty(true);
    }
  }, [data, currentScheduleId, guest]);

  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const currentId = prev?.global?.currentScheduleId;
      if (!currentId) return prev;
      const nextSchedules = prev.schedules.map((s) =>
        s.id === currentId ? (typeof updater === "function" ? updater(s) : updater) : s
      );
      return { ...prev, schedules: nextSchedules };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  const setGlobalDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextGlobal = typeof updater === "function" ? updater(prev.global) : updater;
      return { ...prev, global: nextGlobal };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  const addSchedule = useCallback((scheduleObj) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextSchedules = [...(prev.schedules || []), scheduleObj];
      return { ...prev, schedules: nextSchedules };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  const saveNow = useCallback(async () => {
    if (guest || !data || isSaving || !isDirty) return;
    
    const currentDataSnapshot = data;
    
    setIsSaving(true);
    setIsCloudSaving(true);
    
    try {
      await saveSchedule(user.uid, currentDataSnapshot);
      
      setData(prev => {
        if (prev === currentDataSnapshot) {
          setIsDirty(false);
        }
        return prev;
      });
    } catch (e) {
      setError(e?.message || "Помилка збереження");
    } finally {
      setIsSaving(false);
      setIsCloudSaving(false);
    }
  }, [user, data, isSaving, isDirty, guest]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isDirty) {
          saveNow();
        }
      }
    });
    return () => subscription.remove();
  }, [isDirty, saveNow]);

  const reloadAllSchedules = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (guest) {
        const local = await getLocalSchedule();
        setData(local || createDefaultData());
      } else if (user) {
        const fetchedData = await getSchedule(user.uid);
        setData(fetchedData);
      }
      setIsDirty(false);
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
      const currentGlobal = data?.global || createDefaultData().global;

      if (user) {
        await resetUserSchedules(user.uid);
      }

      const defaultData = createDefaultData();
      const newData = {
          global: currentGlobal,
          schedules: defaultData.schedules
      };

      setData(newData);

      if (user) {
        await saveSchedule(user.uid, newData);
      } else {
        await saveLocalSchedule(newData);
      }

      setIsDirty(false);
    } catch (e) {
      setError("Не вдалося скинути розклади");
    } finally {
      setIsLoading(false);
    }
  }, [user, data]);

  const value = {
    user,
    guest,
    schedule,
    global,
    schedules: data?.schedules || [],
    setData,
    setScheduleDraft,
    setGlobalDraft,
    addSchedule,
    saveNow,
    reloadAllSchedules,
    resetApplication,
    isDirty,
    isSaving,
    isCloudSaving,
    isLoading,
    isRefreshing,
    error,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};
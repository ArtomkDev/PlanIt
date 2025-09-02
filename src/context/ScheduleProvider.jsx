import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  getSchedule as fetchSchedule,
  saveSchedule as persistSchedule,
} from "../../firestore";
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children, guest = false, user = null }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // завантаження даних
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (guest) {
          const local = await getLocalSchedule();
          if (local) {
            setData(local);
          } else {
            const def = createDefaultData();
            setData(def);
            await saveLocalSchedule(def);
          }
        } else if (user) {
          const fetched = await fetchSchedule(user.uid);
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

  // ------------------ SELECTORS ------------------
  const currentScheduleId = data?.global?.currentScheduleId || null;

  const schedule = useMemo(() => {
    if (!data || !currentScheduleId || !Array.isArray(data.schedules)) return null;
    return data.schedules.find((s) => s.id === currentScheduleId) || null;
  }, [data, currentScheduleId]);

  const global = data?.global || null;

  // ------------------ ОНОВЛЕННЯ ------------------
  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextSchedules = prev.schedules.map((s) =>
        s.id === prev.global.currentScheduleId
          ? typeof updater === "function" ? updater(s) : updater
          : s
      );
      return { ...prev, schedules: nextSchedules };
    });
    setIsDirty(true);
  }, []);

  const setGlobalDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextGlobal =
        typeof updater === "function" ? updater(prev.global) : updater;
      return { ...prev, global: nextGlobal };
    });
    setIsDirty(true);
  }, []);

  const addSchedule = useCallback((schedule) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextSchedules = [...(prev.schedules || []), schedule];
      return { ...prev, schedules: nextSchedules };
    });
    setIsDirty(true);
  }, []);

  // ------------------ ЗБЕРЕЖЕННЯ ------------------
  const saveNow = useCallback(async () => {
    if (!data || isSaving || !isDirty) return;
    setIsSaving(true);
    if (user) setIsCloudSaving(true);

    try {
      if (guest) {
        await saveLocalSchedule(data);
      } else if (user) {
        await persistSchedule(user.uid, data);
      }
      setIsDirty(false);
    } catch (e) {
      setError(e?.message || "Помилка збереження розкладу");
      throw e;
    } finally {
      setIsSaving(false);
      if (user) setIsCloudSaving(false);
    }
  }, [guest, user, data, isSaving, isDirty]);

  const reloadAllSchedules = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (guest) {
        const local = await getLocalSchedule();
        setData(local || createDefaultData());
      } else if (user) {
        const fetchedData = await fetchSchedule(user.uid);
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

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  // ------------------ VALUE ------------------
  const value = {
    user,
    guest,
    schedule,
    global,
    schedules: data?.schedules || [],
    setScheduleDraft,
    setGlobalDraft,
    addSchedule,
    saveNow,
    reloadAllSchedules,
    isDirty,
    isSaving,
    isCloudSaving,
    isLoading,
    isRefreshing,
    error,
    isEditing,
    toggleEditing,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};

// ------------------ ХУК ------------------
export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};

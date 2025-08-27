// src/context/ScheduleProvider.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { auth } from "../../firebase";
import {
  getSchedule as fetchSchedule,
  saveSchedule as persistSchedule,
} from "../../firestore";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null); // ВСІ дані з Firestore (але не віддаємо назовні)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // завантаження
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) {
        setData(null);
        setIsDirty(false);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const fetchedData = await fetchSchedule(u.uid);
        setData(fetchedData);
        setIsDirty(false);
        setError(null);
      } catch (e) {
        setError(e?.message || "Помилка завантаження розкладу");
      } finally {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const currentScheduleId = data?.global?.currentScheduleId || null;

  // активний розклад
  const schedule = useMemo(() => {
    if (!data || !currentScheduleId || !Array.isArray(data.schedules)) return null;
    return data.schedules.find((s) => s.id === currentScheduleId) || null;
  }, [data, currentScheduleId]);

  const global = data?.global || null;

  // оновлення тільки активного розкладу
  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextSchedules = prev.schedules.map((s) =>
        s.id === prev.global.currentScheduleId
          ? typeof updater === "function"
            ? updater(s)
            : updater
          : s
      );
      return { ...prev, schedules: nextSchedules };
    });
    setIsDirty(true);
  }, []);

  // оновлення global (напр. вибір іншого розкладу)
  const setGlobalDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextGlobal =
        typeof updater === "function" ? updater(prev.global) : updater;
      return { ...prev, global: nextGlobal };
    });
    setIsDirty(true);
  }, []);

  // збереження
  const saveNow = useCallback(async () => {
    if (!user || !data || isSaving || !isDirty) return;
    setIsSaving(true);
    try {
      await persistSchedule(user.uid, data);
      setIsDirty(false);
    } catch (e) {
      setError(e?.message || "Помилка збереження розкладу");
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [user, data, isSaving, isDirty]);

  const value = {
    user,
    schedule,       // поточний розклад
    global,         // глобальні налаштування (activeId, theme тощо)
    setScheduleDraft,
    setGlobalDraft,
    saveNow,
    isDirty,
    isSaving,
    isLoading,
    error,
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

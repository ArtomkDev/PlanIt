// src/context/ScheduleProvider.js
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { auth } from "../../firebase";
import { getSchedule as fetchSchedule, saveSchedule as persistSchedule } from "../../firestore";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);       // зберігаємо ВСІ дані з Firestore
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Авторизація + завантаження
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

  // ID активного розкладу
  const currentScheduleId = data?.global?.currentScheduleId || null;

  // Активний розклад = schedule (щоб старі компоненти працювали як раніше)
  const schedule = useMemo(() => {
    if (!data || !currentScheduleId || !Array.isArray(data.schedules)) return null;
    return data.schedules.find(s => s.id === currentScheduleId) || null;
  }, [data, currentScheduleId]);

  // Локальне оновлення даних
  const setScheduleDraft = useCallback((updater) => {
    setData(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setIsDirty(true);
  }, []);

  // Зберегти зараз
  const saveNow = useCallback(async () => {
    if (!user || !data || isSaving || !isDirty) return;
    setIsSaving(true);
    try {
      await persistSchedule(user.uid, data); // зберігаємо ВСІ дані (включно з schedules + global)
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
    data,          // всі дані (глобал + schedules)
    schedule,      // тільки активний розклад (для старих компонентів)
    setScheduleDraft,
    saveNow,
    isDirty,
    isSaving,
    isLoading,
    error,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};

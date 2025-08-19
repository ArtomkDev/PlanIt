// src/context/ScheduleProvider.js
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { auth } from "../../firebase";
import { getSchedule as fetchSchedule, saveSchedule as persistSchedule } from "../../firestore";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Авторизація + завантаження
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) {
        setSchedule(null);
        setIsDirty(false);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchSchedule(u.uid);
        setSchedule(data);
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

  // ✅ Локальне оновлення (без сейву)
  const setScheduleDraft = useCallback((updater) => {
    setSchedule(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
    setIsDirty(true);
  }, []);

  // ✅ Зберегти зараз (викликає Firebase/AsyncStorage)
  const saveNow = useCallback(async () => {
    if (!user || !schedule || isSaving || !isDirty) return; // захист від спаму
    setIsSaving(true);
    try {
      await persistSchedule(user.uid, schedule);
      setIsDirty(false);
    } catch (e) {
      setError(e?.message || "Помилка збереження розкладу");
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [user, schedule, isSaving, isDirty]);

  const value = {
    user,
    schedule,
    setScheduleDraft, // локально змінюємо
    saveNow,          // зберігаємо вручну або автосейвом
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

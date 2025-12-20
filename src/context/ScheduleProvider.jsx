import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AppState } from 'react-native';
// 🔥 ДОДАНО resetUserSchedules
import { getSchedule, saveSchedule, resetUserSchedules, saveLocalSchedule, getLocalSchedule } from "../../firestore";
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

  // ------------------ LOAD ------------------
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
        console.error("❌ Load error:", e);
        setError(e?.message || "Помилка завантаження розкладу");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [guest, user]);

  // ------------------ GUEST SAVE ------------------
  useEffect(() => {
    if (!guest || !data || isLoading) return;
    const saveGuestData = async () => {
      await saveLocalSchedule(data);
    };
    saveGuestData();
  }, [data, guest, isLoading]);

  // ------------------ SELECTORS ------------------
  const currentScheduleId = data?.global?.currentScheduleId || null;

  const schedule = useMemo(() => {
    if (!data?.schedules?.length) return null;
    const found = currentScheduleId
      ? data.schedules.find((s) => s.id === currentScheduleId)
      : null;
    return found || data.schedules[0];
  }, [data, currentScheduleId]);

  const global = data?.global || null;

  // ------------------ FIX INVALID ID ------------------
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

  // ------------------ UPDATERS ------------------
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

  const addSchedule = useCallback((schedule) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextSchedules = [...(prev.schedules || []), schedule];
      return { ...prev, schedules: nextSchedules };
    });
    if (!guest) setIsDirty(true);
  }, [guest]);

  // ------------------ SAVE (CLOUD) ------------------
  const saveNow = useCallback(async () => {
    if (guest || !data || isSaving || !isDirty) return;
    setIsSaving(true);
    setIsCloudSaving(true);
    try {
      await saveSchedule(user.uid, data);
      setIsDirty(false);
    } catch (e) {
      console.error("❌ Save error:", e);
      setError(e?.message || "Помилка збереження");
    } finally {
      setIsSaving(false);
      setIsCloudSaving(false);
    }
  }, [user, data, isSaving, isDirty, guest]);

  // ------------------ RELOAD ------------------
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
      console.error("❌ Refresh error:", e);
      setError(e?.message || "Помилка оновлення розкладу");
    } finally {
      setIsRefreshing(false);
    }
  }, [guest, user]);

  // 🔥 ОНОВЛЕНА ФУНКЦІЯ СКИДАННЯ
  const resetApplication = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Зберігаємо поточні налаштування (Global), щоб не видалити їх
      const currentGlobal = data?.global || createDefaultData().global;

      // 2. Очищаємо лише розклади в хмарі
      if (user) {
        await resetUserSchedules(user.uid);
      }

      // 3. Генеруємо нові дефолтні дані (там є новий розклад)
      const defaultData = createDefaultData();

      // 4. Об'єднуємо: Старий Global + Нові Schedules
      const newData = {
          global: currentGlobal,
          schedules: defaultData.schedules
      };

      // 5. Оновлюємо стан додатка
      setData(newData);

      // 6. Зберігаємо новий розклад в БД (Global просто перезапишеться тим самим, це безпечно)
      if (user) {
        await saveSchedule(user.uid, newData);
      } else {
        await saveLocalSchedule(newData);
      }

      setIsDirty(false);
      console.log("✅ Schedules reset successful. Settings preserved.");

    } catch (e) {
      console.error("❌ Reset Error:", e);
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
    resetApplication, // 🔥 Експортуємо нову функцію
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
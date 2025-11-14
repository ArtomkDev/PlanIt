import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AppState } from 'react-native';
import { getSchedule, saveSchedule } from "../../firestore";
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children, guest = false, user = null }) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false); // Тільки для хмари
  const [isSaving, setIsSaving] = useState(false); // Тільки для хмари
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

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

  // ------------------ GUEST MODE: миттєве збереження ------------------
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

  // ------------------ FIX INVALID currentScheduleId ------------------
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

  // ------------------ UPDATE ------------------
  const setScheduleDraft = useCallback((updater) => {
    setData((prev) => {
      if (!prev) return prev;
      const currentId = prev?.global?.currentScheduleId;
      if (!currentId) return prev;

      const nextSchedules = prev.schedules.map((s) =>
        s.id === currentId
          ? typeof updater === "function"
            ? updater(s)
            : updater
          : s
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

  // ------------------ SAVE (тільки для хмари) ------------------
  const saveNow = useCallback(async () => {
    if (guest || !data || isSaving || !isDirty) return;
    setIsSaving(true);
    setIsCloudSaving(true);
    try {
      await saveSchedule(user.uid, data);
      setIsDirty(false);
    } catch (e) {
      console.error("❌ Save error:", e);
      setError(e?.message || "Помилка збереження розкладу");
      throw e;
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

  // ------------------ VALUE ------------------
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

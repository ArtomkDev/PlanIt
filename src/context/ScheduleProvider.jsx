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
} from "../../firestore"; // тепер працює з users/{userId}
import { getLocalSchedule, saveLocalSchedule } from "../utils/storage";
import createDefaultData from "../config/createDefaultData";
import { createDefaultTeacher, createDefaultSubject, createDefaultLink, createDefaultStatus, createDefaultGradient } from "../config/createDefaults";
import useUniqueId from "../hooks/useUniqueId";


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

  // ------------------ ЗАВАНТАЖЕННЯ ------------------
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
        console.error("❌ Помилка завантаження:", e);
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
    if (!data || !Array.isArray(data.schedules) || data.schedules.length === 0) {
      return null;
    }

    const currentId = data?.global?.currentScheduleId;
    const found = currentId ? data.schedules.find((s) => s.id === currentId) : null;

    return found || data.schedules[0];
  }, [data]);

  const global = data?.global || null;

  // ------------------ АВТОФІКС GLOBAL.currentScheduleId ------------------
  useEffect(() => {
    if (!data || !Array.isArray(data.schedules) || data.schedules.length === 0) return;

    const currentId = data?.global?.currentScheduleId;
    const exists = currentId && data.schedules.some((s) => s.id === currentId);

    if (!exists) {
      const firstId = data.schedules[0].id;
      setData((prev) => ({
        ...prev,
        global: { ...(prev?.global || {}), currentScheduleId: firstId },
      }));
      setIsDirty(true);
    }
  }, [data]);

  // ------------------ ОНОВЛЕННЯ ------------------
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
      console.error("❌ Помилка збереження:", e);
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
      console.error("❌ Помилка оновлення:", e);
      setError(e?.message || "Помилка оновлення розкладу");
    } finally {
      setIsRefreshing(false);
    }
  }, [guest, user]);

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);


  const generateId = useUniqueId();

// ------------------ ДОДАВАННЯ ------------------
const addItem = useCallback((key, factory) => {
  const newItem = factory(generateId);
  setScheduleDraft((prev) => ({
    ...prev,
    [key]: [...(prev[key] || []), newItem],
  }));
  return newItem;
}, [generateId, setScheduleDraft]);

// конкретні зручні функції
const addTeacher  = useCallback(() => addItem("teachers", createDefaultTeacher), [addItem]);
const addSubject  = useCallback(() => addItem("subjects", createDefaultSubject), [addItem]);
const addLink     = useCallback(() => addItem("links", createDefaultLink), [addItem]);
const addStatus   = useCallback(() => addItem("statuses", createDefaultStatus), [addItem]);
const addGradient = useCallback(() => addItem("gradients", createDefaultGradient), [addItem]);


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
    addTeacher,
    addSubject,
    addLink,
    addStatus,
    addGradient,
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

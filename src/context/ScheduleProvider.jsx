// src/context/ScheduleProvider.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../../firebase";
import {
  getSchedule as fetchSchedule,
  saveSchedule as persistSchedule,
} from "../../firestore";
import createDefaultData from "../config/createDefaultData";

const ScheduleContext = createContext(null);

// ------------------ ЛОКАЛЬНІ ХЕЛПЕРИ ------------------

const LOCAL_KEY = "guest_schedule";

async function getLocalSchedule() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Помилка читання локального розкладу", e);
    return null;
  }
}

async function saveLocalSchedule(data) {
  try {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Помилка збереження локального розкладу", e);
  }
}

// ------------------ ПРОВАЙДЕР ------------------

export const ScheduleProvider = ({ children, guest = false, user: externalUser = null }) => {
  const [user, setUser] = useState(externalUser);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // слухаємо Firebase тільки якщо не гість
  useEffect(() => {
    if (guest) {
      setUser(null);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return unsubscribe;
  }, [guest]);

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

  // автозбереження через 1 сек після змін
  useEffect(() => {
    if (!isDirty) return;
    const timeout = setTimeout(() => {
      saveNow();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isDirty, saveNow]);

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

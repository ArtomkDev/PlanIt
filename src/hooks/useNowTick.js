import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

const NowTickContext = createContext(null);
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  if (!date) return null;
  const normalized = new Date(date);
  if (Number.isNaN(normalized.getTime())) return null;
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const isTimerRelevantDate = (targetDate, nowValue = new Date()) => {
  const target = startOfDay(targetDate);
  const today = startOfDay(nowValue);
  if (!target || !today) return false;

  const diffDays = Math.round((today.getTime() - target.getTime()) / DAY_MS);
  return diffDays === 0 || diffDays === 1;
};

const createNowTickStore = () => {
  let nowMs = Date.now();
  let activeDay = 0;
  let intervalId = null;
  const listeners = new Set();

  const notify = () => {
    nowMs = Date.now();
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => nowMs,
    getActiveDay: () => activeDay,
    // The active day lives in the store rather than in context, so moving between
    // days re-renders only the consumers whose timer turns on or off.
    setActiveDay: (day) => {
      if (day === activeDay) return;
      activeDay = day;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      if (intervalId) return;
      notify();
      intervalId = setInterval(notify, 1000);
    },
    stop: () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    },
  };
};

export function NowTickProvider({ activeDate, enabled = true, children }) {
  const storeRef = useRef(null);
  const [appActive, setAppActive] = useState(() => (
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
  ));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  if (!storeRef.current) {
    storeRef.current = createNowTickStore();
  }

  const activeDay = isTimerRelevantDate(activeDate) ? startOfDay(activeDate)?.getTime() : 0;
  const shouldRun = enabled && appActive && activeDay !== 0;

  useLayoutEffect(() => {
    storeRef.current.setActiveDay(activeDay);
  }, [activeDay]);

  useEffect(() => {
    const store = storeRef.current;

    if (shouldRun) {
      store.start();
    } else {
      store.stop();
    }

    return () => {
      store.stop();
    };
  }, [shouldRun]);

  const contextValue = useMemo(() => ({ store: storeRef.current }), []);

  return (
    <NowTickContext.Provider value={contextValue}>
      {children}
    </NowTickContext.Provider>
  );
}

export function useNowTick(targetDate, enabled = true, precisionMs = 1000) {
  const store = useContext(NowTickContext)?.store;
  const targetDay = startOfDay(targetDate)?.getTime() ?? 0;
  const shouldSubscribe = !!store && !!enabled && targetDay !== 0;

  const subscribe = useMemo(() => {
    if (!shouldSubscribe) return () => () => {};
    return (listener) => store.subscribe(listener);
  }, [shouldSubscribe, store]);

  // The provider only activates a day that is timer-relevant, so matching it is enough.
  const getSnapshot = useMemo(() => {
    if (!shouldSubscribe) return () => 0;
    return () => (store.getActiveDay() === targetDay
      ? Math.floor(store.getSnapshot() / precisionMs) * precisionMs
      : 0);
  }, [shouldSubscribe, store, targetDay, precisionMs]);

  const nowMs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return nowMs ? new Date(nowMs) : null;
}

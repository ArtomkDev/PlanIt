import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

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
  let intervalId = null;
  const listeners = new Set();

  const notify = () => {
    nowMs = Date.now();
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => nowMs,
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

export function NowTickProvider({ activeDate, children }) {
  const storeRef = useRef(null);

  if (!storeRef.current) {
    storeRef.current = createNowTickStore();
  }

  const activeDateTime = activeDate ? new Date(activeDate).getTime() : 0;
  const shouldRun = useMemo(
    () => isTimerRelevantDate(activeDate),
    [activeDateTime]
  );

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

  const contextValue = useMemo(() => ({
    store: storeRef.current,
    activeDate,
    isRunning: shouldRun,
  }), [activeDateTime, shouldRun]);

  return (
    <NowTickContext.Provider value={contextValue}>
      {children}
    </NowTickContext.Provider>
  );
}

export function useNowTick(targetDate, enabled = true) {
  const context = useContext(NowTickContext);
  const store = context?.store;
  const targetDateTime = targetDate ? new Date(targetDate).getTime() : 0;
  const activeDateTime = context?.activeDate ? new Date(context.activeDate).getTime() : 0;
  const shouldSubscribe = (
    !!store &&
    !!enabled &&
    context?.isRunning &&
    isTimerRelevantDate(context.activeDate) &&
    isTimerRelevantDate(targetDate)
  );

  const subscribe = useMemo(() => {
    if (!shouldSubscribe) return () => () => {};
    return (listener) => store.subscribe(listener);
  }, [shouldSubscribe, store]);

  const getSnapshot = useMemo(() => {
    if (!shouldSubscribe) return () => 0;
    return () => store.getSnapshot();
  }, [shouldSubscribe, store, targetDateTime, activeDateTime]);

  const nowMs = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return shouldSubscribe && nowMs ? new Date(nowMs) : null;
}

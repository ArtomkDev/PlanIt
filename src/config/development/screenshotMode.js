import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Development builds only: callers load this module behind `__DEV__`, so release bundles never include it.
const STORAGE_KEY = 'planit.dev.screenshotMode';
// The countdown the first lesson of every day shows while the demo is on.
const DEMO_TIME_LEFT = '28:09';
const listeners = new Set();
let flags = { adsHidden: false, activeLesson: false };

const notify = () => listeners.forEach((listener) => listener());

AsyncStorage.getItem(STORAGE_KEY)
  .then((stored) => {
    if (!stored) return;
    flags = { ...flags, ...JSON.parse(stored) };
    notify();
  })
  .catch(() => {});

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => flags;

export function setScreenshotFlag(name, value) {
  flags = { ...flags, [name]: value };
  notify();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(flags)).catch(() => {});
}

export const useScreenshotFlags = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

export const useDevAdsHidden = () => useScreenshotFlags().adsHidden;

export const useDevActiveLessonTimeLeft = () => (useScreenshotFlags().activeLesson ? DEMO_TIME_LEFT : null);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getWidgetInfo } from 'react-native-android-widget';
import { isSyncEntityDirty } from '../utils/scheduleSync';
import {
  applyWidgetCloudSchedule,
  readWidgetState,
  SCHEDULE_WIDGET_NAME,
  WIDGET_CLOUD_CHECK_KEY,
} from './widgetCore';
import { refreshScheduleWidgets } from './widgetRenderer';

const CHECK_THROTTLE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 12_000;
let syncInFlight = null;
let subscriptionQueue = Promise.resolve();
let lastPushRegistration = null;

const withTimeout = async (operation, duration = REQUEST_TIMEOUT_MS) => {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Widget background request timed out.');
          error.code = 'widget/timeout';
          reject(error);
        }, duration);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const syncWidgetPushSubscription = async () => {
  const operation = subscriptionQueue.catch(() => {}).then(async () => {
    if (Platform.OS !== 'android') return;
    const state = await readWidgetState();
    if (!state.userId) return;
    const { auth } = require('../config/firebase');
    await withTimeout(auth.authStateReady());
    if (auth.currentUser?.uid !== state.userId || !auth.currentUser.emailVerified) return;

    const widgets = await getWidgetInfo(SCHEDULE_WIDGET_NAME);
    const scheduleId = widgets.length > 0 ? state.schedule?.id || null : null;
    const Notifications = require('expo-notifications');
    const token = scheduleId
      ? await withTimeout(Notifications.getDevicePushTokenAsync(), 4500)
      : null;
    const latest = await readWidgetState();
    if (latest.snapshot !== state.snapshot) return;
    const key = JSON.stringify([state.userId, scheduleId, token?.data || null]);
    const elapsed = Date.now() - Number(lastPushRegistration?.at);
    if (lastPushRegistration?.key === key && elapsed >= 0 && elapsed < 60 * 60 * 1000) return;
    const { syncWidgetPushRegistration } = require('../utils/deviceService');
    if (await syncWidgetPushRegistration(state.userId, scheduleId, token?.data || null)) {
      lastPushRegistration = { key, at: Date.now() };
    }
  });
  subscriptionQueue = operation.catch((error) => {
    console.warn('Widget push registration failed:', error?.code || error?.message);
  });
  return withTimeout(subscriptionQueue).catch((error) => {
    console.warn('Widget push subscription timed out:', error?.code || error?.message);
  });
};

const refreshFromCloud = async ({ force, userId, scheduleId, version }) => {
  const state = await readWidgetState();
  if (!state.userId || !state.schedule?.id) return false;
  if (userId && userId !== state.userId) return false;
  if (scheduleId && scheduleId !== state.schedule.id) return false;
  if (version && Number(state.schedule.version) >= Number(version)) return false;

  const checkKey = `${state.userId}/${state.schedule.id}`;
  const raw = await AsyncStorage.getItem(WIDGET_CLOUD_CHECK_KEY);
  let last = null;
  try {
    last = JSON.parse(raw || 'null');
  } catch (_) {
    await AsyncStorage.removeItem(WIDGET_CLOUD_CHECK_KEY);
  }
  const requestedVersion = Number(version) || 0;
  const elapsed = Date.now() - Number(last?.at);
  const duplicatePush = requestedVersion > 0 && Number(last?.requestedVersion) >= requestedVersion;
  if (last?.key === checkKey && elapsed >= 0 && elapsed < CHECK_THROTTLE_MS
    && (!force || duplicatePush)) return false;
  await AsyncStorage.setItem(WIDGET_CLOUD_CHECK_KEY, JSON.stringify({
    key: checkKey, at: Date.now(), requestedVersion,
  }));

  // Firebase stays lazy: navigation and cached widget rendering never wait for it.
  const { auth } = require('../config/firebase');
  await withTimeout(auth.authStateReady());
  const currentUser = auth.currentUser;
  let schedule = null;
  let revoked = currentUser?.uid !== state.userId || !currentUser?.emailVerified;
  if (currentUser?.uid === state.userId && currentUser.emailVerified) {
    const { getWidgetScheduleFromServer } = require('../config/firestore');
    try {
      schedule = await withTimeout(getWidgetScheduleFromServer(state.userId, state.schedule.id));
    } catch (error) {
      if (error?.code !== 'device/revoked') throw error;
      revoked = true;
    }
    if (auth.currentUser !== currentUser) return false;
  }

  if (isSyncEntityDirty(state.schedule) && !revoked) return false;
  if (schedule && Number(schedule.version) <= (Number(state.schedule.version) || 0)) return false;
  const changed = await applyWidgetCloudSchedule(state, schedule);
  if (changed) await refreshScheduleWidgets();
  return changed;
};

export const syncWidgetFromCloud = async (options = {}) => {
  if (Platform.OS !== 'android') return false;
  while (syncInFlight) {
    await syncInFlight;
    if (!options.force) return false;
  }
  syncInFlight = refreshFromCloud(options)
    .catch((error) => {
      // Offline and timeout failures leave the last usable widget snapshot intact.
      console.warn('Widget cloud refresh failed:', error?.code || error?.message);
      return false;
    })
    .finally(() => { syncInFlight = null; });
  return syncInFlight;
};

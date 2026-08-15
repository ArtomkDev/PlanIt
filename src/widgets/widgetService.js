import { Platform } from 'react-native';
import {
  clearWidgetData,
  getWidgetSelectedScheduleId as readSelectedScheduleId,
  persistWidgetSchedule,
  setWidgetSelectedScheduleId as writeSelectedScheduleId,
} from './widgetCore';
import { refreshScheduleWidgets } from './widgetRenderer';

const NO_PENDING_SCHEDULE = Symbol('no-pending-widget-schedule');
const SYNC_DEBOUNCE_MS = 100;

let syncDebounceTimer = null;
let pendingSchedule = NO_PENDING_SCHEDULE;
let operationQueue = Promise.resolve();

const enqueueOperation = (operation) => {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.catch(() => {});
  return result;
};

const flushPendingSchedule = () => {
  syncDebounceTimer = null;
  if (pendingSchedule === NO_PENDING_SCHEDULE) return;

  const schedule = pendingSchedule;
  pendingSchedule = NO_PENDING_SCHEDULE;
  enqueueOperation(async () => {
    try {
      await persistWidgetSchedule(schedule);
      if (Platform.OS === 'android') await refreshScheduleWidgets();
    } catch (error) {
      console.error('Widget sync error:', error);
    }
  });
};

export const syncScheduleToWidget = (schedule) => {
  pendingSchedule = schedule;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(flushPendingSchedule, SYNC_DEBOUNCE_MS);
};

export const getWidgetSelectedScheduleId = readSelectedScheduleId;

export const setWidgetSelectedScheduleId = async (scheduleId) => {
  try {
    await writeSelectedScheduleId(scheduleId);
  } catch (error) {
    console.error('Widget schedule selection error:', error);
  }
};

export const clearWidgetScheduleData = async () => {
  pendingSchedule = NO_PENDING_SCHEDULE;
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }

  await enqueueOperation(async () => {
    await clearWidgetData();
    if (Platform.OS === 'android') await refreshScheduleWidgets();
  });
};

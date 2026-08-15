import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { decodeStorageValue, encodeStorageValue, isEncodedStorageValue } from '../utils/dataCodec';
import { parseRealSchedule } from './scheduleCore';

export const SCHEDULE_WIDGET_NAME = 'ScheduleWidget';
export const WIDGET_SELECTED_SCHEDULE_ID_KEY = 'widget_selected_schedule_id';

const SCHEDULE_KEY = 'widget_active_schedule';
const OFFSET_KEY = 'widget_date_offset';
const INTENT_KEY = 'widget_intent';
const BOUNDARY_GRACE_MS = 750;

const DAYS_UK = ['Нд', 'Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_UK = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

let storageQueue = Promise.resolve();

const runStorageMutation = (task) => {
  const result = storageQueue.then(task, task);
  storageQueue = result.catch(() => {});
  return result;
};

const normalizeOffset = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNextLocalMidnight = (now) => {
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
};

export function buildScheduleWidgetModel({
  schedule,
  dateOffset = 0,
  widgetInfo = {},
  now: nowInput = new Date(),
}) {
  // All calculations share one immutable clock snapshot, preventing minute-boundary races.
  const now = new Date(nowInput);
  const normalizedOffset = normalizeOffset(dateOffset);
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + normalizedOffset);

  const {
    items,
    currentWeekNum,
    totalWeeks,
    nextTransitionAt,
  } = parseRealSchedule(schedule, targetDate, normalizedOffset, now);

  const headerText = normalizedOffset === 0
    ? 'Сьогодні'
    : normalizedOffset === 1
      ? 'Завтра'
      : DAYS_UK[targetDate.getDay()];
  const dateInfo = `${targetDate.getDate()} ${MONTHS_UK[targetDate.getMonth()]}${
    totalWeeks > 1 ? ` • Тиждень ${currentWeekNum}` : ''
  }`;

  const refreshCandidates = schedule
    ? [nextTransitionAt, getNextLocalMidnight(now)].filter(
      (timestamp) => Number.isFinite(timestamp) && timestamp > now.getTime(),
    )
    : [];
  const nextRefreshAt = refreshCandidates.length > 0
    ? Math.min(...refreshCandidates) + BOUNDARY_GRACE_MS
    : null;

  return {
    hasSchedule: Boolean(schedule),
    items,
    headerText,
    dateInfo,
    isTodayActive: normalizedOffset === 0,
    targetDateIso: targetDate.toISOString(),
    width: widgetInfo?.width,
    height: widgetInfo?.height,
    nextRefreshAt,
  };
}

export async function readWidgetState() {
  await storageQueue.catch(() => {});

  try {
    const entries = await AsyncStorage.multiGet([SCHEDULE_KEY, OFFSET_KEY]);
    const values = Object.fromEntries(entries);
    const rawSchedule = values[SCHEDULE_KEY];
    const schedule = rawSchedule ? decodeStorageValue(rawSchedule) : null;

    if (schedule && !isEncodedStorageValue(rawSchedule)) {
      await AsyncStorage.setItem(SCHEDULE_KEY, encodeStorageValue(schedule));
    }

    return {
      schedule,
      dateOffset: normalizeOffset(values[OFFSET_KEY]),
    };
  } catch (_) {
    return { schedule: null, dateOffset: 0 };
  }
}

export async function getScheduleWidgetModel(widgetInfo, now = new Date(), state) {
  const widgetState = state || await readWidgetState();
  return buildScheduleWidgetModel({ ...widgetState, widgetInfo, now });
}

export function persistWidgetSchedule(schedule) {
  return runStorageMutation(async () => {
    if (!schedule) {
      await AsyncStorage.multiRemove([SCHEDULE_KEY, OFFSET_KEY]);
      return;
    }

    const encoded = encodeStorageValue(schedule);
    const existing = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (existing !== encoded) {
      await AsyncStorage.setItem(SCHEDULE_KEY, encoded);
    }
  });
}

export function updateWidgetOffset(clickAction) {
  return runStorageMutation(async () => {
    const rawOffset = await AsyncStorage.getItem(OFFSET_KEY);
    const current = normalizeOffset(rawOffset);
    const next = clickAction === 'PREV_DAY'
      ? current - 1
      : clickAction === 'NEXT_DAY'
        ? current + 1
        : clickAction === 'TODAY'
          ? 0
          : current;

    if (next !== current || rawOffset === null) {
      await AsyncStorage.setItem(OFFSET_KEY, String(next));
    }
    return next;
  });
}

export async function recordWidgetIntent(action, data = {}) {
  await AsyncStorage.setItem(INTENT_KEY, JSON.stringify({
    action,
    data,
    timestamp: Date.now(),
  }));
}

export async function getWidgetSelectedScheduleId() {
  try {
    return await AsyncStorage.getItem(WIDGET_SELECTED_SCHEDULE_ID_KEY);
  } catch (_) {
    return null;
  }
}

export function setWidgetSelectedScheduleId(scheduleId) {
  return runStorageMutation(async () => {
    if (scheduleId) {
      await AsyncStorage.setItem(WIDGET_SELECTED_SCHEDULE_ID_KEY, scheduleId);
    } else {
      await AsyncStorage.removeItem(WIDGET_SELECTED_SCHEDULE_ID_KEY);
    }
  });
}

export function clearWidgetData() {
  return runStorageMutation(() => AsyncStorage.multiRemove([
    SCHEDULE_KEY,
    OFFSET_KEY,
    WIDGET_SELECTED_SCHEDULE_ID_KEY,
  ]));
}

export function scheduleNextWidgetRefresh(
  nextRefreshAt,
  widgetName = SCHEDULE_WIDGET_NAME,
) {
  if (Platform.OS !== 'android') return;

  const scheduler = NativeModules.WidgetUpdateScheduler;
  if (!scheduler) return;

  if (Number.isFinite(nextRefreshAt)) {
    scheduler.schedule(widgetName, nextRefreshAt);
  } else {
    scheduler.cancel(widgetName);
  }
}

export function cancelWidgetRefresh(widgetName = SCHEDULE_WIDGET_NAME) {
  if (Platform.OS !== 'android') return;
  NativeModules.WidgetUpdateScheduler?.cancel(widgetName);
}

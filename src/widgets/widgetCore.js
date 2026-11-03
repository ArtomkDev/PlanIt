import { t, getLocale, normalizeLanguage } from '../utils/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { parseRealSchedule } from './scheduleCore';
import { isSyncEntityDirty } from '../utils/scheduleSync';

export const SCHEDULE_WIDGET_NAME = 'ScheduleWidget';
export const WIDGET_SELECTED_SCHEDULE_ID_KEY = 'widget_selected_schedule_id';

const SCHEDULE_KEY = 'widget_active_schedule';
const OFFSET_KEY = 'widget_date_offset';
const LANGUAGE_KEY = 'widget_language';
const INTENT_KEY = 'widget_intent';
const SNAPSHOT_FORMAT = 'planit/widget/v1';
export const WIDGET_CLOUD_CHECK_KEY = 'widget_cloud_check';
const BOUNDARY_GRACE_MS = 750;
const NAVIGATION_CACHE_DAYS = 14;

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

const decodeWidgetSnapshot = (raw) => {
  try {
    const cached = raw ? JSON.parse(raw) : null;
    return cached?.format === SNAPSHOT_FORMAT ? cached : { schedule: cached, userId: null };
  } catch (_) {
    return { schedule: null, userId: null };
  }
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
  lang = 'en',
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
  } = parseRealSchedule(schedule, targetDate, normalizedOffset, now, lang);

  const headerText = normalizedOffset === 0
    ? t('common.today', lang)
    : normalizedOffset === 1
      ? t('common.tomorrow', lang)
      : targetDate.toLocaleDateString(getLocale(lang), { weekday: 'short' });
  const dateLabel = targetDate.toLocaleDateString(getLocale(lang), { day: 'numeric', month: 'long' });
  const dateInfo = totalWeeks > 1
    ? `${dateLabel} • ${t('common.week', lang, { week: currentWeekNum })}`
    : dateLabel;

  const refreshCandidates = schedule
    ? [nextTransitionAt, getNextLocalMidnight(now)].filter(
      (timestamp) => Number.isFinite(timestamp) && timestamp > now.getTime(),
    )
    : [];
  const nextRefreshAt = refreshCandidates.length > 0
    ? Math.min(...refreshCandidates) + BOUNDARY_GRACE_MS
    : null;

  return {
    lang: normalizeLanguage(lang),
    hasSchedule: Boolean(schedule),
    scheduleId: schedule?.id || null,
    items: items.map((item) => ({
      ...item,
      title: item.type === 'lesson'
        ? `${item.slotNumber ? `${item.slotNumber}. ` : ''}${item.subject}`
        : item.isFree
          ? `${t('schedule.day_schedule.free_time', lang)} · ${item.duration} ${t('schedule.main_screen.minutes', lang)}`
          : t('widget.break_minutes', lang, { minutes: item.duration }),
      subtitle: item.type === 'lesson'
        ? `${item.startTime} - ${item.endTime} • ${item.details}`
        : `${item.startTime} - ${item.endTime}`,
    })),
    labels: {
      chooseSchedule: t('widget.choose_schedule', lang),
      openSettings: t('widget.open_settings', lang),
      noClasses: t('schedule.day_schedule.no_classes', lang),
      today: t('common.today', lang),
      previous: t('common.previous', lang),
      next: t('common.next', lang),
      now: t('widget.now', lang),
    },
    headerText,
    dateInfo,
    isTodayActive: normalizedOffset === 0,
    targetDateIso: targetDate.toISOString(),
    nextRefreshAt,
  };
}

export async function readWidgetState() {
  await storageQueue.catch(() => {});

  try {
    const entries = await AsyncStorage.multiGet([
      SCHEDULE_KEY, OFFSET_KEY, LANGUAGE_KEY, WIDGET_SELECTED_SCHEDULE_ID_KEY,
    ]);
    const values = Object.fromEntries(entries);
    const rawSchedule = values[SCHEDULE_KEY];
    const snapshot = decodeWidgetSnapshot(rawSchedule);
    const legacyOffset = normalizeOffset(values[OFFSET_KEY]);
    const navigation = Platform.OS === 'android' && NativeModules.ScheduleWidget?.getNavigationState
      ? await NativeModules.ScheduleWidget.getNavigationState(legacyOffset)
      : null;

    return {
      schedule: snapshot.schedule,
      userId: snapshot.userId || null,
      snapshot: rawSchedule,
      selectedScheduleId: values[WIDGET_SELECTED_SCHEDULE_ID_KEY] || null,
      dateOffset: navigation?.dateOffset ?? legacyOffset,
      nativeCacheGeneration: navigation?.cacheGeneration,
      lang: normalizeLanguage(values[LANGUAGE_KEY]),
    };
  } catch (_) {
    return { schedule: null, dateOffset: 0, lang: 'en' };
  }
}

export function buildScheduleWidgetSnapshot({ now: nowInput = new Date(), ...state }) {
  const now = new Date(nowInput);
  const offset = normalizeOffset(state.dateOffset);
  const offsets = new Set([0, offset]);
  if (state.schedule) {
    for (let day = offset - NAVIGATION_CACHE_DAYS; day <= offset + NAVIGATION_CACHE_DAYS; day++) {
      offsets.add(day);
    }
  }
  const dayModels = {};
  for (const dateOffset of offsets) {
    dayModels[dateOffset] = buildScheduleWidgetModel({ ...state, dateOffset, now });
  }
  const boundaries = [dayModels[0].nextRefreshAt, dayModels[offset].nextRefreshAt]
    .filter(Number.isFinite);
  const nextRefreshAt = boundaries.length ? Math.min(...boundaries) : null;
  const baseDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
  return {
    ...dayModels[offset],
    nextRefreshAt,
    dateOffset: offset,
    dayModels,
    baseDate,
    utcOffsetMinutes: -now.getTimezoneOffset(),
    cacheExpiresAt: nextRefreshAt,
    cacheGeneration: state.nativeCacheGeneration,
  };
}

export async function getScheduleWidgetSnapshot(now = new Date(), state) {
  return buildScheduleWidgetSnapshot({ ...(state || await readWidgetState()), now });
}

const configureCloudSync = (schedule, userId) => {
  if (Platform.OS === 'android') {
    NativeModules.WidgetUpdateScheduler?.setCloudSyncEnabled?.(Boolean(userId && schedule?.id));
  }
};

export function persistWidgetSchedule(schedule, lang = 'en', userId = null) {
  return runStorageMutation(async () => {
    await AsyncStorage.setItem(LANGUAGE_KEY, normalizeLanguage(lang));
    if (!schedule) {
      await AsyncStorage.multiRemove([SCHEDULE_KEY, OFFSET_KEY]);
      configureCloudSync(null, userId);
      if (Platform.OS === 'android') await NativeModules.ScheduleWidget?.clearCache();
      return;
    }

    const existing = await AsyncStorage.getItem(SCHEDULE_KEY);
    const previous = decodeWidgetSnapshot(existing);
    if (previous.userId === userId
      && previous.schedule?.id === schedule.id
      && Number(previous.schedule?.version) > (Number(schedule.version) || 0)
      && !isSyncEntityDirty(schedule)) {
      configureCloudSync(previous.schedule, userId);
      return;
    }
    const serialized = JSON.stringify({ format: SNAPSHOT_FORMAT, schedule, userId });
    if (existing !== serialized) {
      await AsyncStorage.setItem(SCHEDULE_KEY, serialized);
    }
    configureCloudSync(schedule, userId);
  });
}

export function applyWidgetCloudSchedule(expected, schedule) {
  return runStorageMutation(async () => {
    const values = Object.fromEntries(await AsyncStorage.multiGet([
      SCHEDULE_KEY, WIDGET_SELECTED_SCHEDULE_ID_KEY,
    ]));
    // A foreground edit, account switch or schedule selection wins over an older request.
    if (values[SCHEDULE_KEY] !== expected.snapshot
      || (values[WIDGET_SELECTED_SCHEDULE_ID_KEY] || null) !== expected.selectedScheduleId) return false;

    if (schedule) {
      await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify({
        format: SNAPSHOT_FORMAT, schedule, userId: expected.userId,
      }));
    } else {
      await AsyncStorage.removeItem(SCHEDULE_KEY);
      if (Platform.OS === 'android') await NativeModules.ScheduleWidget?.clearCache();
    }
    configureCloudSync(schedule, expected.userId);
    return true;
  });
}

export function updateWidgetOffset(clickAction) {
  return runStorageMutation(async () => {
    if (Platform.OS === 'android' && NativeModules.ScheduleWidget?.updateDateOffset) {
      return NativeModules.ScheduleWidget.updateDateOffset(clickAction);
    }
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
  return runStorageMutation(async () => {
    configureCloudSync(null, null);
    await AsyncStorage.multiRemove([
      SCHEDULE_KEY,
      OFFSET_KEY,
      WIDGET_SELECTED_SCHEDULE_ID_KEY,
      LANGUAGE_KEY,
      WIDGET_CLOUD_CHECK_KEY,
    ]);
    if (Platform.OS === 'android') await NativeModules.ScheduleWidget?.clearCache();
  });
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

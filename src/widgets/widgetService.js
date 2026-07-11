import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScheduleWidget } from './ScheduleWidget';

let syncDebounceTimer = null;
let pendingSchedule = undefined;

const DIMENSIONS_KEY = 'widget_dimensions';
const SCHEDULE_KEY = 'widget_active_schedule';
const OFFSET_KEY = 'widget_date_offset';
export const WIDGET_SELECTED_SCHEDULE_ID_KEY = 'widget_selected_schedule_id';

async function getStoredDimensions() {
  try {
    const raw = await AsyncStorage.getItem(DIMENSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { width: undefined, height: undefined };
}

async function doWidgetUpdate(schedule, width, height) {
  const offset = await (async () => {
    try {
      const s = await AsyncStorage.getItem(OFFSET_KEY);
      return s ? parseInt(s, 10) : 0;
    } catch (_) { return 0; }
  })();

  await requestWidgetUpdate({
    widgetName: 'ScheduleWidget',
    renderWidget: () => (
      <ScheduleWidget
        schedule={schedule}
        dateOffset={offset}
        width={width}
        height={height}
      />
    ),
  });
}

export const syncScheduleToWidget = (schedule) => {
  pendingSchedule = schedule;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(async () => {
    syncDebounceTimer = null;
    const currentSchedule = pendingSchedule;
    pendingSchedule = undefined;

    try {
      if (!currentSchedule) {
        await AsyncStorage.multiRemove([SCHEDULE_KEY, OFFSET_KEY]);
        const dims = await getStoredDimensions();
        await doWidgetUpdate(null, dims.width, dims.height);
        return;
      }

      await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(currentSchedule));
      const dims = await getStoredDimensions();
      await doWidgetUpdate(currentSchedule, dims.width, dims.height);
    } catch (error) {
      console.error('Widget sync error:', error);
    }
  }, 500);
};

export const getWidgetSelectedScheduleId = async () => {
  try {
    return await AsyncStorage.getItem(WIDGET_SELECTED_SCHEDULE_ID_KEY);
  } catch (_) {
    return null;
  }
};

export const setWidgetSelectedScheduleId = async (scheduleId) => {
  try {
    if (scheduleId) {
      await AsyncStorage.setItem(WIDGET_SELECTED_SCHEDULE_ID_KEY, scheduleId);
    } else {
      await AsyncStorage.removeItem(WIDGET_SELECTED_SCHEDULE_ID_KEY);
    }
  } catch (error) {
    console.error('Widget schedule selection error:', error);
  }
};

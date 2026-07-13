import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { ScheduleWidget } from './ScheduleWidget';
import { decodeStorageValue, encodeStorageValue, isEncodedStorageValue } from '../utils/dataCodec';

const DIMENSIONS_KEY = 'widget_dimensions';
const SCHEDULE_KEY = 'widget_active_schedule';
const OFFSET_KEY = 'widget_date_offset';

let cachedOffset = null;
let isRendering = false;

async function saveDimensions(widgetInfo) {
  if (widgetInfo?.width > 0 && widgetInfo?.height > 0) {
    try {
      await AsyncStorage.setItem(
        DIMENSIONS_KEY,
        JSON.stringify({ width: widgetInfo.width, height: widgetInfo.height })
      );
    } catch (_) {}
  }
}

async function getDimensions(widgetInfo) {
  if (widgetInfo?.width > 0 && widgetInfo?.height > 0) {
    return { width: widgetInfo.width, height: widgetInfo.height };
  }
  try {
    const raw = await AsyncStorage.getItem(DIMENSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { width: undefined, height: undefined };
}

async function getSchedule() {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (!raw) return null;

    const schedule = decodeStorageValue(raw);
    if (schedule && !isEncodedStorageValue(raw)) {
      await AsyncStorage.setItem(SCHEDULE_KEY, encodeStorageValue(schedule));
    }
    return schedule;
  } catch (_) { return null; }
}

async function getOffset() {
  if (cachedOffset !== null) return cachedOffset;
  try {
    const raw = await AsyncStorage.getItem(OFFSET_KEY);
    cachedOffset = raw ? parseInt(raw, 10) : 0;
    return cachedOffset;
  } catch (_) { return 0; }
}

async function updateOffset(delta, absoluteValue) {
  let current = await getOffset();
  if (absoluteValue !== undefined) {
    current = absoluteValue;
  } else {
    current += delta;
  }
  
  cachedOffset = current;
  await AsyncStorage.setItem(OFFSET_KEY, current.toString());
  return current;
}

async function renderWidget(widgetInfo) {
  const [schedule, offset, dims] = await Promise.all([
    getSchedule(),
    getOffset(),
    getDimensions(widgetInfo),
  ]);

  await requestWidgetUpdate({
    widgetName: 'ScheduleWidget',
    renderWidget: () => (
      <ScheduleWidget
        schedule={schedule}
        dateOffset={offset}
        width={dims.width}
        height={dims.height}
      />
    ),
  });
}

export async function widgetTask(props) {
  const { widgetAction, widgetInfo, clickAction, clickActionData } = props;

  try {
    await saveDimensions(widgetInfo);

    if (clickAction === 'OPEN_SCHEDULE_SELECTOR' || clickAction === 'OPEN_LESSON') {
      await AsyncStorage.setItem(
        'widget_intent',
        JSON.stringify({
          action: clickAction,
          data: clickActionData || {},
          timestamp: Date.now(),
        })
      );
      await Linking.openURL('planit://');
      return;
    }

    if (
      widgetAction === 'WIDGET_ADDED' ||
      widgetAction === 'WIDGET_RESIZED' ||
      widgetAction === 'WIDGET_UPDATE' ||
      widgetAction === 'WIDGET_CLICK'
    ) {
      if (widgetAction === 'WIDGET_CLICK') {
        if (clickAction === 'PREV_DAY') await updateOffset(-1);
        if (clickAction === 'NEXT_DAY') await updateOffset(1);
        if (clickAction === 'TODAY') await updateOffset(0, 0);
      }

      if (isRendering) return;
      isRendering = true;

      await renderWidget(widgetInfo);
      
      isRendering = false;
    }
  } catch (error) {
    isRendering = false;
    console.error('Widget Task Error:', error);
  }
}

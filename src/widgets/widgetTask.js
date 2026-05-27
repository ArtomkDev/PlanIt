import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { ScheduleWidget } from './ScheduleWidget';

const DIMENSIONS_KEY = 'widget_dimensions';
const SCHEDULE_KEY = 'widget_active_schedule';
const OFFSET_KEY = 'widget_date_offset';

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
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

async function getOffset() {
  try {
    const raw = await AsyncStorage.getItem(OFFSET_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch (_) { return 0; }
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
      AsyncStorage.setItem(
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
        let offset = await getOffset();
        if (clickAction === 'PREV_DAY') offset -= 1;
        if (clickAction === 'NEXT_DAY') offset += 1;
        if (clickAction === 'TODAY') offset = 0;
        await AsyncStorage.setItem(OFFSET_KEY, offset.toString());
      }

      await renderWidget(widgetInfo);
    }
  } catch (error) {
    console.error('Widget Task Error:', error);
  }
}

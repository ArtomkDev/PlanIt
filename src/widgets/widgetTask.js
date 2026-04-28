import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { ScheduleWidget } from './ScheduleWidget';

export async function widgetTask(props) {
  const { widgetAction, clickAction, clickActionData } = props;

  try {
    if (clickAction === 'OPEN_SCHEDULE_SELECTOR' || clickAction === 'OPEN_LESSON') {
      await AsyncStorage.setItem('widget_intent', JSON.stringify({
        action: clickAction,
        data: clickActionData || {},
        timestamp: Date.now()
      }));
      await Linking.openURL('planit://');
      return;
    }

    const activeScheduleString = await AsyncStorage.getItem('widget_active_schedule');
    const schedule = activeScheduleString ? JSON.parse(activeScheduleString) : null;

    let offset = 0;
    const savedOffset = await AsyncStorage.getItem('widget_date_offset');
    if (savedOffset) offset = parseInt(savedOffset, 10);

    if (widgetAction === 'WIDGET_CLICK') {
      if (clickAction === 'PREV_DAY') offset -= 1;
      if (clickAction === 'NEXT_DAY') offset += 1;
      if (clickAction === 'TODAY') offset = 0;
      await AsyncStorage.setItem('widget_date_offset', offset.toString());
    }

    await requestWidgetUpdate({
      widgetName: 'ScheduleWidget',
      renderWidget: () => (
        <ScheduleWidget 
          schedule={schedule} 
          dateOffset={offset} 
        />
      ),
    });
  } catch (error) {
    console.error(error);
  }
}
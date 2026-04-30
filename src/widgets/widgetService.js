import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScheduleWidget } from './ScheduleWidget';

let lastSyncedScheduleStr = null;

export const syncScheduleToWidget = async (schedule) => {
  try {
    const scheduleString = schedule ? JSON.stringify(schedule) : null;

    if (lastSyncedScheduleStr === scheduleString) return;
    lastSyncedScheduleStr = scheduleString;

    if (!schedule) {
      await AsyncStorage.multiRemove(['widget_active_schedule', 'widget_date_offset']);
      await requestWidgetUpdate({
        widgetName: 'ScheduleWidget',
        renderWidget: () => <ScheduleWidget schedule={null} dateOffset={0} />,
      });
      return;
    }

    await AsyncStorage.setItem('widget_active_schedule', scheduleString);

    const savedOffsetStr = await AsyncStorage.getItem('widget_date_offset');
    const offset = savedOffsetStr ? parseInt(savedOffsetStr, 10) : 0;

    await requestWidgetUpdate({
      widgetName: 'ScheduleWidget',
      renderWidget: () => <ScheduleWidget schedule={schedule} dateOffset={offset} />,
    });
  } catch (error) {
    console.error('Service Sync Error:', error);
  }
};
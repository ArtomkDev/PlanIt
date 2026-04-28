import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScheduleWidget } from './ScheduleWidget';

export const syncScheduleToWidget = async (schedule) => {
  try {
    if (!schedule) {
      await AsyncStorage.removeItem('widget_active_schedule');
      await requestWidgetUpdate({
        widgetName: 'ScheduleWidget',
        renderWidget: () => <ScheduleWidget schedule={null} dateOffset={0} />,
      });
      return;
    }

    const scheduleString = JSON.stringify(schedule);
    await AsyncStorage.setItem('widget_active_schedule', scheduleString);

    await requestWidgetUpdate({
      widgetName: 'ScheduleWidget',
      renderWidget: () => <ScheduleWidget schedule={schedule} dateOffset={0} />,
    });
  } catch (error) {
    console.error('Service Sync Error:', error);
  }
};
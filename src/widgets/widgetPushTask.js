import * as Notifications from 'expo-notifications';
import { requireOptionalNativeModule } from 'expo';
import { AppRegistry } from 'react-native';
import { syncWidgetFromCloud, syncWidgetPushSubscription } from './widgetSync';

const WIDGET_PUSH_TASK = 'planit-widget-cloud-update';

if (requireOptionalNativeModule('ExpoTaskManager')) {
  const TaskManager = require('expo-task-manager');
  // Keep Expo's no-op pending so Android timers run until TaskService finishes it.
  AppRegistry.registerHeadlessTask('expo-task-manager', () => () => new Promise(() => {}));
  TaskManager.defineTask(WIDGET_PUSH_TASK, async ({ data, error }) => {
    if (error || data?.data?.type !== 'widget_schedule_changed') return;
    const { userId, scheduleId, version } = data.data;
    if (typeof userId !== 'string' || typeof scheduleId !== 'string') return;
    await syncWidgetFromCloud({ force: true, userId, scheduleId, version });
  });

  Notifications.registerTaskAsync(WIDGET_PUSH_TASK).catch((error) => {
    console.warn('Widget background task registration failed:', error?.code || error?.message);
  });
}

Notifications.addPushTokenListener(() => { syncWidgetPushSubscription(); });

import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalSchedule } from '../utils/storage';
import { clearAllLocalAttachmentCaches } from './attachmentService';
import { clearAllLocalNotifications } from './notificationService';
import { clearWidgetScheduleData } from '../widgets/widgetService';

const LOCAL_ACCOUNT_KEYS = [
  'app_device_settings',
  'widget_intent',
];

export const clearLocalAccountData = async (userId) => {
  const cleanupResults = await Promise.allSettled([
    clearLocalSchedule(userId, { throwOnError: true }),
    clearAllLocalAttachmentCaches(),
    clearAllLocalNotifications(),
    clearWidgetScheduleData(),
    AsyncStorage.multiRemove(LOCAL_ACCOUNT_KEYS),
  ]);

  const failures = cleanupResults
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);

  if (failures.length > 0) {
    const error = new Error(
      `${failures.length} local account cleanup step(s) failed.`,
    );
    error.code = 'account-deletion/local-cleanup-failed';
    error.cause = failures[0];
    throw error;
  }
};

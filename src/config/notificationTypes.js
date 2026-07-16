import { NOTIFICATION_TYPES } from "../services/notificationService";

export const NOTIFICATION_TYPE_CONFIG = [
  {
    type: NOTIFICATION_TYPES.ACCOUNT_LOGIN,
    titleKey: "settings.notifications.types.account_login.title",
    descKey: "settings.notifications.types.account_login.desc",
  },
  {
    type: NOTIFICATION_TYPES.LESSON_REMINDER,
    titleKey: "settings.notifications.types.lesson_reminder.title",
    descKey: "settings.notifications.types.lesson_reminder.desc",
  },
];

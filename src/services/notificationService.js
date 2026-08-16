import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../config/firebase";
import { t } from "../utils/i18n";
import { buildLessonOccurrences } from "../utils/scheduleTime";
import {
  normalizeScheduleReminder,
  normalizeSubjectReminder,
} from "../utils/reminderSettings";

export const NOTIFICATION_TYPES = {
  ACCOUNT_LOGIN: "account_login",
  LESSON_REMINDER: "lesson_reminder",
};

export const DEFAULT_NOTIFICATION_PUSH_BY_TYPE = {
  [NOTIFICATION_TYPES.ACCOUNT_LOGIN]: true,
  [NOTIFICATION_TYPES.LESSON_REMINDER]: true,
};

const LOCAL_NOTIFICATION_STORAGE_KEY = "planit_local_notifications_v1";
const LEGACY_LESSON_REMINDER_STORAGE_KEY = "planit_lesson_reminders_v1";
const EXPO_PUSH_SEND_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_TIMEOUT_MS = 4500;
const LESSON_REMINDER_HORIZON_DAYS = 21;
const MAX_LESSON_REMINDER_NOTIFICATIONS = 60;
export const NOTIFICATION_RETENTION_DAYS = 90;
export const NOTIFICATION_INBOX_LIMIT = 100;
const NOTIFICATION_WRITE_BATCH_LIMIT = 450;
const EXPO_PUSH_MESSAGE_BATCH_LIMIT = 100;
const ACTIVE_DEVICE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const isExpoGo = isRunningInExpoGo();
const Notifications = Platform.OS !== "web" && !isExpoGo
  ? require("expo-notifications")
  : null;
const unsupportedNotificationStatus = isExpoGo
  ? "unsupported_expo_go"
  : "unsupported";
const dateTriggerType = Notifications?.SchedulableTriggerInputTypes?.DATE || "date";

const CHANNELS_BY_TYPE = {
  [NOTIFICATION_TYPES.ACCOUNT_LOGIN]: {
    id: "account-security",
    name: "Account security",
  },
  [NOTIFICATION_TYPES.LESSON_REMINDER]: {
    id: "lesson-reminders",
    name: "Lesson reminders",
  },
};

let configuredChannels = {};

if (Notifications?.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const notificationsCollection = (userId) => collection(db, "users", userId, "notifications");
const devicesCollection = (userId) => collection(db, "users", userId, "devices");

const nowTimestamp = () => Timestamp.now();
const timestampToMs = (value) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return null;
};

const boundedText = (value, fallback, maxLength) => {
  const normalized = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return String(normalized || "").slice(0, maxLength);
};

const isActiveDevice = (device = {}, now = Date.now()) => {
  if ((device.status || "active") !== "active") return false;
  const lastSeenAt = timestampToMs(device.lastSeenAt)
    || timestampToMs(device.lastLogin)
    || 0;
  return lastSeenAt <= 0 || now - lastSeenAt < ACTIVE_DEVICE_MAX_AGE_MS;
};

const withTimeout = (promise, timeoutMs, label) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise])
    .finally(() => clearTimeout(timeoutId));
};

const getNotificationPreferences = (preferencesOrGlobal = {}) => {
  if (preferencesOrGlobal?.pushByType) return preferencesOrGlobal;
  return preferencesOrGlobal?.notificationPreferences || {};
};

export const isNotificationPushEnabled = (preferencesOrGlobal, type) => {
  const preferences = getNotificationPreferences(preferencesOrGlobal);
  const value = preferences?.pushByType?.[type];

  if (value === undefined || value === null) {
    return DEFAULT_NOTIFICATION_PUSH_BY_TYPE[type] !== false;
  }

  return value === true;
};

export const createNotificationPreferencesWithPush = (preferencesOrGlobal, type, enabled) => {
  const preferences = getNotificationPreferences(preferencesOrGlobal);

  return {
    ...preferences,
    pushByType: {
      ...(preferences?.pushByType || {}),
      [type]: enabled === true,
    },
  };
};

const getPermissionGranted = (settings) => (
  !!settings?.granted
  || settings?.ios?.status === Notifications?.IosAuthorizationStatus?.PROVISIONAL
  || settings?.ios?.status === Notifications?.IosAuthorizationStatus?.AUTHORIZED
);

const ensureNativeNotificationPermissions = async ({ request = false } = {}) => {
  if (Platform.OS === "web") {
    return { granted: true, status: "unsupported" };
  }
  if (!Notifications) {
    return { granted: false, status: unsupportedNotificationStatus };
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    if (getPermissionGranted(current)) {
      return { granted: true, status: current.status };
    }

    if (!request) {
      return { granted: false, status: current.status };
    }

    const next = Platform.OS === "ios"
      ? await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      })
      : await Notifications.requestPermissionsAsync();

    return { granted: getPermissionGranted(next), status: next.status };
  } catch (error) {
    return { granted: false, status: "error", error };
  }
};

export const ensureNotificationPushPermissionsForType = async (
  type,
  { request = false, notificationPreferences } = {}
) => {
  if (!isNotificationPushEnabled(notificationPreferences, type)) {
    return {
      granted: false,
      status: "disabled_by_preference",
      disabledByPreference: true,
    };
  }

  return ensureNativeNotificationPermissions({ request });
};

export const ensureLessonReminderPermissions = (options = {}) => (
  ensureNotificationPushPermissionsForType(NOTIFICATION_TYPES.LESSON_REMINDER, options)
);

export const getCurrentDevicePushRegistration = async ({ request = false } = {}) => {
  if (Platform.OS === "web" || !Notifications) return null;

  const permission = await ensureNativeNotificationPermissions({ request });
  const registration = {
    pushPermissionStatus: permission.status || "unknown",
    pushTokenPlatform: Platform.OS,
    pushTokenUpdatedAt: nowTimestamp(),
  };

  if (!permission.granted) {
    return {
      ...registration,
      expoPushToken: null,
    };
  }

  try {
    const projectId = getExpoProjectId();
    const token = await withTimeout(
      Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined),
      EXPO_PUSH_TIMEOUT_MS,
      "expo_push_token"
    );

    return {
      ...registration,
      expoPushToken: token?.data || null,
      pushTokenError: deleteField(),
    };
  } catch (error) {
    return {
      ...registration,
      expoPushToken: null,
      pushTokenError: boundedText(error?.code || error?.message, "token_error", 160),
    };
  }
};

export const syncDevicePushRegistration = async (userId, deviceId, options = {}) => {
  if (!userId || !deviceId) return null;

  const deviceRef = doc(db, "users", userId, "devices", deviceId);
  const deviceSnap = await getDoc(deviceRef);
  if (!deviceSnap.exists() || !isActiveDevice(deviceSnap.data())) {
    const error = new Error("Cannot register push notifications for an inactive device.");
    error.code = "device/revoked";
    throw error;
  }

  const registration = await getCurrentDevicePushRegistration(options);
  if (!registration) return null;

  await updateDoc(deviceRef, registration);
  return registration;
};

const ensureAndroidChannel = async (type) => {
  if (Platform.OS !== "android" || !Notifications) return null;

  const channel = CHANNELS_BY_TYPE[type] || CHANNELS_BY_TYPE[NOTIFICATION_TYPES.LESSON_REMINDER];
  if (configuredChannels[channel.id]) return channel.id;

  await Notifications.setNotificationChannelAsync(channel.id, {
    name: channel.name,
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });

  configuredChannels[channel.id] = true;
  return channel.id;
};

const withAndroidChannel = async (type, trigger) => {
  if (Platform.OS !== "android") return trigger;

  const channelId = await ensureAndroidChannel(type);
  if (trigger && typeof trigger === "object") {
    return { ...trigger, channelId };
  }

  return { channelId };
};

const dispatchLocalPushNotification = async (type, content, options = {}) => {
  if (Platform.OS === "web" || !Notifications) {
    return { id: null, status: unsupportedNotificationStatus };
  }

  const permission = await ensureNotificationPushPermissionsForType(type, {
    request: options.requestPermissions === true,
    notificationPreferences: options.notificationPreferences,
  });

  if (!permission.granted) {
    return { id: null, status: permission.status, permission };
  }

  const trigger = await withAndroidChannel(type, options.trigger || null);
  const id = await Notifications.scheduleNotificationAsync({
    identifier: options.identifier,
    content: {
      ...content,
      sound: content.sound ?? "default",
      data: {
        type,
        ...(content.data || {}),
      },
    },
    trigger,
  });

  return { id, status: "scheduled" };
};

const readLocalNotificationState = async () => {
  const emptyState = { schedules: {} };

  try {
    const raw = await AsyncStorage.getItem(LOCAL_NOTIFICATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { schedules: parsed.schedules || {} };
      }
    }
  } catch (error) {}

  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_LESSON_REMINDER_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed && typeof parsed === "object" && parsed.schedules) {
        return { schedules: parsed.schedules };
      }
    }
  } catch (error) {}

  return emptyState;
};

const writeLocalNotificationState = async (state) => {
  try {
    await AsyncStorage.setItem(
      LOCAL_NOTIFICATION_STORAGE_KEY,
      JSON.stringify({
        schedules: state.schedules || {},
        updatedAt: Date.now(),
      })
    );
  } catch (error) {}
};

export const clearAllLocalNotifications = async () => {
  const failures = [];

  if (Notifications) {
    const notificationResults = await Promise.allSettled([
      Notifications.cancelAllScheduledNotificationsAsync(),
      Notifications.dismissAllNotificationsAsync(),
    ]);
    notificationResults.forEach((result) => {
      if (result.status === "rejected") failures.push(result.reason);
    });
  }

  try {
    await AsyncStorage.multiRemove([
      LOCAL_NOTIFICATION_STORAGE_KEY,
      LEGACY_LESSON_REMINDER_STORAGE_KEY,
    ]);
  } catch (error) {
    failures.push(error);
  }

  if (failures.length > 0) {
    const error = new Error("Local notification cleanup failed.");
    error.code = "account-deletion/local-notification-cleanup-failed";
    error.cause = failures[0];
    throw error;
  }
};

const safeIdentifierPart = (value) => (
  String(value || "unknown")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64)
);

const buildNotificationIdentifier = (scheduleId, occurrence, reminder) => {
  const startKey = occurrence.startAt.toISOString().replace(/[^0-9]/g, "").slice(0, 12);
  return [
    "lesson-reminder",
    safeIdentifierPart(scheduleId),
    startKey,
    occurrence.dayIndex,
    occurrence.lessonIndex,
    safeIdentifierPart(occurrence.subjectId),
    reminder.minutesBefore,
  ].join("-");
};

const formatTemplate = (template, params) => (
  Object.entries(params).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  )
);

const getExpoProjectId = () => (
  Constants.easConfig?.projectId
  || Constants.expoConfig?.extra?.eas?.projectId
  || null
);

const isExpoPushToken = (token) => (
  typeof token === "string"
  && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token)
);

const buildAccountLoginContent = (notification = {}, lang = "en") => {
  const deviceName = notification.deviceName || t("settings.device_screen.unknown_device", lang);
  return {
    title: t("settings.notifications.account_login_title", lang),
    body: formatTemplate(t("settings.notifications.account_login_message", lang), {
      deviceName,
    }),
  };
};

const sendExpoPushMessages = async (messages) => {
  const validMessages = (Array.isArray(messages) ? messages : [messages]).filter(Boolean);
  if (validMessages.length === 0) return { sent: 0, tickets: [] };

  const tickets = [];
  for (let offset = 0; offset < validMessages.length; offset += EXPO_PUSH_MESSAGE_BATCH_LIMIT) {
    const messageBatch = validMessages.slice(offset, offset + EXPO_PUSH_MESSAGE_BATCH_LIMIT);
    const response = await withTimeout(
      fetch(EXPO_PUSH_SEND_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageBatch.length === 1 ? messageBatch[0] : messageBatch),
      }),
      EXPO_PUSH_TIMEOUT_MS,
      "expo_push_send"
    );

    if (!response.ok) {
      throw new Error(`expo_push_send_failed:${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    const batchTickets = Array.isArray(payload?.data)
      ? payload.data
      : payload?.data
        ? [payload.data]
        : [];
    tickets.push(...batchTickets);
  }

  return { sent: validMessages.length, tickets };
};

const getLessonRoom = (occurrence) => (
  occurrence.lessonData?.room
  || occurrence.lessonData?.building
  || occurrence.subject?.room
  || occurrence.subject?.building
  || ""
);

export const buildLessonReminderRequests = (schedule, options = {}) => {
  if (!schedule?.id) return [];

  const {
    now = new Date(),
    lang = "en",
    horizonDays = LESSON_REMINDER_HORIZON_DAYS,
    maxNotifications = MAX_LESSON_REMINDER_NOTIFICATIONS,
  } = options;

  const nowDate = new Date(now);
  const nowMs = Number.isNaN(nowDate.getTime()) ? Date.now() : nowDate.getTime();
  const scheduleReminder = normalizeScheduleReminder(schedule.reminder);

  const occurrences = buildLessonOccurrences(schedule, {
    from: new Date(nowMs),
    horizonDays,
    includePast: false,
  });

  const requests = [];

  for (const occurrence of occurrences) {
    const subjectReminder = normalizeSubjectReminder(occurrence.subject?.reminder);
    const effectiveReminder = subjectReminder || scheduleReminder;
    if (!effectiveReminder.enabled) continue;

    const triggerAt = new Date(
      occurrence.startAt.getTime() - effectiveReminder.minutesBefore * 60 * 1000
    );
    if (triggerAt.getTime() <= nowMs + 1000) continue;

    const subjectName = occurrence.subject?.name || t("schedule.reminders.lesson", lang);
    const room = getLessonRoom(occurrence);
    const title = formatTemplate(t("schedule.reminders.notification_title", lang), {
      subject: subjectName,
    });
    const body = formatTemplate(t("schedule.reminders.notification_body", lang), {
      time: occurrence.timeInfo.start,
    });

    requests.push({
      identifier: buildNotificationIdentifier(schedule.id, occurrence, effectiveReminder),
      content: {
        title,
        body: room ? `${body} - ${room}` : body,
        data: {
          scheduleId: schedule.id,
          subjectId: occurrence.subjectId,
          lessonIndex: occurrence.lessonIndex,
          dayIndex: occurrence.dayIndex,
          weekKey: occurrence.weekKey,
          startAt: occurrence.startAt.toISOString(),
        },
      },
      trigger: {
        type: dateTriggerType,
        date: triggerAt,
      },
      metadata: {
        scheduleId: schedule.id,
        subjectId: occurrence.subjectId,
        fireAt: triggerAt.toISOString(),
        startAt: occurrence.startAt.toISOString(),
      },
    });

    if (requests.length >= maxNotifications) break;
  }

  return requests;
};

export const cancelLessonRemindersForSchedule = async (scheduleId) => {
  if (!scheduleId) return { canceled: 0 };

  const state = await readLocalNotificationState();
  const records = Array.isArray(state.schedules?.[scheduleId])
    ? state.schedules[scheduleId]
    : [];
  const ids = records
    .map((record) => (typeof record === "string" ? record : record?.id))
    .filter(Boolean);

  if (Notifications && ids.length > 0) {
    await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
  }

  delete state.schedules[scheduleId];
  await writeLocalNotificationState(state);

  try {
    await AsyncStorage.removeItem(LEGACY_LESSON_REMINDER_STORAGE_KEY);
  } catch (error) {}

  return { canceled: ids.length };
};

const saveScheduleRecords = async (scheduleId, records) => {
  const state = await readLocalNotificationState();

  if (records.length > 0) {
    state.schedules[scheduleId] = records;
  } else {
    delete state.schedules[scheduleId];
  }

  await writeLocalNotificationState(state);
};

export const reconcileLessonRemindersForSchedule = async (schedule, options = {}) => {
  if (!schedule?.id) return { scheduled: 0, canceled: 0, status: "missing_schedule" };

  const { canceled } = await cancelLessonRemindersForSchedule(schedule.id);

  if (!isNotificationPushEnabled(
    options.notificationPreferences,
    NOTIFICATION_TYPES.LESSON_REMINDER
  )) {
    return { scheduled: 0, canceled, status: "disabled_by_preference" };
  }

  if (Platform.OS === "web" || !Notifications) {
    return { scheduled: 0, canceled, status: unsupportedNotificationStatus };
  }

  const requests = buildLessonReminderRequests(schedule, options);
  if (requests.length === 0) {
    return { scheduled: 0, canceled, status: "no_reminders" };
  }

  const permission = await ensureNotificationPushPermissionsForType(
    NOTIFICATION_TYPES.LESSON_REMINDER,
    {
      request: options.requestPermissions === true,
      notificationPreferences: options.notificationPreferences,
    }
  );

  if (!permission.granted) {
    return { scheduled: 0, canceled, status: "permission_denied" };
  }

  const records = [];
  for (const request of requests) {
    try {
      const { id } = await dispatchLocalPushNotification(
        NOTIFICATION_TYPES.LESSON_REMINDER,
        request.content,
        {
          identifier: request.identifier,
          trigger: request.trigger,
          notificationPreferences: options.notificationPreferences,
        }
      );
      if (id) records.push({ id, ...request.metadata });
    } catch (error) {}
  }

  await saveScheduleRecords(schedule.id, records);

  return {
    scheduled: records.length,
    canceled,
    status: records.length > 0 ? "scheduled" : "failed",
  };
};

const sendAccountLoginPushToOtherDevices = async (userId, notification, options = {}) => {
  if (!userId || !notification?.id) return { sent: 0, status: "missing_notification" };

  const sourceDeviceId = options.sourceDeviceId || notification.deviceId || null;
  const sourceExpoPushToken = options.sourceExpoPushToken || null;
  const notificationPreferences = options.notificationPreferences || {};

  if (!isNotificationPushEnabled(notificationPreferences, NOTIFICATION_TYPES.ACCOUNT_LOGIN)) {
    return { sent: 0, status: "disabled_by_preference" };
  }

  try {
    const devicesSnap = await getDocs(devicesCollection(userId));
    const messages = [];
    const targets = [];
    const seenTokens = new Set();
    const content = buildAccountLoginContent(notification, options.lang || "en");

    devicesSnap.docs.forEach((deviceSnap) => {
      if (sourceDeviceId && deviceSnap.id === sourceDeviceId) return;

      const device = deviceSnap.data() || {};
      if (!isActiveDevice(device)) return;
      const token = device.expoPushToken;
      if (sourceExpoPushToken && token === sourceExpoPushToken) return;
      if (!isExpoPushToken(token) || seenTokens.has(token)) return;

      seenTokens.add(token);
      targets.push(deviceSnap.ref);
      messages.push({
        to: token,
        sound: "default",
        title: content.title,
        body: content.body,
        data: {
          type: NOTIFICATION_TYPES.ACCOUNT_LOGIN,
          notificationId: notification.id,
          deviceId: notification.deviceId || null,
          createdAt: timestampToMs(notification.createdAt)
            ? new Date(timestampToMs(notification.createdAt)).toISOString()
            : null,
        },
      });
    });

    if (messages.length === 0) {
      return { sent: 0, status: "no_target_tokens" };
    }

    const result = await sendExpoPushMessages(messages);
    const invalidTargetRefs = (result.tickets || [])
      .map((ticket, index) => (
        ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered"
          ? targets[index]
          : null
      ))
      .filter(Boolean);

    for (
      let offset = 0;
      offset < invalidTargetRefs.length;
      offset += NOTIFICATION_WRITE_BATCH_LIMIT
    ) {
      const batch = writeBatch(db);
      invalidTargetRefs
        .slice(offset, offset + NOTIFICATION_WRITE_BATCH_LIMIT)
        .forEach((deviceRef) => {
          batch.update(deviceRef, {
            expoPushToken: deleteField(),
            pushTokenError: "DeviceNotRegistered",
            pushTokenUpdatedAt: nowTimestamp(),
          });
        });
      await batch.commit();
    }
    return { ...result, status: "sent" };
  } catch (error) {
    return { sent: 0, status: "failed", error };
  }
};

export async function getUserNotificationContext(userId) {
  if (!userId) return { notificationPreferences: {}, language: "en" };

  try {
    const globalRef = doc(db, "users", userId, "global", "settings");
    const globalSnap = await getDoc(globalRef);
    if (!globalSnap.exists()) return { notificationPreferences: {}, language: "en" };

    const globalData = globalSnap.data() || {};

    return {
      notificationPreferences: globalData.notificationPreferences || {},
      language: globalData.language || "en",
    };
  } catch (error) {
    return { notificationPreferences: {}, language: "en" };
  }
}

export async function getUserNotificationPreferences(userId) {
  return (await getUserNotificationContext(userId)).notificationPreferences;
}

export async function createLoginNotification(userId, loginInfo = {}) {
  if (!userId) return null;

  const context = (!loginInfo.notificationPreferences || !loginInfo.lang)
    ? await getUserNotificationContext(userId)
    : {};
  const lang = loginInfo.lang || context.language || "en";
  const notificationPreferences = loginInfo.notificationPreferences
    || context.notificationPreferences
    || {};
  const createdAt = nowTimestamp();
  const expiresAt = Timestamp.fromMillis(
    createdAt.toMillis() + NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const rawDeviceName = !loginInfo.deviceName || loginInfo.deviceName === "Unknown Device"
    ? t("settings.device_screen.unknown_device", lang)
    : loginInfo.deviceName === "Web Browser"
      ? t("settings.notifications.web_browser", lang)
    : loginInfo.deviceName;
  const rawPlatform = !loginInfo.platform || loginInfo.platform === "Unknown"
    ? t("settings.notifications.unknown_platform", lang)
    : loginInfo.platform;
  const rawIpAddress = !loginInfo.ipAddress || loginInfo.ipAddress === "Unknown IP"
    ? t("settings.notifications.unknown_ip", lang)
    : loginInfo.ipAddress;
  const deviceName = boundedText(rawDeviceName, "Unknown Device", 240);
  const platform = boundedText(rawPlatform, "Unknown", 40);
  const ipAddress = boundedText(rawIpAddress, "Unknown IP", 64);
  const localizedContent = buildAccountLoginContent({ deviceName }, lang);

  const payload = {
    type: NOTIFICATION_TYPES.ACCOUNT_LOGIN,
    title: boundedText(loginInfo.title || localizedContent.title, "PlanIt", 160),
    message: boundedText(loginInfo.message || localizedContent.body, "", 500),
    createdAt,
    expiresAt,
    readAt: null,
    deviceId: loginInfo.deviceId
      ? boundedText(loginInfo.deviceId, "", 96)
      : null,
    deviceName,
    platform,
    ipAddress,
    metadata: {
      brand: loginInfo.metadata?.brand
        ? boundedText(loginInfo.metadata.brand, "", 80)
        : null,
      model: loginInfo.metadata?.model
        ? boundedText(loginInfo.metadata.model, "", 120)
        : null,
    },
  };

  const notificationRef = await addDoc(notificationsCollection(userId), payload);
  const notification = { id: notificationRef.id, ...payload };

  await sendAccountLoginPushToOtherDevices(userId, notification, {
    lang,
    notificationPreferences,
    sourceDeviceId: payload.deviceId,
    sourceExpoPushToken: loginInfo.sourceExpoPushToken,
  });

  return notification;
}

export function subscribeToNotifications(userId, callback) {
  if (!userId) return () => {};

  cleanupExpiredNotifications(userId).catch(() => {});

  const notificationsQuery = query(
    notificationsCollection(userId),
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_INBOX_LIMIT)
  );

  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(notifications);
    },
    (error) => {
      console.error(error);
      callback([]);
    }
  );
}

export async function markNotificationAsRead(userId, notificationId) {
  if (!userId || !notificationId) return;

  const notificationRef = doc(db, "users", userId, "notifications", notificationId);
  const batch = writeBatch(db);
  batch.update(notificationRef, { readAt: nowTimestamp() });
  await batch.commit();
}

export async function markAllNotificationsAsRead(userId) {
  if (!userId) return;

  while (true) {
    const unreadQuery = query(
      notificationsCollection(userId),
      where("readAt", "==", null),
      limit(NOTIFICATION_WRITE_BATCH_LIMIT)
    );
    const snapshot = await getDocs(unreadQuery);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    const readAt = nowTimestamp();
    snapshot.docs.forEach((docSnap) => batch.update(docSnap.ref, { readAt }));
    await batch.commit();
    if (snapshot.size < NOTIFICATION_WRITE_BATCH_LIMIT) return;
  }
}

export async function cleanupExpiredNotifications(userId, options = {}) {
  if (!userId) return 0;

  const maxBatches = Math.max(1, Math.min(Number(options.maxBatches) || 4, 20));
  let deleted = 0;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const expiredQuery = query(
      notificationsCollection(userId),
      where("expiresAt", "<=", nowTimestamp()),
      limit(NOTIFICATION_WRITE_BATCH_LIMIT)
    );
    const snapshot = await getDocs(expiredQuery);
    if (snapshot.empty) break;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < NOTIFICATION_WRITE_BATCH_LIMIT) break;
  }

  return deleted;
}

export async function deleteNotification(userId, notificationId) {
  if (!userId || !notificationId) return;

  await deleteDoc(doc(db, "users", userId, "notifications", notificationId));
}

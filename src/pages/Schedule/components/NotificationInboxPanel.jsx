import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Bell,
  CheckCircle,
  DeviceMobile,
  Monitor,
  SignIn,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import themes from "../../../config/themes";
import { useNotificationDrawer } from "../../../context/NotificationDrawerContext";
import { useScheduleData } from "../../../context/ScheduleProvider";
import useNotifications from "../../../hooks/useNotifications";
import { t } from "../../../utils/i18n";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NOTIFICATION_TYPES,
} from "../../../services/notificationService";

const timestampToMs = (value) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return null;
};

const interpolate = (template, values) => {
  if (!template || typeof template !== "string") return "";
  return Object.entries(values).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template
  );
};

export default function NotificationInboxPanel() {
  const { user, global, lang } = useScheduleData();
  const { drawerContentInset } = useNotificationDrawer();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, loading } = useNotifications({
    userId: user?.uid,
    enabled: !!user?.uid,
  });
  const [markingAll, setMarkingAll] = useState(false);
  const [readingId, setReadingId] = useState(null);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const formatDate = useCallback((value) => {
    const ms = timestampToMs(value);
    if (!ms) return "";

    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user || unreadCount === 0 || markingAll) return;

    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead(user.uid);
    } catch (error) {
      console.error(error);
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, user]);

  const handleMarkAsRead = useCallback(async (notification) => {
    if (!user || !notification?.id || notification.readAt || readingId) return;

    try {
      setReadingId(notification.id);
      await markNotificationAsRead(user.uid, notification.id);
    } catch (error) {
      console.error(error);
    } finally {
      setReadingId(null);
    }
  }, [readingId, user]);

  const getTitle = (notification) => {
    if (notification.type === NOTIFICATION_TYPES.ACCOUNT_LOGIN) {
      return t("settings.notifications.account_login_title", lang);
    }
    return notification.title || t("settings.notifications.title", lang);
  };

  const getMessage = (notification) => {
    if (notification.type === NOTIFICATION_TYPES.ACCOUNT_LOGIN) {
      return interpolate(t("settings.notifications.account_login_message", lang), {
        deviceName: notification.deviceName || t("settings.device_screen.unknown_device", lang),
      });
    }
    return notification.message || "";
  };

  const renderNotification = (notification) => {
    const isUnread = !notification.readAt;
    const deviceName = notification.deviceName || t("settings.device_screen.unknown_device", lang);
    const platform = notification.platform || "Unknown";
    const ipAddress = notification.ipAddress || t("settings.notifications.unknown_ip", lang);
    const DeviceIcon = platform === "Web" ? Monitor : DeviceMobile;

    return (
      <TouchableOpacity
        key={notification.id}
        activeOpacity={isUnread ? 0.72 : 1}
        disabled={!isUnread}
        onPress={() => handleMarkAsRead(notification)}
        style={[
          styles.notificationCard,
          {
            backgroundColor: themeColors.backgroundColor2,
            borderColor: isUnread ? themeColors.accentColor + "55" : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + "15" }]}>
          <SignIn size={22} color={themeColors.accentColor} weight={isUnread ? "fill" : "regular"} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, { color: themeColors.textColor }]} numberOfLines={2}>
              {getTitle(notification)}
            </Text>
            {isUnread && (
              <View style={[styles.statusBadge, { backgroundColor: themeColors.accentColor + "18" }]}>
                <Text style={[styles.statusText, { color: themeColors.accentColor }]}>
                  {t("settings.notifications.unread", lang)}
                </Text>
              </View>
            )}
          </View>

          {!!getMessage(notification) && (
            <Text style={[styles.message, { color: themeColors.textColor2 }]} numberOfLines={2}>
              {getMessage(notification)}
            </Text>
          )}

          <View style={styles.detailBlock}>
            <View style={styles.detailLine}>
              <DeviceIcon size={14} color={themeColors.textColor2} />
              <Text style={[styles.detailText, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {t("settings.notifications.device", lang)}: {deviceName}
              </Text>
            </View>
            <Text style={[styles.detailText, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {t("settings.notifications.platform", lang)}: {platform}
            </Text>
            <Text style={[styles.detailText, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {t("settings.notifications.ip_address", lang)}: {ipAddress}
            </Text>
            <Text style={[styles.detailText, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {formatDate(notification.createdAt)}
            </Text>
          </View>
        </View>

        {isUnread && (
          <View style={styles.readIcon}>
            <CheckCircle
              size={22}
              color={readingId === notification.id ? themeColors.textColor3 : themeColors.accentColor}
              weight="bold"
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 8) + 8,
            paddingLeft: drawerContentInset + 28,
          },
        ]}
      >
        <View style={styles.titleGroup}>
          <Text style={[styles.title, { color: themeColors.textColor }]} numberOfLines={1}>
            {t("settings.notifications.title", lang)}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadCountBadge, { backgroundColor: themeColors.accentColor }]}>
              <Text style={styles.unreadCountText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("settings.notifications.mark_all_read", lang)}
            activeOpacity={0.72}
            onPress={handleMarkAllAsRead}
            style={[styles.headerAction, { backgroundColor: themeColors.accentColor + "15" }]}
          >
            <CheckCircle
              size={21}
              color={markingAll ? themeColors.textColor3 : themeColors.accentColor}
              weight="bold"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerActionPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingLeft: drawerContentInset + 24,
            paddingRight: 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={themeColors.accentColor} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={30} color={themeColors.textColor2} />
            <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
              {t("settings.notifications.empty", lang)}
            </Text>
          </View>
        ) : (
          notifications.map(renderNotification)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    minHeight: 70,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionPlaceholder: {
    width: 38,
    height: 38,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingRight: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0,
  },
  unreadCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  unreadCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  content: {
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  notificationCard: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 104,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  detailBlock: {
    marginTop: 8,
    gap: 3,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  detailText: {
    fontSize: 13,
    fontWeight: "500",
  },
  readIcon: {
    paddingLeft: 10,
    paddingTop: 2,
  },
  emptyState: {
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 15,
    fontWeight: "500",
  },
});

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
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
import { triggerHaptic } from "../../../utils/haptics";
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_EXPAND_ANIMATION = {
  duration: 220,
  create: { type: "easeInEaseOut", property: "opacity" },
  update: { type: "easeInEaseOut" },
  delete: { type: "easeInEaseOut", property: "opacity" },
};

const configureCardLayoutAnimation = () => {
  if (!LayoutAnimation?.configureNext) return;

  try {
    LayoutAnimation.configureNext(CARD_EXPAND_ANIMATION);
  } catch {
    // Some web/native runtimes can no-op LayoutAnimation; expansion still works.
  }
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
  const [expandedNotificationIds, setExpandedNotificationIds] = useState(() => new Set());

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
      triggerHaptic("success");
    } catch (error) {
      triggerHaptic("error");
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
      triggerHaptic("error");
      console.error(error);
    } finally {
      setReadingId(null);
    }
  }, [readingId, user]);

  const handleNotificationPress = useCallback((notification) => {
    if (!notification?.id) return;

    triggerHaptic(notification.readAt ? "selection" : "success");
    configureCardLayoutAnimation();
    setExpandedNotificationIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(notification.id)) {
        nextIds.delete(notification.id);
      } else {
        nextIds.add(notification.id);
      }
      return nextIds;
    });

    if (!notification.readAt) {
      handleMarkAsRead(notification);
    }
  }, [handleMarkAsRead]);

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
    const isExpanded = expandedNotificationIds.has(notification.id);
    const deviceName = notification.deviceName || t("settings.device_screen.unknown_device", lang);
    const platform = notification.platform || t("settings.notifications.unknown_platform", lang);
    const ipAddress = notification.ipAddress || t("settings.notifications.unknown_ip", lang);
    const DeviceIcon = platform === "Web" ? Monitor : DeviceMobile;
    const message = getMessage(notification);
    const formattedDate = formatDate(notification.createdAt);

    return (
      <TouchableOpacity
        key={notification.id}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        activeOpacity={0.74}
        onPress={() => handleNotificationPress(notification)}
        style={[
          styles.notificationCard,
          isExpanded && styles.notificationCardExpanded,
          {
            backgroundColor: themeColors.backgroundColor2,
            borderColor: isUnread ? themeColors.accentColor + "55" : themeColors.borderColor,
          },
        ]}
      >
        {isUnread && (
          <View style={[styles.unreadRail, { backgroundColor: themeColors.accentColor }]} />
        )}

        <View style={[styles.iconContainer, { backgroundColor: themeColors.accentColor + "15" }]}>
          <SignIn size={19} color={themeColors.accentColor} weight={isUnread ? "fill" : "regular"} />
        </View>

        <View style={[styles.notificationContent, isUnread && styles.notificationContentUnread]}>
          <View style={styles.notificationHeader}>
            {isUnread && (
              <View style={[styles.unreadDot, { backgroundColor: themeColors.accentColor }]} />
            )}
            <Text
              style={[styles.notificationTitle, { color: themeColors.textColor }]}
              numberOfLines={isExpanded ? undefined : 1}
            >
              {getTitle(notification)}
            </Text>
          </View>

          {!!message && (
            <Text
              style={[styles.message, isExpanded && styles.messageExpanded, { color: themeColors.textColor2 }]}
              numberOfLines={isExpanded ? undefined : 1}
            >
              {message}
            </Text>
          )}

          <View style={styles.detailBlock}>
            {isExpanded ? (
              <>
                <View style={styles.detailLine}>
                  <DeviceIcon size={13} color={themeColors.textColor2} />
                  <Text style={[styles.detailText, { color: themeColors.textColor2 }]}>
                    {t("settings.notifications.device", lang)}: {deviceName}
                  </Text>
                </View>
                <Text style={[styles.detailText, styles.detailTextIndented, { color: themeColors.textColor2 }]}>
                  {t("settings.notifications.platform", lang)}: {platform}
                </Text>
                <Text style={[styles.detailText, styles.detailTextIndented, { color: themeColors.textColor2 }]}>
                  {t("settings.notifications.ip_address", lang)}: {ipAddress}
                </Text>
                {!!formattedDate && (
                  <Text style={[styles.detailText, styles.detailTextIndented, { color: themeColors.textColor2 }]}>
                    {formattedDate}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.detailLine}>
                <DeviceIcon size={13} color={themeColors.textColor2} />
                <Text style={[styles.detailText, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {platform} - {ipAddress}{formattedDate ? ` - ${formattedDate}` : ""}
                </Text>
              </View>
            )}
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
    paddingTop: 8,
    paddingBottom: 28,
    gap: 9,
  },
  notificationCard: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  notificationCardExpanded: {
    paddingBottom: 13,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },
  unreadRail: {
    position: "absolute",
    top: 10,
    bottom: 10,
    left: 0,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationContentUnread: {
    paddingRight: 27,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  notificationTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  messageExpanded: {
    marginTop: 5,
  },
  detailBlock: {
    marginTop: 6,
    gap: 4,
  },
  detailLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  detailText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  detailTextIndented: {
    flex: 0,
    paddingLeft: 19,
  },
  readIcon: {
    position: "absolute",
    top: 11,
    right: 12,
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

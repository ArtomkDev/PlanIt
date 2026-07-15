import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowCounterClockwise, Bell, CalendarBlank } from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import themes from "../../../config/themes";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { useNotificationDrawer } from "../../../context/NotificationDrawerContext";
import { t } from "../../../utils/i18n";
import { triggerLightHaptic } from "../../../utils/haptics";
import { resolveScheduleColor } from "../../../utils/scheduleColors";
import useNotifications from "../../../hooks/useNotifications";
import SchedulePickerSheet from "./SchedulePickerSheet";

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScaleTouchable({ style, onPressIn, onPressOut, children, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      speed: 28,
      bounciness: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedTouchable
      {...props}
      activeOpacity={1}
      onPressIn={(event) => {
        animateTo(0.96);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedTouchable>
  );
}

export default function Header({ currentDate, onTodayPress, onTitlePress }) {
  const { user, guest, global, schedule, lang } = useScheduleData();
  const { openNotifications } = useNotificationDrawer();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const resetIconPress = useRef(new Animated.Value(0)).current;
  const bellPulse = useRef(new Animated.Value(0)).current;
  const seenUnreadIdsRef = useRef(new Set());
  const didLoadNotificationsRef = useRef(false);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const scheduleColor = resolveScheduleColor(schedule, themeColors.accentColor);
  const locale = t("locale", lang);
  const isToday = isSameDay(currentDate, new Date());
  const notificationsEnabled = !!user?.uid && !guest;
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
  } = useNotifications({
    userId: user?.uid,
    enabled: notificationsEnabled,
  });

  const formattedDate = useMemo(() => {
    const value = currentDate.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [currentDate, locale]);

  const scheduleName = schedule?.name || t("common.schedule", lang);

  const animateResetIcon = (pressed) => {
    if (isToday) return;
    resetIconPress.stopAnimation();
    Animated.spring(resetIconPress, {
      toValue: pressed ? 1 : 0,
      speed: 32,
      bounciness: pressed ? 0 : 4,
      useNativeDriver: true,
    }).start();
  };

  const resetIconRotate = resetIconPress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-32deg"],
  });
  const resetIconScale = resetIconPress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });
  const bellIconScale = bellPulse.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 1.18, 1, 1.12, 1],
  });
  const bellRingScale = bellPulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.8, 1.55, 1.8],
  });
  const bellRingOpacity = bellPulse.interpolate({
    inputRange: [0, 0.18, 0.78, 1],
    outputRange: [0, 0.35, 0.16, 0],
  });

  useEffect(() => {
    if (!notificationsEnabled) {
      seenUnreadIdsRef.current = new Set();
      didLoadNotificationsRef.current = false;
      bellPulse.stopAnimation();
      bellPulse.setValue(0);
      return;
    }

    if (notificationsLoading) return;

    const unreadIds = notifications
      .filter((notification) => !notification.readAt)
      .map((notification) => notification.id);

    if (!didLoadNotificationsRef.current) {
      seenUnreadIdsRef.current = new Set(unreadIds);
      didLoadNotificationsRef.current = true;
      return;
    }

    const hasNewUnread = unreadIds.some((id) => !seenUnreadIdsRef.current.has(id));
    seenUnreadIdsRef.current = new Set(unreadIds);

    if (hasNewUnread) {
      bellPulse.stopAnimation();
      bellPulse.setValue(0);
      Animated.timing(bellPulse, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => bellPulse.setValue(0));
    }
  }, [bellPulse, notifications, notificationsEnabled, notificationsLoading]);

  const openScheduleSettings = (scheduleId = schedule?.id) => {
    if (!scheduleId) return;
    triggerLightHaptic();
    setSchedulePickerVisible(false);
    navigation.navigate("SettingsTab", {
      screen: "ScheduleEditorScreen",
      params: { scheduleId },
    });
  };

  const openNewSchedule = () => {
    setSchedulePickerVisible(false);
    navigation.navigate("SettingsTab", {
      screen: "ScheduleEditorScreen",
      params: { isNew: true },
    });
  };

  const openNotificationInbox = () => {
    if (!notificationsEnabled) return;
    triggerLightHaptic();
    openNotifications();
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 2 }]}>
        <View style={styles.topRow}>
          <ScaleTouchable
            accessibilityRole="button"
            accessibilityLabel={t("schedule.header.switch_schedule", lang)}
            accessibilityHint={t("schedule.header.long_press_hint", lang)}
            onPress={() => setSchedulePickerVisible(true)}
            onLongPress={() => openScheduleSettings()}
            delayLongPress={450}
            style={[
              styles.scheduleButton,
              {
                backgroundColor: themeColors.backgroundColor2,
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            <View style={[styles.scheduleDot, { backgroundColor: scheduleColor }]} />
            <Text
              numberOfLines={1}
              style={[styles.scheduleName, { color: themeColors.textColor }]}
            >
              {scheduleName}
            </Text>
          </ScaleTouchable>

          <View style={styles.dateActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.open_calendar", lang)}
              onPress={onTitlePress}
              activeOpacity={0.68}
              style={styles.dateButton}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.dateText, { color: themeColors.textColor }]}
              >
                {formattedDate}
              </Text>
            </TouchableOpacity>

            <ScaleTouchable
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.open_calendar", lang)}
              onPress={onTitlePress}
              style={styles.iconButton}
            >
              <CalendarBlank
                size={17}
                color={themeColors.accentColor}
                weight="bold"
              />
            </ScaleTouchable>

            {notificationsEnabled && (
              <ScaleTouchable
                accessibilityRole="button"
                accessibilityLabel={t("schedule.header.open_notifications", lang)}
                onPress={openNotificationInbox}
                style={styles.iconButton}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.notificationRing,
                    {
                      borderColor: themeColors.accentColor,
                      opacity: bellRingOpacity,
                      transform: [{ scale: bellRingScale }],
                    },
                  ]}
                />
                <Animated.View style={{ transform: [{ scale: bellIconScale }] }}>
                  <Bell
                    size={17}
                    color={themeColors.accentColor}
                    weight={unreadCount > 0 ? "fill" : "bold"}
                  />
                </Animated.View>
                {unreadCount > 0 && (
                  <View
                    style={[
                      styles.notificationDot,
                      {
                        backgroundColor: themeColors.accentColor,
                        borderColor: themeColors.backgroundColor,
                      },
                    ]}
                  />
                )}
              </ScaleTouchable>
            )}

            <ScaleTouchable
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.today", lang)}
              accessibilityState={{ disabled: isToday }}
              disabled={isToday}
              onPressIn={() => animateResetIcon(true)}
              onPressOut={() => animateResetIcon(false)}
              onPress={() => {
                animateResetIcon(false);
                triggerLightHaptic();
                onTodayPress?.();
              }}
              style={[
                styles.iconButton,
                { opacity: isToday ? 0.52 : 1 },
              ]}
            >
              <Animated.View
                style={{
                  transform: [
                    { rotate: resetIconRotate },
                    { scale: resetIconScale },
                  ],
                }}
              >
                <ArrowCounterClockwise
                  size={17}
                  color={
                    isToday ? themeColors.textColor2 : themeColors.accentColor
                  }
                  weight="bold"
                />
              </Animated.View>
            </ScaleTouchable>
          </View>
        </View>
      </View>

      <SchedulePickerSheet
        visible={schedulePickerVisible}
        onClose={() => setSchedulePickerVisible(false)}
        onEditSchedule={openScheduleSettings}
        onAddSchedule={openNewSchedule}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingBottom: 5,
  },
  topRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleButton: {
    maxWidth: "42%",
    flexShrink: 1,
    minHeight: 30,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  scheduleName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  dateActions: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  dateButton: {
    flexShrink: 1,
    minWidth: 0,
    minHeight: 30,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  dateText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "right",
  },
  iconButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationRing: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  notificationDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});

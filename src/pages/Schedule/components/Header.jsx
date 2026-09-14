import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { ArrowCounterClockwise, Bell, CalendarBlank } from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import themes from "../../../config/themes";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { useNotificationDrawer } from "../../../context/NotificationDrawerContext";
import { t } from "../../../utils/i18n";
import { triggerHaptic } from "../../../utils/haptics";
import { getScheduleDisplayName } from "../../../utils/scheduleDisplay";
import {
  resolveScheduleColor,
  scheduleColorWithAlpha,
} from "../../../utils/scheduleColors";
import useNotifications from "../../../hooks/useNotifications";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import ScheduleIcon from "../../../components/ScheduleIcon";
import SchedulePickerSheet from "./SchedulePickerSheet";

const COMPACT_SCHEDULE_BUTTON_SIZE = 44;
const SCHEDULE_ICON_SIZE = 24;
const SCHEDULE_ICON_GAP = 8;
const SCHEDULE_BUTTON_HORIZONTAL_PADDING = 10;
const SCHEDULE_BUTTON_BORDER_WIDTH = 1;
const DATE_ACTION_BUTTON_SIZE = 44;
const DATE_ACTION_GAP = 6;
const DATE_ACTIONS_MARGIN = 12;
const MIN_READABLE_DATE_TEXT_WIDTH = 96;
const MIN_DATE_FONT_SCALE = 0.8;

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScaleTouchable({ style, onPressIn, onPressOut, children, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotionPreference();

  const animateTo = (value) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
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
  const { user, guest, global: globalSettings, schedule, lang } = useScheduleData();
  const { openNotifications, drawerProgress } = useNotificationDrawer();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);
  const reduceMotion = useReducedMotionPreference();
  const resetIconPress = useRef(new Animated.Value(0)).current;
  const bellPulse = useRef(new Animated.Value(0)).current;
  const seenUnreadIdsRef = useRef(new Set());
  const didLoadNotificationsRef = useRef(false);
  const [topRowWidth, setTopRowWidth] = useState(0);
  const [scheduleNameMeasurement, setScheduleNameMeasurement] = useState({
    value: null,
    width: 0,
  });
  const [dateTextMeasurement, setDateTextMeasurement] = useState({
    value: null,
    width: 0,
  });

  const [mode, accent] = globalSettings?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const scheduleButtonColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      drawerProgress?.value ?? 0,
      [0, 1],
      [themeColors.backgroundColor2, themeColors.backgroundColor]
    ),
  }), [themeColors.backgroundColor, themeColors.backgroundColor2]);
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

  const scheduleName = schedule
    ? getScheduleDisplayName(schedule, lang, t("common.schedule", lang))
    : t("common.schedule", lang);
  const measuredScheduleNameWidth = scheduleNameMeasurement.value === scheduleName
    ? scheduleNameMeasurement.width
    : 0;
  const measuredDateTextWidth = dateTextMeasurement.value === formattedDate
    ? dateTextMeasurement.width
    : 0;
  const dateActionCount = notificationsEnabled ? 3 : 2;
  const fixedDateActionsWidth = (
    dateActionCount * DATE_ACTION_BUTTON_SIZE
    + dateActionCount * DATE_ACTION_GAP
  );
  const reservedDateTextWidth = measuredDateTextWidth > 0
    ? Math.min(
      measuredDateTextWidth,
      Math.max(
        MIN_READABLE_DATE_TEXT_WIDTH,
        measuredDateTextWidth * MIN_DATE_FONT_SCALE,
      ),
    )
    : MIN_READABLE_DATE_TEXT_WIDTH;
  const availableScheduleWidth = Math.max(
    COMPACT_SCHEDULE_BUTTON_SIZE,
    topRowWidth
      - DATE_ACTIONS_MARGIN
      - fixedDateActionsWidth
      - reservedDateTextWidth,
  );
  const expandedScheduleWidth = (
    measuredScheduleNameWidth
    + SCHEDULE_ICON_SIZE
    + SCHEDULE_ICON_GAP
    + SCHEDULE_BUTTON_HORIZONTAL_PADDING * 2
    + SCHEDULE_BUTTON_BORDER_WIDTH * 2
  );
  const isScheduleCompact = (
    topRowWidth === 0
    || measuredScheduleNameWidth === 0
    || expandedScheduleWidth > availableScheduleWidth
  );

  const animateResetIcon = (pressed) => {
    if (isToday) return;
    if (reduceMotion) {
      resetIconPress.setValue(0);
      return;
    }
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
      triggerHaptic("notification", { key: "new-unread-notification" });
      bellPulse.stopAnimation();
      bellPulse.setValue(0);
      if (reduceMotion) {
        return;
      }
      Animated.timing(bellPulse, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => bellPulse.setValue(0));
    }
  }, [bellPulse, notifications, notificationsEnabled, notificationsLoading, reduceMotion]);

  const openScheduleSettings = (scheduleId = schedule?.id) => {
    if (!scheduleId) return;
    triggerHaptic("longPress");
    setSchedulePickerVisible(false);
    navigation.navigate("SettingsTab", {
      screen: "ScheduleEditorScreen",
      params: { scheduleId },
    });
  };

  const openNewSchedule = () => {
    triggerHaptic("open");
    setSchedulePickerVisible(false);
    navigation.navigate("SettingsTab", {
      screen: "ScheduleEditorScreen",
      params: { isNew: true },
    });
  };

  const openNotificationInbox = () => {
    if (!notificationsEnabled) return;
    openNotifications();
  };

  const openSchedulePicker = () => {
    triggerHaptic("open");
    setSchedulePickerVisible(true);
  };

  const openCalendar = () => {
    triggerHaptic("open");
    onTitlePress?.();
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 2 }]}>
        <View
          style={styles.topRow}
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            setTopRowWidth((currentWidth) => (
              currentWidth === nextWidth ? currentWidth : nextWidth
            ));
          }}
        >
          <ScaleTouchable
            accessibilityRole="button"
            accessibilityLabel={`${t("schedule.header.switch_schedule", lang)}: ${scheduleName}`}
            accessibilityHint={t("schedule.header.long_press_hint", lang)}
            onPress={openSchedulePicker}
            onLongPress={() => openScheduleSettings()}
            delayLongPress={450}
            style={[
              styles.scheduleButton,
              {
                backgroundColor: isScheduleCompact
                  ? "transparent"
                  : themeColors.backgroundColor2,
                borderColor: isScheduleCompact
                  ? "transparent"
                  : themeColors.borderColor,
                maxWidth: availableScheduleWidth,
              },
              isScheduleCompact && styles.scheduleButtonCompact,
            ]}
          >
            {!isScheduleCompact && (
              <Reanimated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  scheduleButtonColorStyle,
                ]}
              />
            )}
            <ScheduleIcon
              icon={schedule?.icon}
              name={scheduleName}
              size={isScheduleCompact ? COMPACT_SCHEDULE_BUTTON_SIZE : SCHEDULE_ICON_SIZE}
              iconSize={isScheduleCompact ? 26 : 15}
              backgroundColor={scheduleColorWithAlpha(scheduleColor, 0.16)}
              color={scheduleColor}
              style={!isScheduleCompact ? styles.scheduleIcon : undefined}
            />
            {!isScheduleCompact && (
              <Text
                numberOfLines={1}
                style={[styles.scheduleName, { color: themeColors.textColor }]}
              >
                {scheduleName}
              </Text>
            )}
          </ScaleTouchable>

          <View style={styles.dateActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.open_calendar", lang)}
              onPress={openCalendar}
              activeOpacity={0.68}
              style={styles.dateButton}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={MIN_DATE_FONT_SCALE}
                style={[styles.dateText, { color: themeColors.textColor }]}
              >
                {formattedDate}
              </Text>
            </TouchableOpacity>

            <ScaleTouchable
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.open_calendar", lang)}
              onPress={openCalendar}
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
                triggerHaptic("success");
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

          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.measurementLayer}
          >
            <Text
              key={`schedule-name-measurement:${scheduleName}`}
              numberOfLines={1}
              onLayout={(event) => {
                const nextWidth = Math.ceil(event.nativeEvent.layout.width);
                setScheduleNameMeasurement((currentMeasurement) => (
                  currentMeasurement.value === scheduleName
                  && currentMeasurement.width === nextWidth
                    ? currentMeasurement
                    : { value: scheduleName, width: nextWidth }
                ));
              }}
              style={[styles.scheduleName, styles.measurementText]}
            >
              {scheduleName}
            </Text>
            <Text
              key={`date-text-measurement:${formattedDate}`}
              numberOfLines={1}
              onLayout={(event) => {
                const nextWidth = Math.ceil(event.nativeEvent.layout.width);
                setDateTextMeasurement((currentMeasurement) => (
                  currentMeasurement.value === formattedDate
                  && currentMeasurement.width === nextWidth
                    ? currentMeasurement
                    : { value: formattedDate, width: nextWidth }
                ));
              }}
              style={[styles.dateText, styles.measurementText]}
            >
              {formattedDate}
            </Text>
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
    position: "relative",
  },
  scheduleButton: {
    flexShrink: 0,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  scheduleButtonCompact: {
    width: COMPACT_SCHEDULE_BUTTON_SIZE,
    height: COMPACT_SCHEDULE_BUTTON_SIZE,
    borderRadius: 15,
    borderWidth: 0,
    paddingHorizontal: 0,
    justifyContent: "center",
  },
  scheduleIcon: {
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
    minHeight: 44,
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
    width: 44,
    height: 44,
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
  measurementLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0,
    alignItems: "flex-start",
  },
  measurementText: {
    flexShrink: 0,
    alignSelf: "flex-start",
  },
});

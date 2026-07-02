import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarBlank, CaretDown } from "phosphor-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import themes from "../../../config/themes";
import { useSchedule } from "../../../context/ScheduleProvider";
import { t } from "../../../utils/i18n";
import { triggerLightHaptic } from "../../../utils/haptics";
import {
  resolveScheduleColor,
  scheduleColorWithAlpha,
} from "../../../utils/scheduleColors";
import SchedulePickerSheet from "./SchedulePickerSheet";

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export default function Header({ currentDate, onTodayPress, onTitlePress }) {
  const { global, schedule, schedules, lang } = useSchedule();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [schedulePickerVisible, setSchedulePickerVisible] = useState(false);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const scheduleColor = resolveScheduleColor(schedule, themeColors.accentColor);
  const locale = t("locale", lang);
  const today = useMemo(() => new Date(), [currentDate]);
  const isToday = isSameDay(currentDate, today);

  const formattedDate = useMemo(() => {
    const value = currentDate.toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [currentDate, locale]);

  const scheduleName = schedule?.name || t("common.schedule", lang);

  const openScheduleSettings = (scheduleId = schedule?.id) => {
    if (!scheduleId) return;
    triggerLightHaptic();
    setSchedulePickerVisible(false);
    navigation.navigate("SettingsTab", {
      screen: "ScheduleEditorScreen",
      params: { scheduleId },
    });
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("schedule.header.switch_schedule", lang)}
            accessibilityHint={t("schedule.header.long_press_hint", lang)}
            onPress={() => setSchedulePickerVisible(true)}
            onLongPress={() => openScheduleSettings()}
            delayLongPress={450}
            activeOpacity={0.72}
            style={[
              styles.scheduleButton,
              {
                backgroundColor: scheduleColorWithAlpha(scheduleColor, 0.12),
                borderColor: scheduleColorWithAlpha(scheduleColor, 0.38),
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
            {schedules.length > 1 && (
              <CaretDown size={15} color={themeColors.textColor2} weight="bold" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("schedule.header.open_calendar", lang)}
            onPress={onTitlePress}
            activeOpacity={0.72}
            style={[
              styles.calendarButton,
              {
                backgroundColor: themeColors.backgroundColor3,
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            <CalendarBlank size={20} color={themeColors.accentColor} weight="bold" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("schedule.header.open_calendar", lang)}
            onPress={onTitlePress}
            activeOpacity={0.7}
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

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: isToday }}
            onPress={onTodayPress}
            activeOpacity={0.72}
            style={[
              styles.todayButton,
              {
                backgroundColor: isToday
                  ? themeColors.accentColorLight
                  : themeColors.accentColor,
              },
            ]}
          >
            <Text
              style={[
                styles.todayText,
                { color: isToday ? themeColors.accentColor : "#fff" },
              ]}
            >
              {t("schedule.header.today", lang)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <SchedulePickerSheet
        visible={schedulePickerVisible}
        onClose={() => setSchedulePickerVisible(false)}
        onEditSchedule={openScheduleSettings}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 5,
  },
  topRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleButton: {
    maxWidth: "78%",
    minHeight: 36,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 11,
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
    marginRight: 7,
  },
  calendarButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: {
    minHeight: 48,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 12,
  },
  dateText: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  todayButton: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  todayText: {
    fontSize: 13,
    fontWeight: "800",
  },
});

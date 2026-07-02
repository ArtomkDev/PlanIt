import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  X,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppBlur from "../ui/AppBlur";
import themes from "../../config/themes";
import { useSchedule } from "../../context/ScheduleProvider";
import { triggerLightHaptic } from "../../utils/haptics";
import { t } from "../../utils/i18n";
import CalendarGrid from "./CalendarGrid";
import { useCalendarLogic } from "./useCalendarLogic";

export default function CalendarSheet({
  visible,
  onClose,
  onDateSelect,
  currentDate,
  customSchedule,
}) {
  const { global, schedule: activeSchedule, lang } = useSchedule();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const effectiveSchedule = customSchedule || activeSchedule;

  const {
    viewDate,
    calendarDays,
    weekDayNames,
    nextMonth,
    prevMonth,
    getWeekNumber,
    setMonth,
    setYear,
  } = useCalendarLogic(currentDate, effectiveSchedule);

  useEffect(() => {
    if (visible) setIsMonthPickerOpen(false);
  }, [visible]);

  const monthNames = useMemo(
    () => [
      t("common.months.jan", lang),
      t("common.months.feb", lang),
      t("common.months.mar", lang),
      t("common.months.apr", lang),
      t("common.months.may", lang),
      t("common.months.jun", lang),
      t("common.months.jul", lang),
      t("common.months.aug", lang),
      t("common.months.sep", lang),
      t("common.months.oct", lang),
      t("common.months.nov", lang),
      t("common.months.dec", lang),
    ],
    [lang]
  );

  const selectedDateLabel = useMemo(
    () =>
      currentDate.toLocaleDateString(t("locale", lang), {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [currentDate, lang]
  );

  const selectDate = (date) => {
    triggerLightHaptic();
    onDateSelect(date);
    onClose();
  };

  const selectToday = () => selectDate(new Date());

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close", lang)}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.sheet,
            {
              height: Math.min(height * 0.82, 640),
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: themeColors.backgroundColor2,
            },
          ]}
        >
          <AppBlur style={StyleSheet.absoluteFill} intensity={88} />

          <View style={[styles.handle, { backgroundColor: themeColors.textColor3 }]} />

          <View style={styles.sheetHeader}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("common.close", lang)}
              onPress={onClose}
              activeOpacity={0.7}
              style={[styles.roundButton, { backgroundColor: themeColors.backgroundColor3 }]}
            >
              <X size={20} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>

            <View style={styles.headerCopy}>
              <Text style={[styles.sheetTitle, { color: themeColors.textColor }]}>
                {t("schedule.calendar.title", lang)}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.selectedDate, { color: themeColors.textColor2 }]}
              >
                {selectedDateLabel}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("schedule.header.today", lang)}
              onPress={selectToday}
              activeOpacity={0.7}
              style={[styles.todayButton, { backgroundColor: themeColors.accentColorLight }]}
            >
              <CalendarBlank size={17} color={themeColors.accentColor} weight="bold" />
              <Text style={[styles.todayText, { color: themeColors.accentColor }]}>
                {t("schedule.header.today", lang)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.monthNavigation}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("schedule.calendar.previous_month", lang)}
              onPress={prevMonth}
              activeOpacity={0.7}
              style={[styles.monthArrow, { backgroundColor: themeColors.backgroundColor4 }]}
            >
              <CaretLeft size={21} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: isMonthPickerOpen }}
              onPress={() => setIsMonthPickerOpen((value) => !value)}
              activeOpacity={0.7}
              style={[
                styles.monthTitleButton,
                {
                  backgroundColor: isMonthPickerOpen
                    ? themeColors.accentColorLight
                    : "transparent",
                },
              ]}
            >
              <Text style={[styles.monthTitle, { color: themeColors.textColor }]}>
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </Text>
              {isMonthPickerOpen ? (
                <CaretUp size={17} color={themeColors.accentColor} weight="bold" />
              ) : (
                <CaretDown size={17} color={themeColors.accentColor} weight="bold" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("schedule.calendar.next_month", lang)}
              onPress={nextMonth}
              activeOpacity={0.7}
              style={[styles.monthArrow, { backgroundColor: themeColors.backgroundColor4 }]}
            >
              <CaretRight size={21} color={themeColors.textColor} weight="bold" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {isMonthPickerOpen ? (
              <View style={styles.pickerContainer}>
                <View style={styles.yearNavigation}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t("schedule.calendar.previous_year", lang)}
                    onPress={() => setYear(viewDate.getFullYear() - 1)}
                    activeOpacity={0.7}
                    style={[styles.yearArrow, { backgroundColor: themeColors.backgroundColor4 }]}
                  >
                    <CaretLeft size={20} color={themeColors.textColor} weight="bold" />
                  </TouchableOpacity>

                  <Text style={[styles.yearTitle, { color: themeColors.textColor }]}>
                    {viewDate.getFullYear()}
                  </Text>

                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t("schedule.calendar.next_year", lang)}
                    onPress={() => setYear(viewDate.getFullYear() + 1)}
                    activeOpacity={0.7}
                    style={[styles.yearArrow, { backgroundColor: themeColors.backgroundColor4 }]}
                  >
                    <CaretRight size={20} color={themeColors.textColor} weight="bold" />
                  </TouchableOpacity>
                </View>

                <View style={styles.monthsGrid}>
                  {monthNames.map((name, index) => {
                    const isSelected = index === viewDate.getMonth();
                    return (
                      <TouchableOpacity
                        key={name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${name} ${viewDate.getFullYear()}`}
                        onPress={() => {
                          setMonth(index);
                          setIsMonthPickerOpen(false);
                        }}
                        activeOpacity={0.72}
                        style={[
                          styles.monthItem,
                          {
                            backgroundColor: isSelected
                              ? themeColors.accentColor
                              : themeColors.backgroundColor4,
                            borderColor: isSelected
                              ? themeColors.accentColor
                              : themeColors.borderColor,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={[
                            styles.monthItemText,
                            { color: isSelected ? "#fff" : themeColors.textColor },
                          ]}
                        >
                          {name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <CalendarGrid
                days={calendarDays}
                weekDayNames={weekDayNames}
                getWeekNumber={getWeekNumber}
                currentSelectedDate={currentDate}
                weekLabel={t("schedule.calendar.week_short", lang)}
                onSelectDate={selectDate}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 8, 15, 0.5)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingHorizontal: 14,
    ...Platform.select({
      web: { boxShadow: "0 -12px 40px rgba(0,0,0,0.16)" },
      default: {
        elevation: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      },
    }),
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 11,
    opacity: 0.7,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  selectedDate: {
    maxWidth: "100%",
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  todayButton: {
    minHeight: 36,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  todayText: {
    fontSize: 12,
    fontWeight: "800",
  },
  monthNavigation: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitleButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    marginHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  pickerContainer: {
    flex: 1,
    paddingTop: 8,
  },
  yearNavigation: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  yearArrow: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  yearTitle: {
    width: 120,
    textAlign: "center",
    fontSize: 25,
    fontWeight: "800",
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  monthItem: {
    width: "31.5%",
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  monthItemText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

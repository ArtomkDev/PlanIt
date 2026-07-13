import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  PanResponder,
  Animated,
} from "react-native";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  X,
} from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheet from "../ui/BottomSheet";
import themes from "../../config/themes";
import { useScheduleData } from "../../context/ScheduleProvider";
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
  const { global, schedule: activeSchedule, lang } = useScheduleData();
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

  const slideOpacity = useRef(new Animated.Value(1)).current;
  const slideTranslateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    if (isAnimating.current) {
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(slideOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(slideTranslateX, {
            toValue: 0,
            speed: 24,
            bounciness: 4,
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
        });
      });
    }
  }, [viewDate]);

  const isTodaySelected = useMemo(() => {
    const today = new Date();
    return (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getDate() === today.getDate()
    );
  }, [currentDate]);

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

  const handleAnimatedMonthChange = (direction) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    triggerLightHaptic();

    Animated.parallel([
      Animated.timing(slideOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideTranslateX, {
        toValue: direction * -35,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideTranslateX.setValue(direction * 35);
      if (direction === 1) nextMonth();
      else prevMonth();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 15 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderRelease: (evt, gestureState) => {
          if (gestureState.dx > 40) {
            handleAnimatedMonthChange(-1);
          } else if (gestureState.dx < -40) {
            handleAnimatedMonthChange(1);
          }
        },
      }),
    [nextMonth, prevMonth]
  );

  const snapPoints = [Math.min(height * 0.58, 450), Math.min(height * 0.82, 640)];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnapIndex={1}
      maxWidth={680}
      backgroundColor={themeColors.backgroundColor2}
      handleColor={themeColors.textColor3}
      accessibilityLabel={t("schedule.calendar.title", lang)}
      closeAccessibilityLabel={t("common.close", lang)}
      testID="calendar-sheet"
      contentStyle={[
        styles.sheetContent,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
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
          disabled={isTodaySelected}
          onPress={selectToday}
          activeOpacity={0.7}
          style={[
            styles.todayButton,
            {
              backgroundColor: isTodaySelected
                ? themeColors.backgroundColor3
                : themeColors.accentColorLight,
            },
          ]}
        >
          <ArrowCounterClockwise
            size={17}
            color={isTodaySelected ? themeColors.textColor3 : themeColors.accentColor}
            weight="bold"
          />
          <Text
            style={[
              styles.todayText,
              { color: isTodaySelected ? themeColors.textColor3 : themeColors.accentColor },
            ]}
          >
            {t("schedule.header.today", lang)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthNavigation}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("schedule.calendar.previous_month", lang)}
          onPress={() => handleAnimatedMonthChange(-1)} 
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
          onPress={() => handleAnimatedMonthChange(1)} 
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
          <Animated.View
            style={[
              styles.gridWrapper,
              {
                opacity: slideOpacity,
                transform: [{ translateX: slideTranslateX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <CalendarGrid
              days={calendarDays}
              weekDayNames={weekDayNames}
              getWeekNumber={getWeekNumber}
              currentSelectedDate={currentDate}
              weekLabel={t("schedule.calendar.week_short", lang)}
              onSelectDate={selectDate}
            />
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 14,
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
  gridWrapper: {
    flex: 1,
    justifyContent: "center",
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

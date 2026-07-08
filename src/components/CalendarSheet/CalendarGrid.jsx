import React, { useMemo, useRef, useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Animated, Easing } from "react-native";

import themes from "../../config/themes";
import { useSchedule } from "../../context/ScheduleProvider";

const sameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const DayCell = React.memo(({ day, today, currentSelectedDate, themeColors, onSelectDate }) => {
  const isToday = sameDay(day.date, today);
  const isSelected = sameDay(day.date, currentSelectedDate);

  const selectionOpacity = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    selectionOpacity.stopAnimation();
    Animated.timing(selectionOpacity, {
      toValue: isSelected ? 1 : 0,
      duration: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const baseTextColor = day.isCurrentMonth ? themeColors.textColor : themeColors.textColor3;

  return (
    <View style={styles.daySlot}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        onPress={() => onSelectDate(day.date)}
        activeOpacity={0.68}
        style={[
          styles.dayButton,
          !isSelected && isToday && {
            borderColor: themeColors.accentColor,
            borderWidth: 1.5,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.selectedBg,
            {
              backgroundColor: themeColors.accentColor,
              opacity: selectionOpacity,
            },
          ]}
        />

        <View style={styles.centerContent}>
          <Text
            style={[
              styles.dayText,
              { color: baseTextColor, fontWeight: isToday ? "800" : "600" },
            ]}
          >
            {day.date.getDate()}
          </Text>
          {isToday && (
            <View style={[styles.todayDot, { backgroundColor: themeColors.accentColor }]} />
          )}
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.centerContent,
            { opacity: selectionOpacity },
          ]}
        >
          <Text style={[styles.dayText, { color: "#fff", fontWeight: "800" }]}>
            {day.date.getDate()}
          </Text>
          {isToday && (
            <View style={[styles.todayDot, { backgroundColor: "#fff" }]} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
});

export default function CalendarGrid({
  days,
  onSelectDate,
  currentSelectedDate,
  getWeekNumber,
  weekDayNames,
  weekLabel,
}) {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const today = useMemo(() => new Date(), []);
  const showWeekNumbers = getWeekNumber(today) !== null;

  const weeks = useMemo(() => {
    const result = [];
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7));
    }
    return result;
  }, [days]);

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        {showWeekNumbers && (
          <View style={styles.weekNumberColumn}>
            <Text style={[styles.weekLabel, { color: themeColors.textColor3 }]}>
              {weekLabel}
            </Text>
          </View>
        )}

        {weekDayNames.map((name, index) => (
          <View key={`${name}-${index}`} style={styles.daySlot}>
            <Text style={[styles.dayName, { color: themeColors.textColor2 }]}>
              {name.replace(".", "")}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => {
        const weekNumber = showWeekNumbers ? getWeekNumber(week[0].date) : null;

        return (
          <View key={weekIndex} style={styles.weekRow}>
            {showWeekNumbers && (
              <View style={styles.weekNumberColumn}>
                <View style={[styles.weekBadge, { backgroundColor: themeColors.accentColorLight }]}>
                  <Text style={[styles.weekNumber, { color: themeColors.accentColor }]}>
                    {weekNumber}
                  </Text>
                </View>
              </View>
            )}

            {week.map((day) => (
              <DayCell
                key={day.date.toISOString()}
                day={day}
                today={today}
                currentSelectedDate={currentSelectedDate}
                themeColors={themeColors}
                onSelectDate={onSelectDate}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 520,
    paddingHorizontal: 2,
  },
  weekHeader: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
  },
  weekRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
  },
  weekNumberColumn: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weekBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  weekNumber: {
    fontSize: 11,
    fontWeight: "800",
  },
  daySlot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dayButton: {
    width: "88%",
    maxWidth: 42,
    aspectRatio: 1,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBg: {
    borderRadius: 15,
  },
  centerContent: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 15,
  },
  todayDot: {
    position: "absolute",
    bottom: 5,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});
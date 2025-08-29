import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";

export default function NavigationButtons({ changeDate, currentDate }) {
  const { schedule } = useSchedule();

  if (!schedule) return null;

  const [mode, accent] = schedule.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const daysOfWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

  const getNext7Days = () => {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
      days.push({
        label: daysOfWeek[dayIndex],
        date,
      });
    }
    return days;
  };

  const weekDays = getNext7Days();

  return (
    <View style={styles.navigationContainer}>
      {weekDays.map((day, index) => {
        const isActive = day.date.toDateString() === currentDate.toDateString();
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.navButton,
              {
                backgroundColor: isActive
                  ? themeColors.accentColor
                  : themeColors.backgroundColor2,
              },
            ]}
            onPress={() => changeDate(day.date)}
          >
            <Text style={styles.navButtonText}>{day.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navigationContainer: {
    width: 70,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    paddingTop: 94,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 6,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});

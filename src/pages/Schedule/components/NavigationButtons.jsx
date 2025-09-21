import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useEditor } from "../../../context/EditorProvider"; // 🔥 новий хук
import themes from "../../../config/themes";

export default function NavigationButtons({ changeDate, currentDate }) {
  const { global, schedule } = useSchedule();
  const { isEditing, toggleEditing } = useEditor();

  if (!schedule) return null;

  const [mode, accent] = global?.theme || ["light", "blue"];
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

      {/* Кнопка редагування */}
      <TouchableOpacity
        style={[
          styles.editButton,
          { backgroundColor: isEditing ? themeColors.accentColor : themeColors.backgroundColor2 },
        ]}
        onPress={toggleEditing}
      >
        <Text style={styles.editText}>✎</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navigationContainer: {
    width: 70,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingVertical: 20,
    paddingTop: 94,
  },
  editButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  editText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
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

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes"; // ✅ підключаємо твої теми

export default function Header({ daysOfWeek, currentDate, getDayIndex }) {
  const { schedule } = useSchedule();

  if (!schedule) return null;

  // дістаємо режим та акцент з масиву ['dark', 'blue']
  const [mode, accent] = schedule.theme || ["light", "blue"];

  // готова палітра кольорів
  const themeColors = themes.getColors(mode, accent);

  return (
    <View style={styles.headerContainer}>
      <Text style={[styles.dayOfWeekText, { color: themeColors.textColor }]}>
        {daysOfWeek[getDayIndex(currentDate)]}
      </Text>
      <Text style={[styles.dateText, { color: themeColors.textColor }]}>
        {currentDate.toLocaleDateString("uk-UA")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  dayOfWeekText: { fontSize: 20, fontWeight: "bold" },
  dateText: { fontSize: 16 },
});

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes"; // ✅ беремо готові теми

export default function NavigationButtons({ changeDate }) {
  const { schedule } = useSchedule();

  if (!schedule) return null;

  const [mode, accent] = schedule.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  return (
    <View style={styles.navigationContainer}>
      <TouchableOpacity
        style={[
          styles.navButton,
          { backgroundColor: themeColors.backgroundColor2 },
        ]}
        onPress={() => changeDate(-1)}
      >
        <Text style={styles.navButtonText}>Назад</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.navButton,
          { backgroundColor: themeColors.backgroundColor2 },
        ]}
        onPress={() => changeDate(1)}
      >
        <Text style={styles.navButtonText}>Вперед</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  navButton: {
    padding: 10,
    borderRadius: 5,
  },
  navButtonText: { color: "#fff", fontSize: 16 },
});

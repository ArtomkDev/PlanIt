import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import DaySchedule from "./components/DaySchedule";
import Header from "./components/Header";
import NavigationButtons from "./components/NavigationButtons";
import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

export default function Schedule() {
  const { schedule } = useSchedule();
  const [currentDate, setCurrentDate] = useState(new Date());

  if (!schedule) {
    return (
      <View style={styles.container}>
        <Text>Розклад не завантажено</Text>
      </View>
    );
  }

  const [themeMode, accentName] = schedule.theme || ["light", "blue"];
  const themeColors = themes[themeMode];

  const changeDate = (newDate) => setCurrentDate(newDate);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      {/* Хедер */}
      <View style={styles.headerWrapper}>
        <Header currentDate={currentDate} />
      </View>

      <View style={styles.contentRow}>
        {/* Навігація по днях */}
        <View style={[styles.navPanel, { backgroundColor: themeColors.backgroundColor4 }]}>
          <NavigationButtons changeDate={changeDate} currentDate={currentDate} />
        </View>

        {/* Контент з розкладом */}
        <View style={styles.mainContent}>
          <DayScheduleProvider date={currentDate}>
            <DaySchedule />
          </DayScheduleProvider>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  contentRow: {
    flexDirection: "row",
    flex: 1,
  },
  navPanel: {
    width: 70,
    backgroundColor: "#222",
  },
  mainContent: {
    flex: 1,
  },
});

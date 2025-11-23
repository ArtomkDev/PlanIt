import React, { useState, useRef } from "react";
import { StyleSheet, View, Animated } from "react-native"; // Додаємо Animated
import DaySchedule from "./components/DaySchedule";
import Header from "./components/Header";
import NavigationButtons from "./components/NavigationButtons";
import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

export default function Schedule() {
  const { global, schedule } = useSchedule();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 🔥 Створюємо спільне значення скролу
  const scrollY = useRef(new Animated.Value(0)).current;

  if (!schedule) {
    return (
      <View style={styles.container}>
        <Text>Розклад не завантажено</Text>
      </View>
    );
  }

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const changeDate = (newDate) => setCurrentDate(newDate);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      {/* Хедер отримує scrollY для анімації прозорості */}
      <View style={styles.headerWrapper}>
        <Header currentDate={currentDate} scrollY={scrollY} />
      </View>

      <View style={styles.contentRow}>
        <View style={[styles.navPanel, { backgroundColor: themeColors.backgroundColor4 }]}>
          <NavigationButtons changeDate={changeDate} currentDate={currentDate} />
        </View>

        <View style={styles.mainContent}>
          <DayScheduleProvider date={currentDate}>
            {/* DaySchedule отримує обробник скролу */}
            <DaySchedule scrollY={scrollY} />
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
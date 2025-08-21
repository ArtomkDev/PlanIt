import React from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";

export default function DaySchedule() {
  const { currentDate, getDaySchedule, subjects, lessonTimes, teachers } =
    useDaySchedule();

  // отримуємо масив предметів для поточного дня
  const scheduleForDay = getDaySchedule(currentDate);
  
  return (
    <View style={styles.dayContainer}>
      {scheduleForDay.length > 0 ? (
        scheduleForDay.map((subjectId, index) => {
          const subject = subjects.find((s) => s.id === subjectId);
          const teacher = teachers.find((t) => t.id === subject?.teacher);
          const timeInfo = lessonTimes?.[index] || {};
          const subjectColor =
            themes.accentColors[subject?.color] || themes.accentColors.grey;

          return (
            <View
              key={index}
              style={[
                styles.subjectContainer,
                { backgroundColor: subjectColor },
              ]}
            >
              <Text style={styles.subjectName}>{subject?.name || "—"}</Text>
              {timeInfo.start && timeInfo.end && (
                <Text style={styles.lessonTime}>
                  {timeInfo.start} - {timeInfo.end}
                </Text>
              )}
              <Text style={styles.subjectDetails}>
                Викладач: {teacher?.name || "—"}
              </Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.noDataText}>Немає даних на цей день</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dayContainer: { flex: 1 },
  subjectContainer: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  lessonTime: {
    fontSize: 14,
  },
  subjectDetails: {
    fontSize: 14,
  },
  noDataText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

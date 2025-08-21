// src/pages/Schedule/components/DaySchedule.jsx
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";

// ✅ Допоміжна функція для додавання хвилин
function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minsToAdd);
  return date.toTimeString().slice(0, 5); // формат HH:MM
}

// ✅ Генерація часів занять
function buildLessonTimes(startTime, duration, breaks, lessonsCount) {
  if (!startTime || !duration) return [];

  let times = [];
  let currentStart = startTime;

  for (let i = 0; i < lessonsCount; i++) {
    const end = addMinutes(currentStart, duration);
    times.push({ start: currentStart, end });
    currentStart = addMinutes(end, breaks?.[i] || 0);
  }

  return times;
}

export default function DaySchedule() {
  const { currentDate, getDaySchedule } = useDaySchedule();
  const { schedule } = useSchedule();

  // ✅ дістаємо дані через крапку
  const {
    start_time = "08:30",
    duration = 45,
    breaks = [],
    subjects = [],
    teachers = [],
  } = schedule || {};

  // Отримуємо предмети на цей день
  const scheduleForDay = getDaySchedule ? getDaySchedule(currentDate) : [];

  // Генеруємо часи уроків
  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay.length);
  }, [start_time, duration, breaks, scheduleForDay]);

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
              style={[styles.subjectContainer, { backgroundColor: subjectColor }]}
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
});

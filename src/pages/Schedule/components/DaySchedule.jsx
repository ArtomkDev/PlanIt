import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useSchedule } from "../../../context/ScheduleProvider";
import LessonEditor from "./LessonEditor";
import themes from "../../../config/themes";

// допоміжна функція — додає хвилини до часу
function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minsToAdd);
  return date.toTimeString().slice(0, 5);
}

// рахує час початку/кінця пар
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
  const { schedule, isEditing } = useSchedule();

  const {
    start_time = "08:30",
    duration = 45,
    breaks = [],
    subjects = [],
    teachers = [],
  } = schedule || {};

  // ⚡️ тепер тут зберігаються тільки id предметів
  // приклад: [ "math", "physics", null, "history" ]
  const scheduleForDay = getDaySchedule ? getDaySchedule(currentDate) : [];

  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay.length);
  }, [start_time, duration, breaks, scheduleForDay]);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);

  const openEditor = (lesson) => {
    setEditingLesson(lesson);
    setEditorVisible(true);
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setEditingLesson(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {scheduleForDay.length > 0 ? (
          scheduleForDay.map((subjectId, index) => {
            const subject = subjects.find((s) => s.id === subjectId);
            const teacher = teachers.find((t) => t.id === subject?.teacher);
            const timeInfo = lessonTimes?.[index] || {};
            const subjectColor =
              themes.accentColors[subject?.color] || themes.accentColors.grey;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.card, { backgroundColor: subjectColor + "CC" }]}
                activeOpacity={0.8}
                onPress={() => openEditor({ subjectId, index })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTime}>
                    {timeInfo.start || "—"} - {timeInfo.end || "—"}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{subject?.name || "—"}</Text>
                  <Text style={styles.cardTeacher}>{teacher?.name || "—"}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.noData}>Немає пар на цей день</Text>
        )}

        {isEditing && (
          <TouchableOpacity
            style={styles.addCard}
            onPress={() => openEditor(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.plus}>＋</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <LessonEditor lesson={editingLesson} onClose={closeEditor} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 90 },
  scrollContent: { padding: 10, paddingBottom: 40 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: { alignItems: "flex-end" },
  cardTime: { fontSize: 13, fontWeight: "500", color: "#fff" },
  cardBody: { marginTop: 5 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  cardTeacher: { fontSize: 14, color: "#f0f0f0", marginTop: 2 },
  noData: { textAlign: "center", marginTop: 20, fontSize: 16, color: "#666" },

  addCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#aaa",
    justifyContent: "center",
    alignItems: "center",
    height: 80,
    backgroundColor: "transparent",
  },
  plus: { fontSize: 32, color: "#aaa", fontWeight: "300" },
});

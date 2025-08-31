import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  RefreshControl,
  Platform,
} from "react-native";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useSchedule } from "../../../context/ScheduleProvider";
import LessonEditor from "./LessonEditor";
import themes from "../../../config/themes";

function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minsToAdd);
  return date.toTimeString().slice(0, 5);
}

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
  const { currentDate, getDaySchedule, reloadDaySchedule } = useDaySchedule();
  const { schedule, isEditing } = useSchedule();

  const {
    start_time = "08:30",
    duration = 45,
    breaks = [],
    subjects = [],
    teachers = [],
  } = schedule || {};

  const scheduleForDay = getDaySchedule ? getDaySchedule(currentDate) : [];

  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay.length);
  }, [start_time, duration, breaks, scheduleForDay]);

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (reloadDaySchedule) {
        await reloadDaySchedule(currentDate);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handlePressLesson = (lesson) => {
    setSelectedLesson(lesson);
    if (isEditing) {
      setEditorVisible(true);
    } else {
      setViewerVisible(true);
    }
  };

  const closeEditor = () => {
    setEditorVisible(false);
    setSelectedLesson(null);
  };

  const closeViewer = () => {
    setViewerVisible(false);
    setSelectedLesson(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          Platform.OS !== "web" ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
        overScrollMode="always"
        bounces={true}
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
                onPress={() =>
                  handlePressLesson({ subject, teacher, timeInfo, index })
                }
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

        {/* Кнопка-заглушка завжди займає місце */}
        <TouchableOpacity
          style={[styles.addCard, !isEditing && styles.addCardHidden]}
          onPress={() => isEditing && handlePressLesson(null)}
          activeOpacity={isEditing ? 0.7 : 1}
          disabled={!isEditing}
        >
          <Text style={[styles.plus, !isEditing && styles.plusHidden]}>＋</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Модалка редагування */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <LessonEditor lesson={selectedLesson} onClose={closeEditor} />
      </Modal>

      {/* Модалка перегляду */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerBox}>
            <Text style={styles.viewerTitle}>
              {selectedLesson?.subject?.name || "—"}
            </Text>
            <Text>Викладач: {selectedLesson?.teacher?.name || "—"}</Text>
            <Text>
              Час: {selectedLesson?.timeInfo?.start || "—"} -{" "}
              {selectedLesson?.timeInfo?.end || "—"}
            </Text>
            <TouchableOpacity
              onPress={closeViewer}
              style={styles.viewerCloseBtn}
            >
              <Text style={{ color: "#fff" }}>Закрити</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 90,
  },
  scrollContent: {
    padding: 10,
    paddingBottom: 160,
  },
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
  noData: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
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
  addCardHidden: {
    opacity: 0, // невидима, але місце займає
  },
  plus: { fontSize: 32, color: "#aaa", fontWeight: "300" },
  plusHidden: {
    color: "transparent",
  },
  // Viewer styles
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "80%",
  },
  viewerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  viewerCloseBtn: {
    marginTop: 15,
    backgroundColor: "#333",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
});

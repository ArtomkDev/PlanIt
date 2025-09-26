import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";

export default function LessonCard({ lesson, onPress }) {
  const { schedule } = useSchedule();
  const { subjects = [], teachers = [], statuses = [], gradients = [] } =
    schedule || {};

  // 🔹 дані
  const subject = subjects.find((s) => s.id === lesson.subjectId) || {};
  const teacher = teachers.find((t) => t.id === subject.teacher) || {};
  const status = statuses.find((st) => st.id === subject.status) || {};

  // 🔹 фон
  let backgroundContent;
  if (subject?.typeColor === "gradient" && subject?.colorGradient) {
    const grad = gradients.find((g) => g.id === subject.colorGradient);
    if (grad) {
      backgroundContent = <GradientBackground gradient={grad} style={styles.gradient} />;
    }
  } else {
    const subjectColor =
      themes.accentColors[subject?.color] ||
      subject?.color ||
      themes.accentColors.grey;

    backgroundContent = (
      <View style={[styles.gradient, { backgroundColor: subjectColor + "CC" }]} />
    );
  }

  const statusColor =
    themes.accentColors[status?.color] || status?.color || "#FF0000";

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() =>
        onPress({
          ...lesson,
          subject,
          teacher,
          status,
        })
      }
    >
      {backgroundContent}

      <View style={styles.cardContent}>
        {/* верхній ряд */}
        <View style={styles.topRow}>
          {status?.color && (
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={styles.cardTime}>
            {lesson?.timeInfo?.start || "—"} - {lesson?.timeInfo?.end || "—"}
          </Text>
        </View>

        <Text style={styles.cardTitle}>{subject?.name || "—"}</Text>

        <Text style={styles.cardTeacher}>{teacher?.name || "—"}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTime: {
    fontSize: 13,
    fontWeight: "500",
    color: "#fff",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
  },
  cardTeacher: {
    fontSize: 14,
    color: "#f0f0f0",
    marginTop: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

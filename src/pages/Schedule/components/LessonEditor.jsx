import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";

export default function LessonEditor({ lesson, onClose }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const subjects = schedule?.subjects ?? [];
  const teachers = schedule?.teachers ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // ініціалізація значень при відкритті
  useEffect(() => {
    if (lesson?.subjectId) {
      setSelectedSubjectId(lesson.subjectId);
      const subj = subjects.find((s) => s.id === lesson.subjectId);
      setSelectedTeacherId(lesson.teacherId || subj?.teacher || null);
    }
  }, [lesson, subjects]);

  // при зміні предмета підтягувати його дефолтного викладача
  useEffect(() => {
    if (!selectedSubjectId) return;
    const subj = subjects.find((s) => s.id === selectedSubjectId);
    if (subj?.teacher) {
      setSelectedTeacherId(subj.teacher);
    }
  }, [selectedSubjectId, subjects]);

  const handleSave = () => {
    if (!selectedSubjectId) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      // ⚡ якщо змінився викладач — оновлюємо його глобально у subjects
      if (selectedTeacherId) {
        next.subjects = next.subjects.map((s) =>
          s.id === selectedSubjectId ? { ...s, teacher: selectedTeacherId } : s
        );
      }

      // робота з розкладом
      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;

      if (!Array.isArray(next.schedule)) {
        next.schedule = new Array(7).fill(null).map(() => ({}));
      }
      if (!next.schedule[dayIndex]) next.schedule[dayIndex] = {};
      if (!Array.isArray(next.schedule[dayIndex][weekKey])) {
        next.schedule[dayIndex][weekKey] = [];
      }

      const weekArr = [...next.schedule[dayIndex][weekKey]];

      if (Number.isInteger(lesson?.index)) {
        weekArr[lesson.index] = selectedSubjectId; // редагуємо пару
      } else {
        weekArr.push(selectedSubjectId); // додаємо нову
      }

      next.schedule[dayIndex][weekKey] = weekArr;

      return next;
    });

    onClose();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {Number.isInteger(lesson?.index) ? "Редагування пари" : "Нова пара"}
      </Text>

      <Text style={styles.section}>Предмет</Text>
      <ScrollView style={styles.list}>
        {subjects.map((s) => (
          <TouchableOpacity key={s.id} onPress={() => setSelectedSubjectId(s.id)}>
            <Text style={[styles.item, selectedSubjectId === s.id && styles.active]}>
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.section}>Викладач</Text>
      <ScrollView style={styles.list}>
        {teachers.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setSelectedTeacherId(t.id)}>
            <Text style={[styles.item, selectedTeacherId === t.id && styles.active]}>
              {t.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Скасувати</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!selectedSubjectId} onPress={handleSave}>
          <Text style={[styles.save, !selectedSubjectId && styles.disabled]}>
            Зберегти
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  section: { marginTop: 10, marginBottom: 6, fontWeight: "600" },
  list: { maxHeight: 180, borderWidth: 1, borderColor: "#eee", borderRadius: 8 },
  item: { padding: 12, fontSize: 16, borderBottomWidth: 1, borderColor: "#eee" },
  active: { backgroundColor: "#e6f2ff" },
  buttons: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  cancel: { color: "red", fontSize: 18 },
  save: { color: "green", fontSize: 18 },
  disabled: { opacity: 0.5 },
});

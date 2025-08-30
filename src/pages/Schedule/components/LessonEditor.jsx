import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";

export default function LessonEditor({ lesson, onClose }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const subjects = schedule?.subjects ?? [];
  const teachers = schedule?.teachers ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  // для модальних вікон
  const [activePicker, setActivePicker] = useState(null);

  useEffect(() => {
    if (lesson?.subjectId) {
      setSelectedSubjectId(lesson.subjectId);
      const subj = subjects.find((s) => s.id === lesson.subjectId);
      setSelectedTeacherId(lesson.teacherId || subj?.teacher || null);
    }
  }, [lesson, subjects]);

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

      if (selectedTeacherId) {
        next.subjects = next.subjects.map((s) =>
          s.id === selectedSubjectId ? { ...s, teacher: selectedTeacherId } : s
        );
      }

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
        weekArr[lesson.index] = selectedSubjectId;
      } else {
        weekArr.push(selectedSubjectId);
      }

      next.schedule[dayIndex][weekKey] = weekArr;

      return next;
    });

    onClose();
  };

  // універсальний елемент списку
  const SettingRow = ({ label, value, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "Немає"} ›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {Number.isInteger(lesson?.index) ? "Заняття" : "Нове заняття"}
      </Text>

      <ScrollView>
        <SettingRow
          label="Предмет"
          value={subjects.find((s) => s.id === selectedSubjectId)?.name}
          onPress={() => setActivePicker("subject")}
        />
        <SettingRow
          label="Викладач"
          value={teachers.find((t) => t.id === selectedTeacherId)?.name}
          onPress={() => setActivePicker("teacher")}
        />
        <SettingRow label="Тип заняття" value="Лекція" onPress={() => {}} />
        <SettingRow label="Корпус" value="-" onPress={() => {}} />
        <SettingRow label="Аудиторія" value="-" onPress={() => {}} />
        <SettingRow label="Посилання" value="-" onPress={() => {}} />
        <SettingRow label="Файли" value="-" onPress={() => {}} />
        <SettingRow label="Повторювати" value="День тижня" onPress={() => {}} />
        <SettingRow label="День" value="Субота" onPress={() => {}} />
        <SettingRow label="Період" value="Вручну" onPress={() => {}} />
        <SettingRow label="Початок" value="30 серп. 2025" onPress={() => {}} />
        <SettingRow label="Кінець" value="31 січ. 2026" onPress={() => {}} />
        <SettingRow label="Номер" value="-" onPress={() => {}} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Скасувати</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!selectedSubjectId} onPress={handleSave}>
          <Text style={[styles.save, !selectedSubjectId && styles.disabled]}>
            Додати
          </Text>
        </TouchableOpacity>
      </View>

      {/* Модальне вікно вибору предмета */}
      <Modal visible={activePicker === "subject"} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Оберіть предмет</Text>
          <ScrollView>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedSubjectId(s.id);
                  setActivePicker(null);
                }}
              >
                <Text style={styles.modalText}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setActivePicker(null)}>
            <Text style={styles.cancel}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Модальне вікно вибору викладача */}
      <Modal visible={activePicker === "teacher"} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Оберіть викладача</Text>
          <ScrollView>
            {teachers.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedTeacherId(t.id);
                  setActivePicker(null);
                }}
              >
                <Text style={styles.modalText}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setActivePicker(null)}>
            <Text style={styles.cancel}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", paddingTop: 50 },
  header: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  label: { color: "#aaa", fontSize: 16 },
  value: { color: "#fff", fontSize: 16 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  cancel: { color: "orange", fontSize: 18 },
  save: { color: "orange", fontSize: 18, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  modal: { flex: 1, backgroundColor: "#111", paddingTop: 50 },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  modalText: { color: "#fff", fontSize: 16 },
});

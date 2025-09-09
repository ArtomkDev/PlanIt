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
  const [subjectData, setSubjectData] = useState({});
  const [activePicker, setActivePicker] = useState(null);

  useEffect(() => {
    if (lesson?.subjectId) {
      setSelectedSubjectId(lesson.subjectId);
      const subj = subjects.find((s) => s.id === lesson.subjectId);
      setSubjectData(subj || {});
    }
  }, [lesson, subjects]);

  const handleSave = () => {
    if (!selectedSubjectId) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      // оновлюємо сам предмет
      next.subjects = next.subjects.map((s) =>
        s.id === selectedSubjectId ? { ...s, ...subjectData } : s
      );

      // додаємо в розклад
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

  const SettingRow = ({ label, value, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "Немає"} ›</Text>
    </TouchableOpacity>
  );

  const options = {
    subject: subjects.map((s) => ({ key: s.id, label: s.name })),
    teacher: teachers.map((t) => ({ key: t.id, label: t.name })),
    type: [
      { key: "Лекція", label: "Лекція" },
      { key: "Практика", label: "Практика" },
      { key: "Лабораторна", label: "Лабораторна" },
    ],
    status: [
      { key: "offline", label: "Офлайн" },
      { key: "online", label: "Онлайн" },
      { key: "hybrid", label: "Змішаний" },
    ],
  };

  const getLabel = (picker, value) => {
    if (picker === "subject") return subjects.find((s) => s.id === value)?.name;
    if (picker === "teacher") return teachers.find((t) => t.id === value)?.name;
    const opt = options[picker]?.find((o) => o.key === value);
    return opt?.label;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {Number.isInteger(lesson?.index) ? "Заняття" : "Нове заняття"}
      </Text>

      <ScrollView>
        <SettingRow
          label="Предмет"
          value={getLabel("subject", selectedSubjectId)}
          onPress={() => setActivePicker("subject")}
        />
        <SettingRow
          label="Викладач"
          value={getLabel("teacher", subjectData.teacher)}
          onPress={() => setActivePicker("teacher")}
        />
        <SettingRow
          label="Тип заняття"
          value={getLabel("type", subjectData.type)}
          onPress={() => setActivePicker("type")}
        />
        <SettingRow
          label="Формат"
          value={getLabel("status", subjectData.status)}
          onPress={() => setActivePicker("status")}
        />
        <SettingRow
          label="Корпус"
          value={subjectData.building}
          onPress={() => setActivePicker("building")}
        />
        <SettingRow
          label="Аудиторія"
          value={subjectData.room}
          onPress={() => setActivePicker("room")}
        />
        <SettingRow
          label="Посилання"
          value={subjectData.zoom_link}
          onPress={() => setActivePicker("zoom")}
        />
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

      {/* універсальне модальне вікно */}
      <Modal visible={!!activePicker} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Оберіть {activePicker}</Text>
          <ScrollView>
            {options[activePicker]?.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.modalItem}
                onPress={() => {
                  if (activePicker === "subject") {
                    setSelectedSubjectId(opt.key);
                    const subj = subjects.find((s) => s.id === opt.key);
                    setSubjectData(subj || {});
                  } else {
                    setSubjectData((prev) => ({
                      ...prev,
                      [activePicker]: opt.key,
                    }));
                  }
                  setActivePicker(null);
                }}
              >
                <Text style={styles.modalText}>{opt.label}</Text>
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

// LessonTeacherGroup.jsx
import React, { useState } from "react";
import { Modal, TouchableOpacity, Text, StyleSheet } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import TeacherEditor from "./TeacherEditor";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function LessonTeacherGroup({
  teachers = [],
  onSelect,
  onChange = () => {},
}) {
  const { schedule } = useSchedule();
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  // Функція для отримання імені вчителя за id
  const getTeacherName = (id) => {
    if (id === 0) return "Немає викладача";
    const teacher = schedule?.teachers.find((t) => t.id === id);
    return teacher ? teacher.name : `ID: ${id}`;
  };

  return (
    <>
      <Group title="Викладачі">
        {teachers.map((teacherId, index) => (
          <SettingRow
            key={index}
            label={`Викладач ${index + 1}`}
            value={getTeacherName(teacherId)}
            onPress={() => onSelect("teacher", index)}
            onLongPress={() => teacherId !== 0 && setEditingTeacherId(teacherId)}
          />
        ))}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onChange([...teachers, 0])}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </Group>

      <Modal visible={!!editingTeacherId} animationType="slide">
        <TeacherEditor
          teacherId={editingTeacherId}
          onClose={() => setEditingTeacherId(null)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  addButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

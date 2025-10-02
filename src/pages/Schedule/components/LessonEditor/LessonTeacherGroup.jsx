import React, { useState } from "react";
import { Modal } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import TeacherEditor from "./TeacherEditor";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function LessonTeacherGroup({ teachers = [], onSelect, onChange = () => {} }) {
  const { schedule } = useSchedule();
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  const getTeacherName = (id) => {
    if (id === 0) return "Немає викладача";
    const teacher = schedule?.teachers.find((t) => t.id === id);
    return teacher ? teacher.name : `ID: ${id}`;
  };

  return (
    <>
      <Group title="Викладачі" onAdd={() => onChange([...teachers, 0])}>
        {teachers.map((teacherId, index) => (
          <SettingRow
            key={index}
            label={getTeacherName(teacherId)}
            onPress={() => onSelect("teacher", index)}
            onLongPress={() => teacherId !== 0 && setEditingTeacherId(teacherId)}
          />
        ))}
      </Group>

      <Modal visible={!!editingTeacherId} animationType="slide">
        <TeacherEditor teacherId={editingTeacherId} onClose={() => setEditingTeacherId(null)} />
      </Modal>
    </>
  );
}

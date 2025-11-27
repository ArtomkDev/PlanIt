import React, { useState } from "react";
import { Modal } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import TeacherEditor from "./TeacherEditor";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function LessonTeacherGroup({ teachers = [], onSelect, onChange, themeColors }) {
  const { schedule } = useSchedule();
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  const getTeacherName = (id) => {
    if (id === 0) return "Не обрано";
    const teacher = schedule?.teachers.find((t) => t.id === id);
    return teacher ? teacher.name : "Викладача видалено";
  };

  return (
    <>
      <Group 
        title="Викладачі" 
        onAdd={() => onChange([...teachers, 0])} 
        themeColors={themeColors}
      >
        {teachers.map((teacherId, index) => (
          <SettingRow
            key={index}
            label={`Викладач ${index + 1}`}
            value={getTeacherName(teacherId)}
            onPress={() => onSelect(index)}
            onLongPress={() => teacherId !== 0 && setEditingTeacherId(teacherId)}
            themeColors={themeColors}
            icon="people-outline"
          />
        ))}
      </Group>

      <Modal visible={!!editingTeacherId} animationType="slide" transparent>
        <TeacherEditor 
            teacherId={editingTeacherId} 
            onClose={() => setEditingTeacherId(null)} 
        />
      </Modal>
    </>
  );
}
// LessonTeacherGroup.jsx
import React, { useState } from "react";
import { Modal } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import TeacherEditor from "./TeacherEditor";

export default function LessonTeacherGroup({ teacher, phone, onSelect, teacherId }) {
  const [editingTeacherId, setEditingTeacherId] = useState(null);

  return (
    <>
      <Group title="Викладач">
        <SettingRow
          label="Ім’я"
          value={teacher}
          onPress={() => onSelect("teacher")}
          onLongPress={() => setEditingTeacherId(teacherId)} // ⚡️ довгий тап відкриває редактор
        />
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

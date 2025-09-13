import React from "react";
import Group from "./Group";
import SettingRow from "./SettingRow";

export default function LessonTeacherGroup({ teacher, phone, onSelect }) {
  return (
    <Group title="Викладач">
      <SettingRow
        label="Ім’я"
        value={teacher}
        onPress={() => onSelect("teacher")}
      />
      <SettingRow label="Телефон" value={phone} onPress={() => {}} />
    </Group>
  );
}

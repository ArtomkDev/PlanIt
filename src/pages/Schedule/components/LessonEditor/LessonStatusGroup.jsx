import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import themes from "../../../../config/themes";

export default function LessonStatusGroup({ status, color, onSelect }) {
  const colorHex = color ? themes.accentColors[color] : null;

  return (
    <Group title="Статус">
      <SettingRow
        label="Назва"
        value={status}
        onPress={() => onSelect("status")}
      />
      <SettingRow
        label="Колір"
        value={
          colorHex ? (
            <View style={[styles.colorPreview, { backgroundColor: colorHex }]} />
          ) : (
            "Не вибрано"
          )
        }
        onPress={() => onSelect("statusColor")}
      />
    </Group>
  );
}

const styles = StyleSheet.create({
  colorPreview: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#555",
  },
});

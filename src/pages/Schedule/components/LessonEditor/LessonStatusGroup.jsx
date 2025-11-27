import React from "react";
import { View, StyleSheet } from "react-native";
import Group from "./Group";
import SettingRow from "./SettingRow";
import themes from "../../../../config/themes";

export default function LessonStatusGroup({ statusId, statuses, onSelectStatus, onSelectColor, themeColors }) {
  const currentStatus = statuses.find(s => s.id === statusId);
  const statusName = currentStatus?.name || "Немає статусу";
  const colorHex = currentStatus?.color ? (themes.accentColors[currentStatus.color] || currentStatus.color) : null;

  return (
    <Group title="Статус та тип" themeColors={themeColors}>
      <SettingRow
        label="Поточний статус"
        value={statusName}
        onPress={onSelectStatus}
        themeColors={themeColors}
        icon="flag-outline"
      />
      {statusId && (
        <SettingRow
          label="Колір статусу"
          rightContent={
             colorHex ? (
                <View style={[styles.colorPreview, { backgroundColor: colorHex }]} />
             ) : null
          }
          value={!colorHex ? "За замовчуванням" : null}
          onPress={onSelectColor}
          themeColors={themeColors}
          icon="color-filter-outline"
        />
      )}
    </Group>
  );
}

const styles = StyleSheet.create({
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
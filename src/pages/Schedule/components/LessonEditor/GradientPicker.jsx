import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";
import GradientBackground from "../../../../components/GradientBackground";
// Видалили імпорт GradientEditorModal

export default function GradientPicker({ selected, onSelect, onEdit }) {
  const { schedule } = useSchedule();
  const gradients = schedule?.gradients || [];

  // Видалили локальний state (editing)

  return (
    <FlatList
      data={gradients}
      keyExtractor={(g) => g.id.toString()}
      numColumns={2}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const isSelected = selected === item.id;

        return (
          <TouchableOpacity
            style={styles.gradientTile}
            onPress={() => onSelect(item.id)}
            onLongPress={() => onEdit?.(item)} // Тепер просто передаємо об'єкт нагору
            activeOpacity={0.8}
          >
            <GradientBackground
              gradient={item}
              style={StyleSheet.absoluteFillObject}
            />

            {isSelected && <View style={styles.selectedMark} />}
          </TouchableOpacity>
        );
      }}
    />
    // Видалили рендер GradientEditorModal
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 20, // Додали відступ, щоб зручніше було скролити
  },
  gradientTile: {
    width: 100,
    height: 50,
    borderRadius: 12,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  selectedMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
});
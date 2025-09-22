// src/pages/Schedule/components/LessonEditor/GradientPicker.jsx
import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";
import GradientBackground from "../../../../components/GradientBackground";

export default function GradientPicker({ selected, onSelect }) {
  const { schedule } = useSchedule();
  const gradients = schedule?.gradients || [];

  return (
    <FlatList
      data={gradients}
      keyExtractor={(g) => g.id.toString()}
      numColumns={2}
      renderItem={({ item }) => {
        const isSelected = selected === item.id;

        return (
          <TouchableOpacity
            style={styles.gradientTile}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.8}
          >
            {/* Використовуємо вже готовий універсальний компонент */}
            <GradientBackground gradient={item} style={StyleSheet.absoluteFillObject} />

            {isSelected && <View style={styles.selectedMark} />}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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

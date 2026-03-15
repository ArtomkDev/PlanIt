import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import GradientBackground from "../../../../../components/GradientBackground";

export default function GradientPicker({ selected, onSelect, onEdit, onAddGradient, themeColors }) {
  const { schedule } = useSchedule();
  const gradients = schedule?.gradients || [];

  return (
    <FlatList
      data={gradients}
      keyExtractor={(g) => g.id.toString()}
      numColumns={2}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isSelected = selected === item.id;

        return (
          <TouchableOpacity
            style={styles.gradientTile}
            onPress={() => onSelect(item.id)}
            onLongPress={() => onEdit?.(item)}
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
      // Кнопка перенесена у футер списку
      ListFooterComponent={
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: themeColors.accentColor }]}
          onPress={onAddGradient}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Створити градієнт</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 40, 
  },
  gradientTile: {
    width: "46%", // 46% + 2% margins
    height: 70, // Фіксована висота для гарного відображення градієнту
    borderRadius: 14,
    margin: "2%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  selectedMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  addButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
    marginHorizontal: "2%", 
  },
  addButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "bold" 
  },
});
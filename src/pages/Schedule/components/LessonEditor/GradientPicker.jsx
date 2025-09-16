import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import themes from "../../../../config/themes";
import { useSchedule } from "../../../../context/ScheduleProvider";


export default function GradientPicker({ selected, onSelect }) {
  const { schedule } = useSchedule();
  const gradients = schedule?.gradients || [];

  return (
    <FlatList
      data={gradients}
      keyExtractor={(g) => g.id.toString()}
      renderItem={({ item }) => {
        const isSelected = selected === item.id;
        return (
          <TouchableOpacity
            style={[
              styles.gradientTile,
              { backgroundColor: item.colors[0] || "#444" },
            ]}
            onPress={() => onSelect(item.id)}
          >
            {isSelected && <View style={styles.selectedMark} />}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    justifyContent: "center",
  },
  gradientTile: {
    width: 100,
    height: 50,
    borderRadius: 12,
    margin: 8,
    justifyContent: "center",
    alignItems: "center",
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

import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSchedule } from "../../../../context/ScheduleProvider";

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
            <LinearGradient
              colors={item.colors.map((c) => (c.startsWith("#") ? c : `#${c}`))}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />

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

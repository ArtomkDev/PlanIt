import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import themes from "../../../../../config/themes";

export default function ColorPicker({ selected, onSelect }) {
  const colors = Object.entries(themes.accentColors);

  return (
    <FlatList
      data={colors}
      numColumns={5}
      keyExtractor={([key]) => key}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => {
        const [key, color] = item;
        const isSelected = selected === key;

        return (
          <TouchableOpacity
            style={[styles.colorTile, { backgroundColor: color }]}
            onPress={() => onSelect(key)}
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
  colorTile: {
    width: 50,
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

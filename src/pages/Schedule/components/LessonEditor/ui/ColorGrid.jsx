import React from "react";
import { View, TouchableOpacity, StyleSheet, FlatList, Platform } from "react-native";
import themes from "../../../../../config/themes";

export default function ColorPicker({ selected, onSelect }) {
  const colors = Object.entries(themes.accentColors);

  return (
    <FlatList
      data={colors}
      numColumns={5}
      keyExtractor={([key]) => key}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const [key, color] = item;
        const isSelected = selected === key;

        return (
          <TouchableOpacity
            style={[styles.colorTile, { backgroundColor: color }]}
            onPress={() => onSelect(key)}
            activeOpacity={0.8}
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
    paddingBottom: 40,
  },
  colorTile: {
    width: "16%",
    aspectRatio: 1,
    borderRadius: 14,
    margin: "2%",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.3)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
    }),
  },
});
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import GradientBackground from "../../../../../components/GradientBackground";

export default function GradientGrid({ gradients, selected, onSelect, onEdit, onAddGradient, themeColors }) {
  return (
    <FlatList
      data={gradients || []}
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
  listContent: { paddingBottom: 20 },
  gradientTile: {
    flex: 1,
    height: 80,
    margin: 6,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  selectedMark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#4facfe",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  addButton: {
    height: 50,
    margin: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
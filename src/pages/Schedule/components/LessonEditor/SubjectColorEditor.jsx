// SubjectColorEditor.js
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ColorPicker from "./ColorPicker";
import GradientPicker from "./GradientPicker";

export default function SubjectColorEditor({
  selectedType = "color", // "color" або "linear"
  selectedColor,
  selectedGradient,
  onTypeChange,
  onColorSelect,
  onGradientSelect,
}) {
  const [currentType, setCurrentType] = useState(selectedType);

  useEffect(() => {
    setCurrentType(selectedType || "color");
  }, [selectedType]);

  const handleTypeChange = (type) => {
    setCurrentType(type);
    onTypeChange?.(type);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, currentType === "color" && styles.activeBtn]}
          onPress={() => handleTypeChange("color")}
        >
          <Text style={[styles.toggleText, currentType === "color" && styles.activeText]}>
            Заливка
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, currentType === "linear" && styles.activeBtn]}
          onPress={() => handleTypeChange("linear")}
        >
          <Text style={[styles.toggleText, currentType === "linear" && styles.activeText]}>
            Градієнт
          </Text>
        </TouchableOpacity>
      </View>

      {currentType === "color" ? (
        <ColorPicker selected={selectedColor} onSelect={onColorSelect} />
      ) : (
        <GradientPicker selected={selectedGradient} onSelect={onGradientSelect} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },
  toggleRow: { flexDirection: "row", justifyContent: "center", marginBottom: 12 },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#333",
    marginHorizontal: 4,
  },
  activeBtn: { backgroundColor: "orange" },
  toggleText: { color: "#ccc", fontSize: 16 },
  activeText: { color: "#000", fontWeight: "600" },
});

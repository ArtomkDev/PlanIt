// SubjectColorEditor.js
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ColorPicker from "./ColorPicker";
import GradientPicker from "./GradientPicker";

// 🔑 всі доступні режими
const TYPE_OPTIONS = [
  { key: "color", label: "Заливка" },
  { key: "gradient", label: "Градієнт" },
  { key: "image", label: "Картинка" },
];


export default function SubjectColorEditor({
  selectedType = "color",
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
      {/* 🔘 мульти-перемикач */}
      <View style={styles.segmentedControl}>
        {TYPE_OPTIONS.map((item, index) => {
          const isActive = currentType === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.segment,
                isActive && styles.activeSegment,
                index === 0 && styles.firstSegment,
                index === TYPE_OPTIONS.length - 1 && styles.lastSegment,
              ]}
              onPress={() => handleTypeChange(item.key)}
            >
              <Text style={[styles.segmentText, isActive && styles.activeText]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {currentType === "color" && (
        <ColorPicker selected={selectedColor} onSelect={onColorSelect} />
      )}
      {currentType === "gradient" && (
        <GradientPicker selected={selectedGradient} onSelect={onGradientSelect} />
      )}
      {currentType === "image" && (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#aaa" }}>Тут має бути вибір картинки</Text>
          {/* Той компонент, який дозволить вибрати чи завантажити картинку */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },

  // 🔘 Segmented control
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#555",
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  activeSegment: {
    backgroundColor: "orange",
  },
  firstSegment: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  lastSegment: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  segmentText: {
    color: "#ccc",
    fontSize: 14,
  },
  activeText: {
    color: "#000",
    fontWeight: "600",
  },
});

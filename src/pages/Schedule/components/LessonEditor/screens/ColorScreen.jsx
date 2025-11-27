import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ColorGrid from "../ui/ColorGrid";
import GradientPicker from "../ui/GradientGrid";

export default function LessonEditorSubjectColorScreen({
  themeColors,
  currentSubject,
  handleUpdateSubject,
  onEditGradient, // Це відкриває внутрішній екран редактора градієнта
  onAddGradient,  // Це відкриває внутрішній екран редактора градієнта
}) {
  const [colorTab, setColorTab] = useState("color");

  useEffect(() => {
    if (currentSubject?.typeColor === "gradient") {
      setColorTab("gradient");
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.segmentedControl, { borderColor: themeColors.borderColor || "#333" }]}>
        {["color", "gradient"].map((type) => {
          const isActive = colorTab === type;
          const labelMap = { color: "Колір", gradient: "Градієнт" };
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.segment,
                isActive && { backgroundColor: themeColors.accentColor },
              ]}
              onPress={() => setColorTab(type)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isActive ? "#fff" : themeColors.textColor2 },
                ]}
              >
                {labelMap[type]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {colorTab === "color" ? (
          <ColorGrid
            selected={currentSubject.color}
            onSelect={(key) => handleUpdateSubject({ color: key, typeColor: "color" })}
          />
        ) : (
          <>
            <GradientPicker
              selected={currentSubject.colorGradient}
              onSelect={(key) => handleUpdateSubject({ colorGradient: key, typeColor: "gradient" })}
              onEdit={(grad) => onEditGradient(grad)}
            />
            <TouchableOpacity
              onPress={onAddGradient}
              style={[styles.addBtn, { borderColor: themeColors.borderColor }]}
            >
              <Text style={[styles.addText, { color: themeColors.accentColor }]}>
                ＋ Додати градієнт
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 4, paddingTop: 10 },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    height: 36,
    marginHorizontal: 12,
  },
  segment: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addBtn: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
  },
  addText: { fontSize: 16, fontWeight: "600" },
});
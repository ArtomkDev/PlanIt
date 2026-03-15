import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import ColorGrid from "../ui/ColorGrid";
import GradientGrid from "../ui/GradientGrid";

export default function LessonEditorSubjectColorScreen({
  themeColors,
  currentSubject,
  onSelect,
  onEditGradient,
  onAddGradient,
}) {
  const [activeTab, setActiveTab] = useState(
    currentSubject?.typeColor === "gradient" ? "gradient" : "color"
  );

  const handleSelectColor = (colorKey) => {
    onSelect({ color: colorKey, typeColor: "color" });
  };

  const handleSelectGradient = (gradientId) => {
    onSelect({ colorGradient: gradientId, typeColor: "gradient" });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.tabContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "color" && { backgroundColor: themeColors.backgroundColor }]}
          onPress={() => setActiveTab("color")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { color: activeTab === "color" ? themeColors.textColor : themeColors.textColor2 }]}>
            Колір
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "gradient" && { backgroundColor: themeColors.backgroundColor }]}
          onPress={() => setActiveTab("gradient")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { color: activeTab === "gradient" ? themeColors.textColor : themeColors.textColor2 }]}>
            Градієнт
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === "color" ? (
          <ColorGrid
            themeColors={themeColors}
            selected={currentSubject?.typeColor !== "gradient" ? currentSubject?.color : null}
            onSelect={handleSelectColor} 
          />
        ) : (
          <GradientGrid
            themeColors={themeColors}
            selected={currentSubject?.typeColor === "gradient" ? currentSubject?.colorGradient : null}
            onSelect={handleSelectGradient} 
            onEdit={onEditGradient}
            onAddGradient={onAddGradient}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    padding: 4,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabText: { fontSize: 15, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 16 },
});
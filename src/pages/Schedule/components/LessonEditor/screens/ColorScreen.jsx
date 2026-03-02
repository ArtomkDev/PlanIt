import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import ColorGrid from "../ui/ColorGrid";
import GradientGrid from "../ui/GradientGrid";

export default function LessonEditorSubjectColorScreen({
  themeColors,
  currentSubject,
  onSelect, // Використовуємо новий пропс
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
        >
          <Text style={[styles.tabText, { color: activeTab === "color" ? themeColors.textColor : themeColors.textColor2 }]}>
            Колір
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === "gradient" && { backgroundColor: themeColors.backgroundColor }]}
          onPress={() => setActiveTab("gradient")}
        >
          <Text style={[styles.tabText, { color: activeTab === "gradient" ? themeColors.textColor : themeColors.textColor2 }]}>
            Градієнт
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === "color" ? (
          <ColorGrid
            themeColors={themeColors}
            selectedColor={currentSubject?.typeColor !== "gradient" ? currentSubject?.color : null}
            onSelect={handleSelectColor} // Викличе оновлення і закриє вікно
          />
        ) : (
          <View>
            <GradientGrid
              themeColors={themeColors}
              selectedGradient={currentSubject?.typeColor === "gradient" ? currentSubject?.colorGradient : null}
              onSelect={handleSelectGradient} // Викличе оновлення і закриє вікно
              onEdit={onEditGradient}
            />
            
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: themeColors.accentColor }]}
              onPress={onAddGradient}
            >
              <Text style={styles.addButtonText}>+ Створити градієнт</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    padding: 4,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabText: { fontSize: 15, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 16 },
  addButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 40,
  },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
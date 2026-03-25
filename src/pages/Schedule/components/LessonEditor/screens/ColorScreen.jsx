import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import ColorGrid from "../ui/ColorGrid";
import GradientGrid from "../ui/GradientGrid";
import TabSwitcher from "../ui/TabSwitcher";

export default function LessonEditorSubjectColorScreen({
  themeColors,
  currentSubject,
  gradients,
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

  const tabs = [
    { id: "color", label: "Колір" },
    { id: "gradient", label: "Градієнт" },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.switcherWrapper}>
        <TabSwitcher
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={setActiveTab}
          themeColors={themeColors}
          containerBackgroundColor={themeColors.backgroundColor2}
          activeTabBackgroundColor={themeColors.backgroundColor}
        />
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
            gradients={gradients}
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
  switcherWrapper: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  content: { flex: 1, paddingHorizontal: 16 },
});
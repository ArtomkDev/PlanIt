import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import themes from "../../../config/themes";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";

const ThemeSettings = () => {
  const { schedule, setScheduleDraft } = useSchedule();
  const currentTheme = schedule?.theme || ["dark", "blue"];
  const [selectedMode, setSelectedMode] = useState(currentTheme[0]);
  const [selectedColor, setSelectedColor] = useState(currentTheme[1]);
  const themeColors = themes.getColors(selectedMode, selectedColor);

  useEffect(() => {
    if (currentTheme[0] !== selectedMode || currentTheme[1] !== selectedColor) {
      setScheduleDraft((prev) => ({
        ...prev,
        theme: [selectedMode, selectedColor],
      }));
    }
  }, [selectedMode, selectedColor]);

  const renderColorOption = (colorName) => {
    const colorValue = themes.accentColors[colorName];
    const isSelected = selectedColor === colorName;

    return (
      <TouchableOpacity
        key={colorName}
        style={[
          styles.colorTile,
          { backgroundColor: colorValue },
          isSelected && styles.colorTileSelected,
        ]}
        onPress={() => setSelectedColor(colorName)}
      >
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        {/* Заголовок */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          🎨 Вибір теми
        </Text>

        {/* Кнопки вибору */}
        <View style={styles.themeContainer}>
          {[
            { key: "dark", label: "🌙 Темна" },
            { key: "light", label: "☀️ Світла" },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.themeCard,
                { backgroundColor: themeColors.backgroundColor2 },
                selectedMode === item.key && {
                  borderColor: themeColors.accentColor,
                  borderWidth: 2,
                  shadowColor: themeColors.accentColor,
                },
              ]}
              onPress={() => setSelectedMode(item.key)}
            >
              <Text style={[styles.themeCardText, { color: themeColors.textColor }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Кольори */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          🌈 Акцентний колір
        </Text>
        <View style={styles.colorsContainer}>
          {Object.keys(themes.accentColors).map((colorName) =>
            renderColorOption(colorName)
          )}
        </View>

        {/* Превʼю */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          👀 Попередній перегляд
        </Text>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: themeColors.backgroundColor2 },
          ]}
        >
          <Text style={[styles.previewText, { color: themeColors.textColor }]}>
            Це приклад тексту у {selectedMode === "dark" ? "темній" : "світлій"} темі з акцентом {selectedColor}.
          </Text>
        </View>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  themeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  themeCard: {
    flex: 1,
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 12,
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  themeCardText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  colorsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginBottom: 20,
  },
  colorTile: {
    width: 70,
    height: 50,
    borderRadius: 10,
    margin: 6,
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  colorTileSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  checkmark: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  previewCard: {
    borderRadius: 12,
    padding: 20,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  previewText: {
    fontSize: 14,
  },
});

export default ThemeSettings;

import React, { useEffect, useState, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import themes from "../../../config/themes";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import AdvancedColorPicker from "../../../components/AdvancedColorPicker";

const ThemeSettings = () => {
  const { global, setGlobalDraft } = useSchedule();
  
  const [currentMode, currentAccent] = global?.theme || ["light", "blue"];
  const currentBlur = global?.blur ?? true;
  
  const [selectedMode, setSelectedMode] = useState(currentMode);
  const [selectedColor, setSelectedColor] = useState(currentAccent);
  const [isBlurEnabled, setIsBlurEnabled] = useState(currentBlur);
  
  const [isPickerVisible, setPickerVisible] = useState(false);

  const themeColors = useMemo(() => themes.getColors(selectedMode, selectedColor), [selectedMode, selectedColor]);

  // Синхронізація з глобальним станом
  useEffect(() => {
    if (
      currentMode !== selectedMode || 
      currentAccent !== selectedColor || 
      currentBlur !== isBlurEnabled
    ) {
      setGlobalDraft((prev) => ({
        ...prev,
        theme: [selectedMode, selectedColor],
        blur: isBlurEnabled, // Зберігаємо налаштування блюру
      }));
    }
  }, [selectedMode, selectedColor, isBlurEnabled]);

  const predefinedKeys = Object.keys(themes.accentColors);
  const isCustomColor = !predefinedKeys.includes(selectedColor);

  const handleCustomColorSave = (hex) => {
    setSelectedColor(hex);
  };

  const renderColorOption = (colorKey) => {
    const colorValue = themes.accentColors[colorKey];
    const isSelected = selectedColor === colorKey;

    return (
      <TouchableOpacity
        key={colorKey}
        style={[
          styles.colorTile,
          { backgroundColor: colorValue },
          isSelected && styles.colorTileSelected,
        ]}
        onPress={() => setSelectedColor(colorKey)}
        activeOpacity={0.7}
      >
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        
        {/* Секція 1: Режим теми */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          🎨 Режим
        </Text>
        <View style={styles.themeContainer}>
          {[
            { key: "light", label: "☀️ Світла" },
            { key: "dark", label: "🌙 Темна" },
            { key: "oled", label: "🖤 OLED" },
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
                  elevation: 2,
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

        {/* Секція 2: Блюр (Нове налаштування) */}
        <View style={[styles.switchRow, { backgroundColor: themeColors.backgroundColor2 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: themeColors.textColor }]}>Ефект розмиття (Blur)</Text>
            <Text style={[styles.switchSubLabel, { color: themeColors.textColor2 }]}>
              {selectedMode === 'oled' ? 'У режимі OLED блюр буде темним' : 'Прозорість елементів інтерфейсу'}
            </Text>
          </View>
          <Switch
            value={isBlurEnabled}
            onValueChange={setIsBlurEnabled}
            trackColor={{ false: themeColors.backgroundColor3, true: themeColors.accentColor }}
            thumbColor={"#fff"}
          />
        </View>

        {/* Секція 3: Акцентний колір */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          🌈 Акцентний колір
        </Text>
        
        <View style={styles.colorsContainer}>
          {predefinedKeys.map((colorName) => renderColorOption(colorName))}

          <TouchableOpacity
            style={[
              styles.colorTile,
              styles.customTile,
              { backgroundColor: themeColors.backgroundColor2 },
              isCustomColor && {
                 backgroundColor: selectedColor,
                 borderWidth: 2,
                 borderColor: themeColors.textColor 
              }
            ]}
            onPress={() => setPickerVisible(true)}
          >
            <Ionicons 
              name="pencil" 
              size={20} 
              color={isCustomColor ? '#fff' : themeColors.textColor} 
            />
          </TouchableOpacity>
        </View>

        {/* Секція 4: Превʼю */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          👀 Результат
        </Text>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: themeColors.backgroundColor2, borderLeftColor: themeColors.accentColor },
          ]}
        >
          <Text style={[styles.previewHeader, { color: themeColors.accentColor }]}>
            Заголовок акцентним кольором
          </Text>
          <Text style={[styles.previewText, { color: themeColors.textColor }]}>
            Блюр: {isBlurEnabled ? "Увімкнено" : "Вимкнено"}.
            Режим: {selectedMode.toUpperCase()}.
          </Text>
          
          <View style={[styles.dummyButton, { backgroundColor: themeColors.accentColor }]}>
             <Text style={{ color: '#fff', fontWeight: 'bold' }}>Кнопка</Text>
          </View>
        </View>

      </View>

      <AdvancedColorPicker
        visible={isPickerVisible}
        initialColor={isCustomColor ? selectedColor : themes.accentColors.blue}
        onClose={() => setPickerVisible(false)}
        onSave={handleCustomColorSave}
      />
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 15, marginTop: 10 },
  
  themeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  themeCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  themeCardText: { fontSize: 14, fontWeight: "600" },

  // Switch Styles
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
  },
  switchLabel: { fontSize: 16, fontWeight: "600" },
  switchSubLabel: { fontSize: 12, marginTop: 4 },

  colorsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginBottom: 30,
  },
  colorTile: {
    width: 70,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  colorTileSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    transform: [{ scale: 1.05 }],
  },
  customTile: {
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.3)',
    borderStyle: 'dashed',
  },
  checkmark: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2
  },

  previewCard: {
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 6,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  previewHeader: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  previewText: { fontSize: 14, lineHeight: 20, marginBottom: 15, opacity: 0.8 },
  dummyButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  }
});

export default ThemeSettings;
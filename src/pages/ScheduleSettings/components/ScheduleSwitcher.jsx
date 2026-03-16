// src/pages/ScheduleSettings/components/ScheduleSwitcher.jsx
import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import themes from "../../../config/themes"; // Використовуємо глобальні теми

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ScheduleSwitcher = () => {
  const { global, setGlobalDraft, schedules } = useSchedule();
  const navigation = useNavigation();

  // Отримуємо кольори на основі глобальних налаштувань користувача
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  if (!global) return null;

  const handleChange = (newId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setGlobalDraft((prev) => ({
      ...prev,
      currentScheduleId: newId,
    }));
  };

  const handleEdit = (scheduleId) => {
    navigation.navigate("ScheduleEditorScreen", { scheduleId });
  };

  const handleAddNew = () => {
    navigation.navigate("ScheduleEditorScreen", { isNew: true });
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>Ваші розклади</Text>

        <View style={styles.listContent}>
          {schedules.map((s) => {
            const isSelected = s.id === global.currentScheduleId;

            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.option,
                  {
                    backgroundColor: themeColors.backgroundColor2,
                    borderColor: isSelected ? themeColors.accentColor : 'transparent',
                    borderWidth: isSelected ? 2 : 1,
                  }
                ]}
                onPress={() => !isSelected && handleChange(s.id)}
                onLongPress={() => handleEdit(s.id)}
                delayLongPress={300}
                activeOpacity={isSelected ? 1 : 0.7}
              >
                <View style={styles.leftContainer}>
                  <Text style={[
                    styles.optionText, 
                    { color: themeColors.textColor },
                    isSelected && { color: themeColors.accentColor, fontWeight: "bold" }
                  ]}>
                    {s.name || "Без назви"}
                  </Text>
                </View>

                <View style={styles.rightContainer}>
                  <TouchableOpacity 
                    hitSlop={15}
                    onPress={() => handleEdit(s.id)}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={20} color={themeColors.textColor2} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { borderColor: themeColors.accentColor, borderStyle: 'dashed' }
            ]} 
            onPress={handleAddNew}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
            <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>Додати новий</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  editButton: {
    padding: 4,
    borderRadius: 8,
  },
  actionButton: {
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    borderWidth: 1,
    marginTop: 4,
  },
  actionButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
});

export default ScheduleSwitcher;
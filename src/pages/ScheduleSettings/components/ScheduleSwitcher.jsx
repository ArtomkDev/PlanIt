import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Platform 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Animated, { 
  FadeInDown, 
  FadeOutDown, 
  CurvedTransition 
} from "react-native-reanimated";

import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import themes from "../../../config/themes"; 
import { t } from "../../../utils/i18n";

const ScheduleSwitcher = () => {
  const { global, setGlobalDraft, schedules, removeSchedule , lang} = useSchedule();
  const navigation = useNavigation();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);


  if (!global) return null;

  const handleChange = (newId) => {
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

  const handleDelete = (scheduleId, scheduleName) => {
    if (schedules.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert(t('settings.schedule_switcher.last_schedule_error', lang));
      } else {
        Alert.alert(t('common.warning', lang), t('settings.schedule_switcher.last_schedule_error', lang));
      }
      return;
    }

    const untitledName = t('settings.schedule_switcher.untitled', lang);
    const message = t('settings.schedule_switcher.delete_confirm_msg', lang).replace('{name}', scheduleName || untitledName);

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(message);
      if (confirmed) {
        removeSchedule(scheduleId);
      }
    } else {
      Alert.alert(
        t('settings.schedule_switcher.delete_title', lang),
        message,
        [
          { text: t('common.cancel', lang), style: "cancel" },
          { 
            text: t('common.delete', lang), 
            style: "destructive", 
            onPress: () => removeSchedule(scheduleId)
          }
        ]
      );
    }
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: themeColors.textColor }]}>
          {t('settings.schedule_switcher.your_schedules', lang)}
        </Text>

        <View style={styles.listContent}>
          {schedules.map((s, index) => {
            const isSelected = s.id === global.currentScheduleId;
            const delay = Math.min(index * 100, 500);

            return (
              <Animated.View
                key={s.id}
                entering={FadeInDown.delay(delay).springify()}
                exiting={FadeOutDown.springify()}
                layout={CurvedTransition}
              >
                <TouchableOpacity
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
                      {s.name || t('settings.schedule_switcher.untitled', lang)}
                    </Text>
                  </View>

                  <View style={styles.rightContainer}>
                    <TouchableOpacity 
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => handleEdit(s.id)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="pencil" size={20} color={themeColors.textColor2} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => handleDelete(s.id, s.name)}
                      style={styles.iconButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={themes.accentColors.red} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <Animated.View layout={CurvedTransition}>
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                { borderColor: themeColors.accentColor, borderStyle: 'dashed' }
              ]} 
              onPress={handleAddNew}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={22} color={themeColors.accentColor} style={{ marginRight: 6 }} />
              <Text style={[styles.actionButtonText, { color: themeColors.accentColor }]}>
                {t('settings.schedule_switcher.add_new', lang)}
              </Text>
            </TouchableOpacity>
          </Animated.View>
          
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
    paddingBottom: 20,
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
  iconButton: {
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
// src/pages/ScheduleSettings/components/ScheduleEditorScreen.jsx
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  LayoutAnimation,
  UIManager
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSchedule } from "../../../context/ScheduleProvider";
import useUniqueId from "../../../hooks/useUniqueId";
import defaultSchedule from "../../../config/defaultSchedule";
import themes from "../../../config/themes";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ScheduleEditorScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { isNew, scheduleId } = route.params || {};
  
  const { global, schedules, addSchedule, setData, setGlobalDraft } = useSchedule();
  const generateId = useUniqueId();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [name, setName] = useState("");
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isNew && scheduleId) {
      const existing = schedules.find(s => s.id === scheduleId);
      if (existing) setName(existing.name || "");
    }
  }, [isNew, scheduleId, schedules]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (isNew) {
      const newId = generateId();
      addSchedule({
        ...defaultSchedule,
        id: newId,
        name: trimmedName,
      });
      setGlobalDraft((prev) => ({
        ...prev,
        currentScheduleId: newId,
      }));
    } else {
      setData((prev) => {
        if (!prev) return prev;
        const nextSchedules = prev.schedules.map((s) => 
          s.id === scheduleId ? { ...s, name: trimmedName, lastModified: Date.now() } : s
        );
        return { ...prev, schedules: nextSchedules };
      });
      
      // 🔥 ВИПРАВЛЕННЯ: Викликаємо setGlobalDraft без реальних змін, 
      // щоб під капотом ScheduleProvider спрацювало setIsDirty(true).
      // Це успішно запустить таймер AutoSaveManager, і збереження відбудеться плавно.
      setGlobalDraft(prev => prev);
    }

    navigation.goBack();
  };

  const isFormValid = name.trim().length > 0;

  const tabBarHeightOffset = 50 + insets.bottom + 20;
  const footerPaddingBottom = isKeyboardVisible ? (Platform.OS === 'ios' ? 12 : 20) : tabBarHeightOffset;

  return (
    <View style={[styles.mainContainer, { backgroundColor: themeColors.backgroundColor, paddingTop: insets.top }]}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={15}>
          <Ionicons name="chevron-back" size={28} color={themeColors.accentColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textColor }]}>
          {isNew ? "Новий розклад" : "Редагування"}
        </Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: themeColors.textColor2 }]}>Назва розкладу</Text>
            <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundColor2 }]}>
              <Ionicons name="calendar-outline" size={20} color={themeColors.textColor2} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: themeColors.textColor }]}
                placeholder="Введіть назву..."
                placeholderTextColor={themeColors.textColor2 + '80'}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 20 }} />

          <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
            <TouchableOpacity 
                style={[styles.button, styles.cancelButton, { backgroundColor: themeColors.backgroundColor2 }]} 
                onPress={() => navigation.goBack()}
            >
              <Text style={[styles.buttonText, { color: themeColors.textColor }]}>Скасувати</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.saveButton, 
                  { 
                    backgroundColor: isFormValid ? themeColors.accentColor : themeColors.backgroundColor2,
                    opacity: isFormValid ? 1 : 0.6
                  }
                ]} 
                onPress={handleSave}
                disabled={!isFormValid}
            >
              <Text style={[
                styles.saveButtonText, 
                { color: isFormValid ? "#fff" : themeColors.textColor2 }
              ]}>
                {isNew ? "Створити" : "Зберегти"}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 12, 
    paddingVertical: 14 
  },
  backButton: { 
    width: 40, 
    alignItems: 'flex-start' 
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700' 
  },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  formGroup: { 
    marginBottom: 24 
  },
  label: { 
    fontSize: 14, 
    fontWeight: "500", 
    marginBottom: 8, 
    marginLeft: 4, 
    textTransform: "uppercase", 
    letterSpacing: 0.5 
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 14, 
    paddingHorizontal: 14, 
    height: 54 
  },
  inputIcon: { 
    marginRight: 10 
  },
  input: { 
    flex: 1, 
    fontSize: 16, 
    height: "100%" 
  },
  footer: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    gap: 12, 
    marginTop: 20 
  },
  button: { 
    flex: 1, 
    height: 50, 
    borderRadius: 14, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  cancelButton: { 
    borderWidth: 0 
  },
  saveButton: { 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2 
  },
  buttonText: { 
    fontSize: 16, 
    fontWeight: "600" 
  },
  saveButtonText: { 
    fontSize: 16, 
    fontWeight: "700" 
  },
});

export default ScheduleEditorScreen;
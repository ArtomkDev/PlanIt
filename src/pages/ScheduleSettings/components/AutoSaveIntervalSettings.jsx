// src/pages/ScheduleSettings/components/AutoSaveIntervalSettings.jsx
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import themes from '../../../config/themes';

const AutoSaveIntervalSettings = () => {
  // 🔥 ЗМІНА 1: Беремо setGlobalDraft замість setScheduleDraft
  const { global, setGlobalDraft } = useSchedule();

  // 🔥 ЗМІНА 2: Читаємо значення з global, а не з schedule
  const currentInterval = global?.auto_save ?? 60;
  
  const [tempInterval, setTempInterval] = useState(currentInterval);

  // Синхронізація, якщо значення змінилося ззовні
  useEffect(() => {
    setTempInterval(currentInterval);
  }, [currentInterval]);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const confirmIntervalChange = () => {
    // Мінімальний поріг можна зменшити, наприклад, до 10-15 секунд для глобального синхра
    const correctedInterval = tempInterval < 10 ? 10 : tempInterval;

    setTempInterval(correctedInterval);

    // 🔥 ЗМІНА 3: Оновлюємо глобальні налаштування
    setGlobalDraft((prev) => ({
      ...prev,
      auto_save: correctedInterval,
    }));
  };

  const isValueChanged = tempInterval !== currentInterval;

  return (
    <SettingsScreenLayout>
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.textColor }]}>
          Інтервал автозбереження (секунди):
        </Text>
    
        <TextInput
          style={[
            styles.input,
            {
              borderColor: themeColors.textColor2,
              color: themeColors.textColor,
            },
          ]}
          keyboardType="number-pad"
          value={String(tempInterval)}
          onChangeText={(value) => {
             // Дозволяємо вводити лише цифри
             const numericValue = value.replace(/[^0-9]/g, '');
             setTempInterval(Number(numericValue));
          }}
        />
  
        <TouchableOpacity
          style={[
            styles.confirmButton,
            {
              backgroundColor: isValueChanged
                ? themeColors.accentColor
                : themeColors.backgroundColor2,
            },
          ]}
          onPress={confirmIntervalChange}
          disabled={!isValueChanged}
        >
          <Text style={{ color: isValueChanged ? "#fff" : themeColors.textColor2, fontWeight: "600" }}>
            Підтвердити
          </Text>
        </TouchableOpacity>

        <Text style={{ marginTop: 10, fontSize: 12, color: themeColors.textColor2, textAlign: 'center' }}>
          Це налаштування впливає на частоту збереження даних у хмару.
        </Text>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    width: "100%", 
    maxWidth: 200,
    textAlign: "center",
    fontSize: 18,
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    minWidth: 150,
    alignItems: 'center',
  },
});

export default AutoSaveIntervalSettings;
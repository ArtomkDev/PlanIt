// src/components/AutoSaveIntervalSettings.jsx
import React, { useState } from "react";
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
  const { global, schedule, setScheduleDraft } = useSchedule();

  const currentInterval = schedule?.auto_save ?? 60;
  const [tempInterval, setTempInterval] = useState(currentInterval);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const confirmIntervalChange = () => {
    const correctedInterval = tempInterval < 30 ? 30 : tempInterval;

    // оновлюємо локальний стан
    setTempInterval(correctedInterval);

    // оновлюємо у контексті schedule.auto_save
    setScheduleDraft((prev) => ({
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
          onChangeText={(value) => setTempInterval(Number(value))}
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
          <Text style={{ color: themeColors.textColor }}>Підтвердити</Text>
        </TouchableOpacity>
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    width: "60%",
    textAlign: "center",
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: 10,
  },
});

export default AutoSaveIntervalSettings;

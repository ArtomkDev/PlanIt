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
import { t } from '../../../utils/i18n';

const AutoSaveIntervalSettings = () => {
  const { global, setGlobalDraft } = useSchedule();
  const lang = global?.language || 'uk';

  const currentInterval = global?.auto_save ?? 60;
  
  const [tempInterval, setTempInterval] = useState(currentInterval);

  useEffect(() => {
    setTempInterval(currentInterval);
  }, [currentInterval]);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const confirmIntervalChange = () => {
    const correctedInterval = tempInterval < 10 ? 10 : tempInterval;

    setTempInterval(correctedInterval);

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
          {t('settings.autosave_screen.interval_label', lang)}
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
            {t('common.confirm', lang)}
          </Text>
        </TouchableOpacity>

        <Text style={{ marginTop: 10, fontSize: 12, color: themeColors.textColor2, textAlign: 'center' }}>
          {t('settings.autosave_screen.info_text', lang)}
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
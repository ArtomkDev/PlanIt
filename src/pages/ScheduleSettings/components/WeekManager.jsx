import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import SettingsScreenLayout from '../SettingsScreenLayout';
import { t } from '../../../utils/i18n';

export default function WeekManager() {
  const { global, schedule, setScheduleDraft } = useSchedule();
  const lang = global?.language || 'uk';
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleSelectRepeatOption = (value) => {
    setScheduleDraft({ ...schedule, repeat: value });
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.repeatContainer}>
        <Text style={[styles.repeatLabel, { color: themeColors.textColor }]}>
          {t('settings.week_manager.repeat_label', lang)}
        </Text>
        <View style={styles.repeatButtons}>
          {[1, 2, 3, 4].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => handleSelectRepeatOption(value)}
              style={[
                styles.weekButton,
                {
                  backgroundColor:
                    schedule.repeat === value
                      ? themeColors.accentColor
                      : themeColors.backgroundColor2,
                },
              ]}
            >
              <Text style={[styles.weekButtonText, { color: themeColors.textColor }]}>
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  repeatContainer: {
    marginBottom: 20,
  },
  repeatLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  repeatButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weekButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  weekButtonText: {
    fontSize: 16,
  },
});
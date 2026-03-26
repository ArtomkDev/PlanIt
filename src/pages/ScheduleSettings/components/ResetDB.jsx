import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useSchedule } from '../../../context/ScheduleProvider';
import SettingsScreenLayout from '../SettingsScreenLayout';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';

export default function ResetDB() {
  const { resetApplication, global, isLoading } = useSchedule();
  const [isResetting, setIsResetting] = useState(false);
  const lang = global?.language || 'uk';

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleReset = () => {
    Alert.alert(
      t('settings.reset_db_screen.alert_title', lang),
      t('settings.reset_db_screen.alert_msg', lang),
      [
        { text: t('common.cancel', lang), style: "cancel" },
        {
          text: t('settings.reset_db_screen.alert_confirm', lang),
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            await resetApplication();
            setIsResetting(false);
            Alert.alert(t('common.success', lang), t('settings.reset_db_screen.success_msg', lang));
          },
        },
      ]
    );
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{t('settings.reset_db_screen.box_title', lang)}</Text>
          <Text style={styles.warningText}>
            {t('settings.reset_db_screen.box_text', lang)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.resetButton, { opacity: isResetting || isLoading ? 0.6 : 1 }]}
          onPress={handleReset}
          disabled={isResetting || isLoading}
        >
          {isResetting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.resetButtonText}>{t('settings.reset_db_screen.button_text', lang)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  warningBox: {
    backgroundColor: '#fff3cd', 
    borderColor: '#ffecb5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 30,
    width: '100%',
  },
  warningTitle: {
    color: '#856404',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#ff4d4d',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: "#ff4d4d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
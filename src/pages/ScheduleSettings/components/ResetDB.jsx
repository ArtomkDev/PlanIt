import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useSchedule } from '../../../context/ScheduleProvider';
import SettingsScreenLayout from '../SettingsScreenLayout';
import themes from '../../../config/themes';

export default function ResetDB() {
  const { resetApplication, global, isLoading } = useSchedule();
  const [isResetting, setIsResetting] = useState(false);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleReset = () => {
    Alert.alert(
      "Скинути розклади?",
      "Ваші налаштування теми та акаунту збережуться, але всі створені розклади будуть видалені і замінені на стандартний.",
      [
        { text: "Скасувати", style: "cancel" },
        {
          text: "Скинути",
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            await resetApplication();
            setIsResetting(false);
            Alert.alert("Успішно", "Розклади оновлено.");
          },
        },
      ]
    );
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Очищення розкладів</Text>
          <Text style={styles.warningText}>
            Ця дія видалить усі ваші поточні пари та розклади, але збереже налаштування додатку.
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
            <Text style={styles.resetButtonText}>Скинути розклади</Text>
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
    backgroundColor: '#fff3cd', // Жовтий замість червоного, бо це не повний wipe
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
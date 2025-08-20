// src/pages/ScheduleSettings/ScheduleSettings.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';

export default function ScheduleSettings() {
  const navigation = useNavigation();
  const { schedule } = useSchedule();

  // Отримуємо тему і кольори з schedule
  const theme = schedule?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  const settingsItems = [
    { label: 'Кількість перерв', screen: 'Breaks' },
    { label: 'Кількість тижнів', screen: 'Weeks' },
    { label: 'Початкова дата', screen: 'StartWeek' },
    { label: 'Пари', screen: 'Subjects' },
    { label: 'Викладачі', screen: 'Teachers' },
    { label: 'Розклад', screen: 'Schedule' },
    { label: 'Скинути БД', screen: 'ResetDB' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      {settingsItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.button, { backgroundColor: themeColors.backgroundColor2 }]}
          onPress={() =>
            navigation.navigate(item.screen, {
              scheduleId: schedule?.id, // передаємо тільки ID, решта даних через контекст
            })
          }
        >
          <Text style={[styles.buttonText, { color: themeColors.textColor }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  button: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
  },
});

// src/pages/ScheduleSettings/ScheduleSettings.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function ScheduleSettings(props) {
  const navigation = useNavigation();

  // Параметри тепер беремо з props (бо ми їх передаємо через Stack.Screen у TabNavigator)
  const {
    schedule,
    authUser,
    setSchedule,
    onDataChange,
    themeColors,
    accent,
  } = props ?? {};

  const settingsItems = [
    { label: 'Кількість перерв', screen: 'Breaks' },
    { label: 'Кількість тижнів', screen: 'Weeks' },
    { label: 'Початкова дата', screen: 'StartWeek' }, // виправив назву під стек
    { label: 'Теми', screen: 'Subjects' }, // щоб відповідало стеку
    { label: 'Викладачі', screen: 'Teachers' }, // додав зі стеку
    { label: 'Скинути БД', screen: 'ResetDB' }, // зі стеку
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Налаштування розкладу</Text>

      {settingsItems.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.button}
          onPress={() =>
            navigation.navigate(item.screen, {
              schedule,
              authUser,
              setSchedule,
              onDataChange,
              themeColors,
              accent,
            })
          }
        >
          <Text style={styles.buttonText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#252527',
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#373737',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
  },
});

import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { Button, StyleSheet, View, Text } from 'react-native'
import AutoSaveManager from '../components/AutoSaveManager'
import TabNavigator from '../Navigation/TabNavigator'
import { useSchedule } from '../context/ScheduleProvider'
import themes from '../config/themes'

export default function MainLayout() {
  const {
    schedule,
    saveNow,
    isDirty,
    isLoading,
    error,
  } = useSchedule()

  // якщо розклад ще не завантажений
  if (isLoading) return <Text>Завантаження...</Text>
  if (error) return <Text>Помилка: {error}</Text>
  if (!schedule) return <Text>Немає даних розкладу</Text>

  // дістаємо тему із schedule
  const [currentTheme, accentColor] = schedule.theme || ['light', 'blue']
  const themeColors = themes[currentTheme] || themes.light

  return (
    <View style={[{ flex: 1, paddingTop: 40, backgroundColor: themeColors.backgroundColor }]}>
      <StatusBar
        style={currentTheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={themeColors.backgroundColor}
        animated={true}
      />

      <View style={styles.container}>
        {isDirty && (
          <Button title="Зберегти зараз" onPress={saveNow} />
        )}
        <TabNavigator />
      </View>

      <AutoSaveManager />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})

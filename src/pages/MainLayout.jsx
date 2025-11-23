import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { StyleSheet, View, Text } from 'react-native'
// import { useSafeAreaInsets } from 'react-native-safe-area-context' // Більше не потрібно, бо ми не малюємо окремий фон

import AutoSaveManager from '../components/AutoSaveManager'
import TabNavigator from '../Navigation/TabNavigator'
import { useSchedule } from '../context/ScheduleProvider'
import themes from '../config/themes'

export default function MainLayout({ guest, onExitGuest }) {
  const {
    global,
    schedule,
    isLoading,
    error
  } = useSchedule()

  if (isLoading && !schedule) return <Text>Завантаження...</Text>
  if (error && !schedule) return <Text>Помилка: {error}</Text>
  if (!schedule) return <Text>Немає даних розкладу</Text>

  const [currentTheme] = global.theme || ['light', 'blue']
  const themeColors = themes.getColors(currentTheme, global.theme?.[1]);

  const isLightMode = currentTheme === 'light';

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      {/* Ми прибрали <AppBlur ... />, який був тут раніше.
          Тепер фон статус-бару контролюється виключно Хедерами сторінок (Schedule або Settings),
          що усуває проблему "подвійного шару".
      */}

      <StatusBar
        translucent
        style={isLightMode ? 'dark' : 'light'}
      />

      <View style={styles.container}>
        <TabNavigator screenProps={{ guest, onExitGuest }} />
      </View>

      <AutoSaveManager />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
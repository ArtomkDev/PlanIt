import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { Button, StyleSheet, View, Text } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import AutoSaveManager from '../components/AutoSaveManager'
import TabNavigator from '../Navigation/TabNavigator'
import { useSchedule } from '../context/ScheduleProvider'
import themes from '../config/themes'

export default function MainLayout() {
  const {
    global,
    schedule,
    isLoading,
    error
  } = useSchedule()

  const insets = useSafeAreaInsets()

  // якщо розклад ще не завантажений
  if (isLoading && !schedule) return <Text>Завантаження...</Text>
  if (error && !schedule) return <Text>Помилка: {error}</Text>
  if (!schedule) return <Text>Немає даних розкладу</Text>


  // дістаємо тему із schedule
  const [currentTheme] = global.theme || ['light', 'blue']
  const themeColors = themes[currentTheme] || themes.light

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      {/* Розмиття під статус-бар */}
      <BlurView
        intensity={90}
        tint={currentTheme === 'dark' ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top, // висота статус-бара
        }}
      />

      <StatusBar
        translucent
        style={currentTheme === 'dark' ? 'light' : 'dark'}
      />

      <View style={styles.container}>
        <TabNavigator />
      </View>

      <AutoSaveManager />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})
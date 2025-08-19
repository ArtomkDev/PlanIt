// src/pages/MainLayout.jsx
import { StatusBar } from 'expo-status-bar'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import React, { useEffect, useState } from 'react'
import { Button, StyleSheet, View, Text } from 'react-native'
import AutoSaveManager from '../components/AutoSaveManager'
import TabNavigator from '../Navigation/TabNavigator'
import themes from '../config/themes'
import { useSchedule } from '../context/ScheduleProvider'

const Tab = createBottomTabNavigator()

export default function MainLayout() {
  const {
    schedule,
    setScheduleDraft, // локальні зміни
    saveNow,          // зберегти у Firebase
    isDirty,
    isLoading,
    error,
    user,
  } = useSchedule()

  const [lessonTimes, setLessonTimes] = useState([])
  const [startingWeek, setStartingWeek] = useState(1)
  const [theme, setTheme] = useState(['light', 'blue'])

  const [currentTheme, accentColor] = theme
  const themeColors = themes[currentTheme] || themes.light
  const accent = themes.accentColors[accentColor] || themes.accentColors.blue

  // коли розклад підвантажився — синхронізуємо відображення
  useEffect(() => {
    if (schedule) {
      setStartingWeek(schedule.starting_week)
      if (schedule.theme) setTheme(schedule.theme)
    }
  }, [schedule])

  // перерахунок часу пар
  useEffect(() => {
    if (schedule?.start_time && schedule?.duration && schedule?.breaks) {
      calculateLessonTimes(
        schedule.start_time,
        schedule.duration,
        schedule.breaks
      )
    }
  }, [schedule?.start_time, schedule?.duration, schedule?.breaks])

  const calculateLessonTimes = (startTime, duration, breaks) => {
    try {
      const [hours, minutes] = startTime.split(':').map(Number)
      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Некоректний формат start_time: ${startTime}`)
      }
      const start = new Date()
      start.setHours(hours, minutes, 0)
      const times = []
      let currentTime = new Date(start)

      breaks.forEach((breakDuration) => {
        const endOfLesson = new Date(
          currentTime.getTime() + duration * 60 * 1000
        )
        times.push({
          start: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          end: endOfLesson.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
        currentTime = new Date(endOfLesson.getTime() + breakDuration * 60 * 1000)
      })

      setLessonTimes(times)
    } catch (error) {
      console.error('Помилка обчислення часу пар:', error.message)
    }
  }

  // змінюємо початковий тиждень (локально) — без сейву
  const updateStartingWeek = (week) => {
    const formattedDate = new Date(
      week.getFullYear(),
      week.getMonth(),
      week.getDate()
    ).toISOString().split('T')[0]

    setScheduleDraft(prev => ({ ...prev, starting_week: formattedDate }))
    setStartingWeek(formattedDate)
  }

  const handleAutoSaveIntervalChange = (interval) => {
    setScheduleDraft(prev => ({ ...prev, auto_save: interval }))
    // таймер підхопить зміну через проп нижче
  }

  const handleDataChange = (updatedSchedule) => {
    setScheduleDraft(updatedSchedule)
  }

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    setScheduleDraft(prev => ({ ...prev, theme: newTheme }))
  }

  const autoSaveInterval = schedule?.auto_save ?? 30

  const commonProps = {
    schedule,
    authUser: user,
    autoSaveInterval,
    isUnsavedChanges: isDirty,
    setSchedule: setScheduleDraft,  // 🔁 щоб існуючі екрани не ламати
    onDataChange: handleDataChange,
    lessonTimes,
    updateStartingWeek,
    startingWeek,
    handleAutoSaveIntervalChange,
    onThemeChange: handleThemeChange,
    theme,
    themeColors,
    accent,
  }

  if (isLoading) return <Text>Завантаження...</Text>
  if (error) return <Text>Помилка: {error}</Text>

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
        <TabNavigator commonProps={commonProps} />
      </View>

      <AutoSaveManager
        onSave={saveNow}                     // ✅ зберігаємо тільки тут (і кнопкою)
        isUnsavedChanges={isDirty}
        autoSaveInterval={autoSaveInterval}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})

// src/components/AutoSaveManager.jsx
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text } from 'react-native'

export default function AutoSaveManager({
  onSave,
  isUnsavedChanges,
  autoSaveInterval,
  onAutoSaveComplete, // опціонально
}) {
  const timerRef = useRef(null)
  const [timeLeft, setTimeLeft] = useState(autoSaveInterval)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedMessage, setShowSavedMessage] = useState(false)

  const heightAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isUnsavedChanges) {
      startAutoSave()
      Animated.timing(heightAnim, {
        toValue: 30,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start()
    } else if (!showSavedMessage) {
      Animated.timing(heightAnim, {
        toValue: 0.01,
        duration: 500,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }).start(() => stopAutoSave())
    }
    return () => stopAutoSave()
  }, [isUnsavedChanges, autoSaveInterval, showSavedMessage])

  const startAutoSave = () => {
    stopAutoSave()
    setTimeLeft(autoSaveInterval)

    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime > 1) return prevTime - 1
        saveChanges()
        return autoSaveInterval
      })
    }, 1000)
  }

  const saveChanges = async () => {
  if (!isUnsavedChanges || isSaving) return
  setIsSaving(true)
  try {
    await new Promise((resolve) => {
      setTimeout(async () => {
        await onSave?.()
        resolve()
      }, 0)
    })

    setShowSavedMessage(true)
    setTimeout(() => setShowSavedMessage(false), 5000)
    onAutoSaveComplete?.()
  } catch (err) {
    console.error('Помилка автозбереження:', err)
  } finally {
    setIsSaving(false)
  }
}


  const stopAutoSave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const getDisplayText = () => {
    if (isSaving) return 'Збереження...'
    if (showSavedMessage) return 'Збережено'
    if (isUnsavedChanges) return `Час до автозбереження: ${timeLeft} сек.`
    return 'Всі зміни збережені.'
  }

  return (
    <Animated.View style={[styles.container, { height: heightAnim }]}>
      <Text style={styles.text}>{getDisplayText()}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffcc00',
    alignItems: 'center',
    overflow: 'hidden',
    height: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
})

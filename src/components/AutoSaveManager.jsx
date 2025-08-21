import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import { useSchedule } from "../context/ScheduleProvider"; // беремо дані з контексту

export default function AutoSaveManager() {
  const { saveNow, isDirty, isSaving } = useSchedule();
  const autoSaveInterval = 10; // сек. — можна винести у ScheduleProvider

  const timerRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(autoSaveInterval);
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  const heightAnim = useRef(new Animated.Value(0)).current;

  // Запускаємо автозбереження лише після рендеру
  useEffect(() => {
    if (isDirty) {
      const startTimeout = setTimeout(() => {
        startAutoSave();
        Animated.timing(heightAnim, {
          toValue: 30,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start();
      }, 0);

      return () => {
        clearTimeout(startTimeout);
        stopAutoSave();
      };
    } else if (!showSavedMessage) {
      Animated.timing(heightAnim, {
        toValue: 0.01,
        duration: 500,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }).start(() => stopAutoSave());
    }
  }, [isDirty, autoSaveInterval, showSavedMessage]);

  const startAutoSave = () => {
    stopAutoSave();
    setTimeLeft(autoSaveInterval);

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime > 1) return prevTime - 1;
        // зберігаємо після завершення рендеру
        requestAnimationFrame(saveChanges);
        return autoSaveInterval;
      });
    }, 1000);
  };

  const saveChanges = async () => {
    if (!isDirty || isSaving) return;
    try {
      await saveNow();
      setShowSavedMessage(true);
      setTimeout(() => setShowSavedMessage(false), 5000);
    } catch (err) {
      console.error("Помилка автозбереження:", err);
    }
  };

  const stopAutoSave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const getDisplayText = () => {
    if (isSaving) return "Збереження...";
    if (showSavedMessage) return "Збережено";
    if (isDirty) return `Час до автозбереження: ${timeLeft} сек.`;
    return "Всі зміни збережені.";
  };

  return (
    <Animated.View style={[styles.container, { height: heightAnim }]}>
      <Text style={styles.text}>{getDisplayText()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffcc00",
    alignItems: "center",
    overflow: "hidden",
    height: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333",
  },
});

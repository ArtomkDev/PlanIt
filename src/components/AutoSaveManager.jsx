import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Pressable } from "react-native";
import { useSchedule } from "../context/ScheduleProvider";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global, isOnline, conflictQueue, cloudSyncState } = useSchedule();
  const autoSaveInterval = global?.auto_save || 60;

  const [timeLeft, setTimeLeft] = useState(autoSaveInterval);
  
  const [statusMessage, setStatusMessage] = useState("");
  const [statusColor, setStatusColor] = useState("#4dff88"); 
  const [showSavedState, setShowSavedState] = useState(false);

  const timerRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const prevCloudSavingRef = useRef(false);
  
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // 1. Управління таймером
  useEffect(() => {
    if (!user) return;

    // 🔥 Таймер має право стартувати ТІЛЬКИ якщо Firebase підтвердив, що ми в синхроні ('synced')
    const canStartTimer = isDirty && isOnline && !isCloudSaving && cloudSyncState === 'synced' && conflictQueue.length === 0;

    if (canStartTimer && !timerRef.current) {
      setTimeLeft(autoSaveInterval);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    
    // Якщо таймер працював, але зв'язок пропав, або почалася перевірка - зупиняємо
    if (!canStartTimer && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isDirty, isOnline, isCloudSaving, cloudSyncState, autoSaveInterval, user, conflictQueue.length]);

  // 2. Дія по закінченню таймера
  useEffect(() => {
    if (timeLeft === 0 && isDirty && !isCloudSaving && cloudSyncState === 'synced' && conflictQueue.length === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeLeft(autoSaveInterval);
      saveNow();
    }
  }, [timeLeft, isDirty, isCloudSaving, cloudSyncState, saveNow, autoSaveInterval, conflictQueue.length]);

  // 3. Візуалізація успішного збереження
  useEffect(() => {
    const justFinishedSaving = prevCloudSavingRef.current === true && isCloudSaving === false;
    
    if (justFinishedSaving && !isDirty && isOnline) {
      setShowSavedState(true);
      
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

      hideTimeoutRef.current = setTimeout(() => {
        setShowSavedState(false);
      }, 5000);
    } else if (isDirty || isCloudSaving || !isOnline) {
      setShowSavedState(false);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    }
    
    prevCloudSavingRef.current = isCloudSaving;
  }, [isCloudSaving, isDirty, isOnline]);

  // 4. Логіка відображення плашки
  useEffect(() => {
    let shouldShow = false;

    if (conflictQueue.length > 0) {
      shouldShow = false; 
    } else if (!isOnline) {
      setStatusMessage("Немає інтернету");
      setStatusColor("#ff4d4d");
      shouldShow = true;
    } else if (cloudSyncState === 'syncing') {
      // 🔥 Цей статус висітиме стільки, скільки Firebase буде встановлювати реальне з'єднання з Google
      setStatusMessage("Синхронізація з хмарою...");
      setStatusColor("#3399ff"); 
      shouldShow = true;
    } else if (isCloudSaving) {
      setStatusMessage("Збереження у хмару...");
      setStatusColor("#ffcc00");
      shouldShow = true;
    } else if (isDirty) {
      setStatusMessage(`Автозбереження через: ${timeLeft} сек`);
      setStatusColor("#ffcc00");
      shouldShow = true;
    } else if (showSavedState) {
      setStatusMessage("Всі зміни збережено");
      setStatusColor("#4dff88");
      shouldShow = true;
    } else {
      shouldShow = false;
    }

    if (shouldShow) {
      showBar();
    } else {
      hideBar();
    }
  }, [isOnline, isCloudSaving, isDirty, cloudSyncState, timeLeft, showSavedState, conflictQueue.length]);

  const showBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 40, duration: 300, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: false })
    ]).start();
  };

  const hideBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false })
    ]).start();
  };

  if (!user) return null;

  return (
    <Pressable onPress={(isDirty && conflictQueue.length === 0 && cloudSyncState === 'synced') ? () => saveNow() : null}>
      <Animated.View 
        style={[
          styles.container, 
          { 
            height: heightAnim, 
            backgroundColor: statusColor,
            opacity: opacityAnim
          }
        ]}
      >
        <Animated.Text style={styles.text}>
          {statusMessage}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
  },
});
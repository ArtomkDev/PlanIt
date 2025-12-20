import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Pressable } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSchedule } from "../context/ScheduleProvider";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global } = useSchedule();
  const autoSaveInterval = global?.auto_save || 60;

  const [timeLeft, setTimeLeft] = useState(autoSaveInterval);
  const [isConnected, setIsConnected] = useState(true);
  
  // UI States
  const [statusMessage, setStatusMessage] = useState("");
  const [statusColor, setStatusColor] = useState("#4dff88"); 
  const [showSavedState, setShowSavedState] = useState(false); // Для утримання "Збережено"

  // Refs
  const timerRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  
  // Animations
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // 1. Monitor Connection
  useEffect(() => {
    if (!user) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsubscribe();
  }, [user]);

  // 2. LOGIC: Timer (Non-resetting)
  useEffect(() => {
    if (!user) return;

    // Якщо є зміни, є інтернет, не йде збереження і таймер ЩЕ НЕ ЗАПУЩЕНИЙ
    if (isDirty && isConnected && !isCloudSaving && !timerRef.current) {
      
      // Скидаємо час на початок циклу тільки якщо таймер не був активний
      setTimeLeft(autoSaveInterval);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Час вийшов -> Зберігаємо
            clearInterval(timerRef.current);
            timerRef.current = null;
            saveNow(); 
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    // Якщо раптом зник інтернет або почалося хмарне збереження - ставимо таймер на паузу/стоп
    if ((!isConnected || isCloudSaving) && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      // Чистимо таймер тільки при розмонтуванні компонента
      // (ми навмисно не чистимо його при зміні isDirty, щоб він не скидався)
    };
  }, [isDirty, isConnected, isCloudSaving, autoSaveInterval, user, saveNow]);

  // 3. LOGIC: Handle "Saved" state duration (5 seconds)
  useEffect(() => {
    // Якщо збереження завершилось (isCloudSaving: true -> false) і немає нових змін (!isDirty)
    if (!isCloudSaving && !isDirty && isConnected) {
      setShowSavedState(true);
      
      // Очищаємо попередній таймаут, якщо був
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

      // Ховаємо через 5 секунд
      hideTimeoutRef.current = setTimeout(() => {
        setShowSavedState(false);
      }, 5000);
    } else if (isDirty || isCloudSaving || !isConnected) {
      // Якщо почали щось міняти - одразу прибираємо стан "Збережено" (щоб показати таймер)
      setShowSavedState(false);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    }
  }, [isCloudSaving, isDirty, isConnected]);


  // 4. UI: Update Text & Visibility
  useEffect(() => {
    let shouldShow = false;

    if (!isConnected) {
      setStatusMessage("Немає інтернету");
      setStatusColor("#ff4d4d"); // Red
      shouldShow = true;
    } else if (isCloudSaving) {
      setStatusMessage("Збереження у хмару...");
      setStatusColor("#ffcc00"); // Yellow
      shouldShow = true;
    } else if (isDirty) {
      setStatusMessage(`Автозбереження через: ${timeLeft} сек`);
      setStatusColor("#ffcc00"); // Yellow
      shouldShow = true;
    } else if (showSavedState) {
      // Показуємо "Збережено" протягом 5 секунд
      setStatusMessage("Всі зміни збережено");
      setStatusColor("#4dff88"); // Green
      shouldShow = true;
    } else {
      shouldShow = false;
    }

    if (shouldShow) {
      showBar();
    } else {
      hideBar();
    }
  }, [isConnected, isCloudSaving, isDirty, timeLeft, showSavedState]);

  const showBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: 40,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  };

  const hideBar = () => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      })
    ]).start();
  };

  if (!user) return null;

  return (
    <Pressable onPress={isDirty ? saveNow : null}>
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
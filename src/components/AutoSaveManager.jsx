import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, Pressable } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSchedule } from "../context/ScheduleProvider";

export default function AutoSaveManager() {
  const { saveNow, isCloudSaving, isDirty, user, global } = useSchedule();
  const autoSaveInterval = global?.auto_save || 60;

  const timerRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(autoSaveInterval);
  const [isConnected, setIsConnected] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  const heightAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const bgColorAnim = useRef(new Animated.Value(0)).current;

  const [displayText, setDisplayText] = useState("");
  const [shouldShow, setShouldShow] = useState(false);
  const [hideTimeout, setHideTimeout] = useState(null);
  const lastColorValue = useRef(0);

  if (!user) return null;

  // Слухаємо інтернет
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasDisconnected = !isConnected && state.isConnected;
      setIsConnected(state.isConnected);

      if (wasDisconnected) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 1000);
      }
    });
    return () => unsubscribe();
  }, [isConnected]);

  // Висота таблички з затримкою перед схованням
  useEffect(() => {
    const shouldBeVisible = isDirty || isCloudSaving || !isConnected || showReconnected;
    if (shouldBeVisible) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        setHideTimeout(null);
      }
      setShouldShow(true);
      Animated.timing(heightAnim, {
        toValue: 45,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
      if (isDirty && !timerRef.current) startAutoSave();
    } else {
      const timeout = setTimeout(() => {
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => setShouldShow(false));
        stopAutoSave();
      }, 5000);
      setHideTimeout(timeout);
    }
  }, [isDirty, isCloudSaving, isConnected, showReconnected]);

  // Текст + колір
  useEffect(() => {
    let newText = "";
    let colorValue = 0; // 0 = жовтий, 1 = червоний, 2 = зелений

    if (showReconnected) {
      newText = "З'єднання відновлено";
      colorValue = 2;
    } else if (!isConnected) {
      newText = "Немає інтернету";
      colorValue = 1;
    } else if (isCloudSaving) {
      newText = "Збереження у хмару...";
      colorValue = 0;
    } else if (isDirty) {
      newText = `Автозбереження через: ${timeLeft} сек.`;
      colorValue = 0;
    } else {
      newText = "Усі зміни збережені у хмарі!";
      colorValue = 2;
    }

    if (lastColorValue.current !== colorValue) {
      Animated.timing(bgColorAnim, {
        toValue: colorValue,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      lastColorValue.current = colorValue;
    }

    if (displayText.split(":")[0] !== newText.split(":")[0]) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setDisplayText(newText);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    } else {
      setDisplayText(newText);
    }
  }, [isConnected, isCloudSaving, isDirty, timeLeft, showReconnected]);

  // Таймер автозбереження
  const startAutoSave = () => {
    stopAutoSave();
    setTimeLeft(autoSaveInterval);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev > 1) return prev - 1;
        if (isConnected && isDirty) saveNow();
        return autoSaveInterval;
      });
    }, 1000);
  };

  const stopAutoSave = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const backgroundColor = bgColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ["#ffcc00", "#ff4d4d", "#4dff88"],
  });

  if (!shouldShow) return null;

  return (
    <Pressable onPress={saveNow}>
      <Animated.View style={[styles.container, { height: heightAnim, backgroundColor }]}>
        <Animated.Text style={[styles.text, { opacity: fadeAnim }]}>{displayText}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    overflow: "hidden",
    justifyContent: "center",
  },
  text: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
});

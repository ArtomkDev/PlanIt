import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSchedule } from "../context/ScheduleProvider";
import themes from "../config/themes";

export default function AppBlur({ style, intensity = 80 }) {
  const { global } = useSchedule();
  if (!global) return null;

  const [mode, accent] = global.theme || ["light", "blue"];
  const blurEnabled = global.blur ?? true; // За замовчуванням увімкнено
  const themeColors = themes.getColors(mode, accent);

  // Якщо блюр вимкнено глобально, повертаємо суцільний фон
  if (!blurEnabled) {
    return (
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: themeColors.backgroundColorTabNavigator || themeColors.backgroundColor2 }, 
          style
        ]} 
      />
    );
  }

  // Логіка тінту: для OLED та Dark завжди 'dark', для Light - 'light'
  const blurTint = (mode === "oled" || mode === "dark") ? "dark" : "light";

  // Для Android іноді краще зменшити інтенсивність або використати View
  if (Platform.OS === "android") {
    return (
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(20,20,20,0.9)' }, 
          style
        ]} 
      />
    );
  }

  return (
    <BlurView 
      intensity={intensity} 
      tint={blurTint} 
      style={[StyleSheet.absoluteFill, style]} 
    />
  );
}
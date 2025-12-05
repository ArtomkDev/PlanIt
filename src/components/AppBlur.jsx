import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSchedule } from "../context/ScheduleProvider";
import themes from "../config/themes";

export default function AppBlur({ style, intensity = 80, children }) {
  const { global } = useSchedule();
  
  const themeSetting = global?.theme || ["light", "blue"];
  const [mode, accent] = Array.isArray(themeSetting) ? themeSetting : ["light", "blue"];
  
  const blurEnabled = global?.blur ?? true; 
  const themeColors = themes.getColors(mode, accent);

  // Фолбек для Android або якщо блюр вимкнено
  if (!blurEnabled || Platform.OS === "android") {
    const fallbackColor = !blurEnabled 
      ? (themeColors.backgroundColorTabNavigator || themeColors.backgroundColor2)
      : (mode === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(20,20,20,0.95)');

    return (
      <View style={[{ backgroundColor: fallbackColor }, style]}>
        {children}
      </View>
    );
  }

  const blurTint = (mode === "oled" || mode === "dark") ? "dark" : "light";

  return (
    <BlurView 
      intensity={intensity} 
      tint={blurTint} 
      style={style} 
    >
      {/* 🔥 Цей шар вирівнює відтінок блюру всюди (Хедер vs Навігація) */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.backgroundColor, opacity: 0.4 }]} />
      
      {children}
    </BlurView>
  );
}
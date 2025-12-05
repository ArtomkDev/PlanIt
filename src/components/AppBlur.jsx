import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useNavigationState } from "@react-navigation/native";
import { useSchedule } from "../context/ScheduleProvider";
import themes from "../config/themes";

export default function AppBlur({ style, intensity = 80, children }) {
  const { global } = useSchedule();
  
  const themeSetting = global?.theme || ["light", "blue"];
  const [mode, accent] = Array.isArray(themeSetting) ? themeSetting : ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const blurEnabled = global?.blur ?? true;

  // --- 🔥 РОЗУМНА ЛОГІКА БЛЮРУ ---
  // Ми використовуємо useNavigationState, щоб дізнатися назву активного екрану.
  // Цей хук безпечно працює і в TabBar, і в Headers.
  let activeRouteName = "Unknown";
  try {
    activeRouteName = useNavigationState(state => state?.routes?.[state?.index]?.name);
  } catch (e) {
    // Якщо компонент використовується поза навігацією, ігноруємо помилку
  }

  // Якщо ми в "Розкладі" (Home3_1) -> темніше (0.7), інакше (Налаштування та ін.) -> світліше (0.1)
  const dynamicOpacity = activeRouteName === 'Home3_1' ? 0.7 : 0.1;

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
      {/* Шар з динамічною прозорістю */}
      <View style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: themeColors.backgroundColor, 
          opacity: dynamicOpacity // 🔥 AppBlur вирішує це сам!
        }
      ]} />
      
      {children}
    </BlurView>
  );
}
// src/components/common/AppBlur.js
import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSchedule } from "../context/ScheduleProvider";
import themes from "../config/themes";

export default function AppBlur({ style }) {
  const { global } = useSchedule();
  if (!global) return null;

  const [mode, accent] = global.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent); // ✅ беремо всі кольори теми

  const blurProps = {
    intensity: mode === "dark" ? 80 : 100,
    tint: mode === "dark" ? "dark" : "light",
  };

  // ✅ фон на Android тепер залежить від themes.js
  const androidFallback = {
    backgroundColor: themeColors.backgroundColor2, 
    // наприклад, у themes.js можна додати blurBackground: "rgba(43,43,43,0.6)"
  };

  return Platform.OS === "android" ? (
    <View style={[StyleSheet.absoluteFill, androidFallback, style]} />
  ) : (
    <BlurView {...blurProps} style={[StyleSheet.absoluteFill, style]} />
  );
}

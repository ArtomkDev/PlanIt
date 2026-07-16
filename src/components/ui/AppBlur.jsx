import React from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useNavigationState } from "@react-navigation/native";
import { useScheduleData } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

export default function AppBlur({ style, intensity = 80, children }) {
  const { global } = useScheduleData();
  const blurEnabled = global?.blur ?? true;
  
  const themeSetting = global?.theme || ["light", "blue"];
  const [mode, accent] = Array.isArray(themeSetting) ? themeSetting : ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const navState = useNavigationState(state => state);
  const activeRouteName = navState?.routes?.[navState?.index]?.name || "Unknown";

  const dynamicOpacity = activeRouteName === 'ScheduleTab' || activeRouteName === 'TasksTab' ? 0.7 : 0.1;
  const solidColor = themeColors.backgroundColor2;

  if (Platform.OS === "android" || !blurEnabled) {
    return (
      <View style={[{ backgroundColor: solidColor }, style]}>
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
      <View style={[
        StyleSheet.absoluteFill, 
        { 
          backgroundColor: themeColors.backgroundColor, 
          opacity: dynamicOpacity 
        }
      ]} />
      {children}
    </BlurView>
  );
}

import React, { useState, useEffect } from "react";
import { View, Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useNavigationState } from "@react-navigation/native";
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";
import { getDevicePrefs } from "../../utils/storage";

export default function AppBlur({ style, intensity = 80, children }) {
  const { global } = useSchedule();
  const [localBlurEnabled, setLocalBlurEnabled] = useState(true);
  
  const themeSetting = global?.theme || ["light", "blue"];
  const [mode, accent] = Array.isArray(themeSetting) ? themeSetting : ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const navState = useNavigationState(state => state);
  const activeRouteName = navState?.routes?.[navState?.index]?.name || "Unknown";

  const dynamicOpacity = activeRouteName === 'ScheduleTab' ? 0.7 : 0.1;
  const solidColor = themeColors.backgroundColor2;

  useEffect(() => {
    let isMounted = true;
    getDevicePrefs().then((prefs) => {
      if (isMounted) {
        if (prefs && typeof prefs.blur === 'boolean') {
          setLocalBlurEnabled(prefs.blur);
        } else {
          setLocalBlurEnabled(global?.blur ?? true);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [global?.blur]);

  if (Platform.OS === "android" || !localBlurEnabled) {
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
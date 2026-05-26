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
  const transparentColor = mode === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(20,20,20,0.85)';

  useEffect(() => {
    let isMounted = true;
    getDevicePrefs().then((prefs) => {
      if (isMounted) {
        // If the user has explicitly set a blur preference on this device, use it.
        // Otherwise, fall back to the cloud global preference, or default to true.
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
  }, [global?.blur]); // Re-run if global blur changes to catch updates where local isn't set yet

  if (!localBlurEnabled) {
    return (
      <View style={[{ backgroundColor: solidColor }, style]}>
        {children}
      </View>
    );
  }

  if (Platform.OS === "android") {
    return (
      <View style={[{ backgroundColor: transparentColor }, style]}>
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
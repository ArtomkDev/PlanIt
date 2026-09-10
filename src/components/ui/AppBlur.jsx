import React from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useNavigationState } from "@react-navigation/native";
import { useScheduleData } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

export default function AppBlur({
  style,
  intensity = 80,
  children,
  backgroundColor,
  backgroundColorTo,
  overlayColor,
  overlayColorTo,
  colorProgress,
}) {
  const { global: globalSettings } = useScheduleData();
  const blurEnabled = globalSettings?.blur ?? true;
  
  const themeSetting = globalSettings?.theme || ["light", "blue"];
  const [mode, accent] = Array.isArray(themeSetting) ? themeSetting : ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const navState = useNavigationState(state => state);
  const activeRouteName = navState?.routes?.[navState?.index]?.name || "Unknown";

  const dynamicOpacity = activeRouteName === 'ScheduleTab' || activeRouteName === 'TasksTab' ? 0.7 : 0.1;
  const solidColor = backgroundColor || themeColors.backgroundColor2;
  const finalSolidColor = backgroundColorTo || solidColor;
  const translucentOverlayColor = overlayColor || themeColors.backgroundColor;
  const finalTranslucentOverlayColor = overlayColorTo || translucentOverlayColor;
  const solidAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress?.value ?? 0,
      [0, 1],
      [solidColor, finalSolidColor]
    ),
  }), [finalSolidColor, solidColor]);
  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress?.value ?? 0,
      [0, 1],
      [translucentOverlayColor, finalTranslucentOverlayColor]
    ),
    opacity: dynamicOpacity,
  }), [dynamicOpacity, finalTranslucentOverlayColor, translucentOverlayColor]);

  if (Platform.OS === "android" || !blurEnabled) {
    return (
      <Animated.View style={[style, solidAnimatedStyle]}>
        {children}
      </Animated.View>
    );
  }

  const blurTint = (mode === "oled" || mode === "dark") ? "dark" : "light";

  return (
    <BlurView 
      intensity={intensity} 
      tint={blurTint} 
      style={style} 
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          overlayAnimatedStyle,
        ]}
      />
      {children}
    </BlurView>
  );
}

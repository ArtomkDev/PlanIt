import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { getIconComponent } from "../config/subjectIcons";

const getFallbackLetter = (name) => {
  const [firstCharacter] = Array.from(String(name || "").trim());
  return firstCharacter?.toLocaleUpperCase() || "•";
};

export default function ScheduleIcon({
  icon,
  name,
  size = 38,
  iconSize = Math.round(size * 0.56),
  backgroundColor = "transparent",
  color = "#fff",
  style,
}) {
  const Icon = getIconComponent(icon);

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.34),
          backgroundColor,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={iconSize} color={color} weight="bold" />
      ) : (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.letter, { color, fontSize: Math.round(size * 0.42) }]}
        >
          {getFallbackLetter(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    fontWeight: "800",
    textAlign: "center",
  },
});

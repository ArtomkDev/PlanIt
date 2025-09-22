// src/components/GradientBackground.jsx
import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GradientBackground({ gradient, style }) {
  if (!gradient || gradient.type !== "linear") {
    // fallback на перший колір, якщо немає градієнта
    return <View style={[style, { backgroundColor: gradient?.colors?.[0] || "#ccc" }]} />;
  }

  const colors = gradient.colors.map((c) => (typeof c === "string" ? c : c.color));
  const locations = gradient.colors.map((c) => (typeof c === "string" ? undefined : c.position));

  // кут у градусах
  const angle = gradient.angle ?? 0;
  const rad = (angle * Math.PI) / 180;

  // обчислюємо start і end для LinearGradient
  const start = { x: 0.5 - Math.cos(rad) / 2, y: 0.5 - Math.sin(rad) / 2 };
  const end = { x: 0.5 + Math.cos(rad) / 2, y: 0.5 + Math.sin(rad) / 2 };

  return <LinearGradient colors={colors} locations={locations} start={start} end={end} style={style} />;
}

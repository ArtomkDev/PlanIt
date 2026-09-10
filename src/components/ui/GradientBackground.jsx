// src/components/GradientBackground.jsx
import React from "react";
import { Platform, View } from "react-native";
import { normalizeGradientStops } from "../../utils/gradientColors";

const formatStopPosition = (position) => `${Math.round(position * 10000) / 100}%`;

export const getGradientBackgroundStyle = (gradient, fallbackColor = "#ccc") => {
  const stops = normalizeGradientStops(gradient);
  const resolvedFallback = stops[0]?.color || fallbackColor;

  if (!gradient || stops.length < 2) {
    return { backgroundColor: resolvedFallback };
  }

  const rawAngle = Number(gradient.angle);
  const angle = Number.isFinite(rawAngle) ? rawAngle : 0;
  const colorStops = stops
    .map((stop) => `${stop.color} ${formatStopPosition(stop.position)}`)
    .join(", ");
  const backgroundImage = gradient.type === "radial"
    ? `radial-gradient(circle, ${colorStops})`
    // The editor angle uses 0° = left-to-right. CSS uses 90° for that direction.
    : `linear-gradient(${((angle + 90) % 360 + 360) % 360}deg, ${colorStops})`;

  return Platform.OS === "web"
    ? { backgroundColor: resolvedFallback, backgroundImage }
    : { backgroundColor: resolvedFallback, experimental_backgroundImage: backgroundImage };
};

export default function GradientBackground({ gradient, style, fallbackColor = "#ccc", children }) {
  return (
    <View style={[style, getGradientBackgroundStyle(gradient, fallbackColor)]}>
      {children}
    </View>
  );
}

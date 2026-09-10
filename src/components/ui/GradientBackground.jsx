import React from "react";
import { Platform, View } from "react-native";
import {
  multiplyColorAlpha,
  normalizeGradientStops,
  resolveValidColor,
} from "../../utils/gradientColors";

const DEFAULT_FALLBACK_COLOR = "#ccc";
const formatStopPosition = (position) => `${Math.round(position * 10000) / 100}%`;

const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;

const getPointValue = (point, key, fallback) => {
  const value = Number(point?.[key]);
  return Number.isFinite(value) ? value : fallback;
};

export const getGradientAngleFromPoints = (
  start,
  end,
  fallbackAngle = 90,
) => {
  if (!start && !end) return normalizeAngle(fallbackAngle);

  const startX = getPointValue(start, "x", 0.5);
  const startY = getPointValue(start, "y", 0);
  const endX = getPointValue(end, "x", 0.5);
  const endY = getPointValue(end, "y", 1);
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  if (Math.abs(deltaX) < 0.0001 && Math.abs(deltaY) < 0.0001) {
    return normalizeAngle(fallbackAngle);
  }

  return normalizeAngle(Math.atan2(deltaY, deltaX) * (180 / Math.PI));
};

export const createGradientDefinition = ({
  colors = [],
  locations,
  type = "linear",
  angle,
  start,
  end,
} = {}) => {
  const directColors = Array.isArray(colors) ? colors : [];
  const directLocations = Array.isArray(locations) ? locations : [];
  const numericAngle = Number(angle);
  const resolvedAngle = Number.isFinite(numericAngle)
    ? normalizeAngle(numericAngle)
    : getGradientAngleFromPoints(start, end, 90);

  return {
    type: type === "radial" || type === "radial-gradient" ? "radial" : "linear",
    angle: resolvedAngle,
    colors: directColors.map((entry, index) => ({
      color: typeof entry === "string" ? entry : entry?.color,
      position: Number.isFinite(Number(directLocations[index]))
        ? Number(directLocations[index])
        : entry?.position,
    })),
  };
};

const resolveLayer = (layer, fallbackOpacity = 1) => {
  if (!layer) return null;

  const gradient = layer.gradient
    || (
      Array.isArray(layer.colors)
        ? createGradientDefinition(layer)
        : layer
    );
  const opacity = layer.opacity ?? fallbackOpacity;
  const stops = normalizeGradientStops(gradient).map((stop) => ({
    ...stop,
    color: multiplyColorAlpha(stop.color, opacity, stop.color),
  }));

  const rawAngle = Number(gradient.angle);
  const angle = Number.isFinite(rawAngle) ? rawAngle : 0;
  const colorStopsText = stops
    .map((stop) => `${stop.color} ${formatStopPosition(stop.position)}`)
    .join(", ");

  const backgroundImage = stops.length < 2
    ? null
    : gradient.type === "radial"
      ? `radial-gradient(circle, ${colorStopsText})`
      // PlanIt angles use 0° = left-to-right. CSS uses 90° for that direction.
      : `linear-gradient(${normalizeAngle(angle + 90)}deg, ${colorStopsText})`;

  return { stops, backgroundImage };
};

export const getGradientSurfaceStyle = ({
  gradient,
  layers,
  colors,
  locations,
  type = "linear",
  angle,
  start,
  end,
  gradientOpacity = 1,
  fallbackColor = null,
} = {}) => {
  const layerInputs = Array.isArray(layers) && layers.length > 0
    ? layers
    : [
      gradient
        ? { gradient, opacity: gradientOpacity }
        : {
          colors,
          locations,
          type,
          angle,
          start,
          end,
          opacity: gradientOpacity,
        },
    ];
  const resolvedLayers = layerInputs
    .map((layer) => resolveLayer(layer, gradientOpacity))
    .filter(Boolean);
  const automaticFallback = [...resolvedLayers]
    .reverse()
    .find((layer) => layer.stops.length > 0)
    ?.stops[0]?.color;
  const resolvedFallback = resolveValidColor(fallbackColor)
    || automaticFallback
    || DEFAULT_FALLBACK_COLOR;
  const backgroundImage = resolvedLayers
    .map((layer) => layer.backgroundImage)
    .filter(Boolean)
    .join(", ");

  if (!backgroundImage) {
    return { backgroundColor: resolvedFallback };
  }

  return Platform.OS === "web"
    ? { backgroundColor: resolvedFallback, backgroundImage }
    : { backgroundColor: resolvedFallback, experimental_backgroundImage: backgroundImage };
};

export const getGradientBackgroundStyle = (
  gradient,
  fallbackColor = null,
  options = {},
) => getGradientSurfaceStyle({ gradient, fallbackColor, ...options });

const GradientBackground = React.forwardRef(function GradientBackground({
  component: Component = View,
  gradient = null,
  layers = null,
  colors = null,
  locations = null,
  type = "linear",
  angle,
  start,
  end,
  gradientOpacity = 1,
  fallbackColor = null,
  style,
  children,
  ...props
}, ref) {
  const backgroundStyle = getGradientSurfaceStyle({
    gradient,
    layers,
    colors,
    locations,
    type,
    angle,
    start,
    end,
    gradientOpacity,
    fallbackColor,
  });
  const composedStyle = typeof style === "function"
    ? (state) => [style(state), backgroundStyle]
    : [style, backgroundStyle];

  return (
    <Component ref={ref} {...props} style={composedStyle}>
      {children}
    </Component>
  );
});

GradientBackground.displayName = "GradientBackground";

export default GradientBackground;

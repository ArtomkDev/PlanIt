import tinycolor from "tinycolor2";

const DARK_FOREGROUND = "#111827";
const LIGHT_FOREGROUND = "#ffffff";
const WHITE_FOREGROUND_SWITCH_CONTRAST = 2.2;
const MIN_DARK_FOREGROUND_CONTRAST = 4.5;
const GRADIENT_CONTRAST_SAMPLE_COUNT = 11;

const clampLocation = (value) => Math.max(0, Math.min(1, value));

const getRawStops = (gradientOrStops) => {
  if (Array.isArray(gradientOrStops)) return gradientOrStops;
  return Array.isArray(gradientOrStops?.colors) ? gradientOrStops.colors : [];
};

export const resolveValidColor = (color, fallback = null) => {
  const parsed = tinycolor(color);
  return parsed.isValid() ? parsed.toRgbString() : fallback;
};

export const normalizeGradientStops = (gradientOrStops) => {
  const stops = getRawStops(gradientOrStops)
    .map((stop) => {
      const rawColor = typeof stop === "string" ? stop : stop?.color;
      const color = resolveValidColor(rawColor);
      if (!color) return null;

      const rawPosition = typeof stop === "object" && stop !== null
        ? Number(stop.position)
        : Number.NaN;

      return {
        color,
        position: Number.isFinite(rawPosition) ? clampLocation(rawPosition) : null,
      };
    })
    .filter(Boolean);

  if (stops.length === 0) return [];

  const suppliedLocations = stops.map((stop) => stop.position);
  const locationsAreUsable = suppliedLocations.every(Number.isFinite)
    && suppliedLocations.every((location, index) => (
      index === 0 || location >= suppliedLocations[index - 1]
    ))
    && (
      stops.length === 1
      || suppliedLocations[suppliedLocations.length - 1] > suppliedLocations[0]
    );

  return stops.map((stop, index) => ({
    color: stop.color,
    position: locationsAreUsable
      ? stop.position
      : (stops.length === 1 ? 0 : index / (stops.length - 1)),
  }));
};

export const getGradientColors = (gradientOrStops) => (
  normalizeGradientStops(gradientOrStops).map((stop) => stop.color)
);

export const getGradientColor = (gradientOrStops, fallback = null) => (
  getGradientColors(gradientOrStops)[0] || fallback
);

export const isLightForeground = (color) => (
  tinycolor.equals(color, LIGHT_FOREGROUND)
);

const interpolateGradientColor = (stops, position) => {
  if (position <= stops[0].position) return stops[0].color;
  if (position >= stops[stops.length - 1].position) return stops[stops.length - 1].color;

  const rightIndex = stops.findIndex((stop) => stop.position >= position);
  const left = stops[Math.max(0, rightIndex - 1)];
  const right = stops[rightIndex];
  const distance = right.position - left.position;

  if (distance <= 0) return right.color;

  const amount = ((position - left.position) / distance) * 100;
  return tinycolor.mix(left.color, right.color, amount).toRgbString();
};

const getContrastSamples = (background) => {
  const stops = typeof background === "string"
    ? [{ color: resolveValidColor(background), position: 0 }].filter((stop) => stop.color)
    : normalizeGradientStops(background);

  if (stops.length < 2) return stops.map((stop) => stop.color);

  const samplePositions = new Set(stops.map((stop) => stop.position));
  for (let index = 0; index < GRADIENT_CONTRAST_SAMPLE_COUNT; index += 1) {
    samplePositions.add(index / (GRADIENT_CONTRAST_SAMPLE_COUNT - 1));
  }

  return [...samplePositions]
    .sort((left, right) => left - right)
    .map((position) => interpolateGradientColor(stops, position));
};

export const getReadableForeground = (background, fallback = LIGHT_FOREGROUND) => {
  const samples = getContrastSamples(background);
  if (samples.length === 0) return fallback;

  const whiteContrasts = samples.map((color) => tinycolor.readability(LIGHT_FOREGROUND, color));
  const darkContrasts = samples.map((color) => tinycolor.readability(DARK_FOREGROUND, color));

  // Cards are designed around white content. Switch to dark only when white is
  // severely weak everywhere and dark remains readable over the entire surface.
  // This prevents one bright stop from flipping otherwise vivid gradients.
  const whiteIsSeverelyWeakEverywhere = whiteContrasts.every(
    (contrast) => contrast < WHITE_FOREGROUND_SWITCH_CONTRAST,
  );
  const darkIsReadableEverywhere = darkContrasts.every(
    (contrast) => contrast >= MIN_DARK_FOREGROUND_CONTRAST,
  );

  return whiteIsSeverelyWeakEverywhere && darkIsReadableEverywhere
    ? DARK_FOREGROUND
    : LIGHT_FOREGROUND;
};

export const colorWithAlpha = (color, alpha, fallback = color) => {
  const parsed = tinycolor(color);
  if (!parsed.isValid()) return fallback;
  return parsed.setAlpha(Math.max(0, Math.min(1, alpha))).toRgbString();
};

export const multiplyColorAlpha = (color, opacity, fallback = color) => {
  const parsed = tinycolor(color);
  if (!parsed.isValid()) return fallback;

  const safeOpacity = Number.isFinite(Number(opacity))
    ? Math.max(0, Math.min(1, Number(opacity)))
    : 1;

  return parsed.setAlpha(parsed.getAlpha() * safeOpacity).toRgbString();
};

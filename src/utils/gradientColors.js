import tinycolor from "tinycolor2";

const DARK_FOREGROUND = "#111827";
const LIGHT_FOREGROUND = "#ffffff";
const WHITE_FOREGROUND_SWITCH_CONTRAST = 2.2;
const MIN_DARK_FOREGROUND_CONTRAST = 4.5;
const GRADIENT_CONTRAST_SAMPLE_COUNT = 11;
const PERCEPTUAL_GRADIENT_SUBDIVISIONS = 6;

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

const srgbChannelToLinear = (channel) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const linearChannelToSrgb = (channel) => {
  const normalized = channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * (Math.max(0, channel) ** (1 / 2.4)) - 0.055;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 255);
};

const rgbToOklab = ({ r, g, b }) => {
  const red = srgbChannelToLinear(r);
  const green = srgbChannelToLinear(g);
  const blue = srgbChannelToLinear(b);

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
};

const oklabToRgb = ({ l, a, b }) => {
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;
  const lLinear = lRoot ** 3;
  const mLinear = mRoot ** 3;
  const sLinear = sRoot ** 3;

  return {
    r: linearChannelToSrgb(
      4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear,
    ),
    g: linearChannelToSrgb(
      -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear,
    ),
    b: linearChannelToSrgb(
      -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.707614701 * sLinear,
    ),
  };
};

export const interpolatePerceptualColor = (leftColor, rightColor, amount) => {
  const left = tinycolor(leftColor);
  const right = tinycolor(rightColor);
  if (!left.isValid() || !right.isValid()) return leftColor;

  const progress = Math.max(0, Math.min(1, Number(amount) || 0));
  const leftRgb = left.toRgb();
  const rightRgb = right.toRgb();
  const leftLab = rgbToOklab(leftRgb);
  const rightLab = rgbToOklab(rightRgb);
  const mixedRgb = oklabToRgb({
    l: leftLab.l + (rightLab.l - leftLab.l) * progress,
    a: leftLab.a + (rightLab.a - leftLab.a) * progress,
    b: leftLab.b + (rightLab.b - leftLab.b) * progress,
  });

  return tinycolor({
    ...mixedRgb,
    a: leftRgb.a + (rightRgb.a - leftRgb.a) * progress,
  }).toRgbString();
};

export const createPerceptualGradientStops = (
  gradientOrStops,
  subdivisions = PERCEPTUAL_GRADIENT_SUBDIVISIONS,
) => {
  const stops = normalizeGradientStops(gradientOrStops);
  const safeSubdivisions = Math.max(1, Math.round(Number(subdivisions) || 1));
  if (stops.length < 2 || safeSubdivisions === 1) return stops;

  const expanded = [];

  stops.slice(0, -1).forEach((left, index) => {
    const right = stops[index + 1];
    const leftAlpha = tinycolor(left.color).getAlpha();
    const rightAlpha = tinycolor(right.color).getAlpha();
    const canInterpolatePerceptually = leftAlpha >= 0.999 && rightAlpha >= 0.999;

    if (index === 0) expanded.push(left);

    if (canInterpolatePerceptually) {
      for (let step = 1; step < safeSubdivisions; step += 1) {
        const progress = step / safeSubdivisions;
        expanded.push({
          color: interpolatePerceptualColor(left.color, right.color, progress),
          position: left.position + (right.position - left.position) * progress,
        });
      }
    }

    expanded.push(right);
  });

  return expanded;
};

export const multiplyColorAlpha = (color, opacity, fallback = color) => {
  const parsed = tinycolor(color);
  if (!parsed.isValid()) return fallback;

  const safeOpacity = Number.isFinite(Number(opacity))
    ? Math.max(0, Math.min(1, Number(opacity)))
    : 1;

  return parsed.setAlpha(parsed.getAlpha() * safeOpacity).toRgbString();
};

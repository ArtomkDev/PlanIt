export const CARDINAL_GRADIENT_ANGLES = [0, 90, 180, 270];

export const GRADIENT_ANGLE_MAX = 359;
export const GRADIENT_ANGLE_MAGNET_RADIUS = 10;
export const GRADIENT_ANGLE_LOCK_RADIUS = 2;
export const GRADIENT_ANGLE_RELEASE_RADIUS = 6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeGradientAngle = (angle, fallback = 90) => {
  const numericAngle = Number(angle);
  const numericFallback = Number(fallback);
  const safeAngle = Number.isFinite(numericAngle)
    ? numericAngle
    : (Number.isFinite(numericFallback) ? numericFallback : 90);

  return ((safeAngle % 360) + 360) % 360;
};

export const clampGradientSliderAngle = (angle, fallback = 90) => (
  clamp(normalizeGradientAngle(angle, fallback), 0, GRADIENT_ANGLE_MAX)
);

export const getNearestCardinalAngle = (angle) => {
  const normalized = clampGradientSliderAngle(angle);

  return CARDINAL_GRADIENT_ANGLES.reduce((nearest, candidate) => (
    Math.abs(candidate - normalized) < Math.abs(nearest - normalized)
      ? candidate
      : nearest
  ), CARDINAL_GRADIENT_ANGLES[0]);
};

export const getCardinalSnapTarget = (
  angle,
  radius = GRADIENT_ANGLE_LOCK_RADIUS,
) => {
  const normalized = clampGradientSliderAngle(angle);
  const target = getNearestCardinalAngle(normalized);
  return Math.abs(target - normalized) <= Math.max(0, radius) ? target : null;
};

const smoothStep = (value) => {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export const applySoftCardinalMagnet = (
  angle,
  {
    magnetRadius = GRADIENT_ANGLE_MAGNET_RADIUS,
    lockRadius = GRADIENT_ANGLE_LOCK_RADIUS,
  } = {},
) => {
  const normalized = clampGradientSliderAngle(angle);
  const target = getNearestCardinalAngle(normalized);
  const signedDistance = normalized - target;
  const distance = Math.abs(signedDistance);
  const safeMagnetRadius = Math.max(0, magnetRadius);
  const safeLockRadius = clamp(lockRadius, 0, safeMagnetRadius);

  if (distance <= safeLockRadius) return target;
  if (distance >= safeMagnetRadius || safeMagnetRadius === safeLockRadius) {
    return normalized;
  }

  const magneticProgress = smoothStep(
    (distance - safeLockRadius) / (safeMagnetRadius - safeLockRadius),
  );
  // Scale the real distance instead of replacing it with the full magnet
  // radius. This guarantees that the field only attracts the thumb and never
  // pushes it away near the outer edge of the snap zone.
  const softenedDistance = distance * magneticProgress;

  return target + Math.sign(signedDistance) * softenedDistance;
};

export const snapGradientAngleOnRelease = (
  angle,
  radius = GRADIENT_ANGLE_RELEASE_RADIUS,
) => {
  const normalized = clampGradientSliderAngle(angle);
  return getCardinalSnapTarget(normalized, radius) ?? normalized;
};

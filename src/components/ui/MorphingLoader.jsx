import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const POINTS = 48;
const BASE_RADIUS = 34;
const CYCLE_MS = 1040;
const SHIMMER_MS = 760;
const BREATH_MS = 1350;
const CONTINUOUS_ROTATION_MS = 5200;
const CHANGE_ROTATION_DEG = 42;
const SPLINE_TENSION = 0.13;
const ANGLE_OPTIONS = [18, 34, 52, 76, 98, 124, 146, 166, 194, 218, 244, 278, 304, 332];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const lerp = (from, to, t) => from + (to - from) * t;
const clockwiseLerpAngle = (from, to, t) => {
  const delta = ((to - from) % 360 + 360) % 360;
  return from + delta * t;
};
const smootherStep = (value) => {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const wave = (angle, lobes, phase = 0, power = 1.6) => (
  Math.pow((Math.cos((angle - phase) * lobes) + 1) / 2, power)
);

const makeRadii = (factory) => (
  Array.from({ length: POINTS }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / POINTS;
    return Math.max(0.62, Math.min(1.08, factory(angle, index)));
  })
);

const SHAPES = [
  { id: 'orb', radii: makeRadii((angle) => 0.92 + Math.sin(angle * 2.2) * 0.012), rotation: 0, sx: 1, sy: 1 },
  { id: 'soft_triangle', radii: makeRadii((angle) => 0.75 + wave(angle, 3, -Math.PI / 2, 1.08) * 0.21), rotation: 10, sx: 1.03, sy: 0.98 },
  { id: 'rounded_star', radii: makeRadii((angle) => 0.75 + wave(angle, 5, -0.12, 1.02) * 0.2 + wave(angle, 10, -0.12, 1.8) * 0.018), rotation: -12, sx: 1, sy: 1 },
  { id: 'soft_spark', radii: makeRadii((angle) => 0.73 + wave(angle, 4, Math.PI / 4, 1.12) * 0.23), rotation: 22, sx: 0.99, sy: 1.02 },
  { id: 'liquid_diamond', radii: makeRadii((angle) => 0.73 + wave(angle, 4, 0, 1.08) * 0.23), rotation: 45, sx: 1.04, sy: 0.98 },
  { id: 'petal', radii: makeRadii((angle) => 0.76 + wave(angle, 2, Math.PI / 5, 1.22) * 0.21 + Math.sin(angle + 0.8) * 0.026), rotation: -26, sx: 1.1, sy: 0.92 },
  { id: 'drop', radii: makeRadii((angle) => 0.77 + wave(angle, 1, -Math.PI / 2, 1.32) * 0.2 - wave(angle, 1, Math.PI / 2, 1.72) * 0.075), rotation: 18, sx: 0.97, sy: 1.11 },
  { id: 'squircle', radii: makeRadii((angle) => 0.8 + wave(angle, 4, Math.PI / 4, 0.9) * 0.14), rotation: 4, sx: 1.01, sy: 1.01 },
  { id: 'smooth_hex', radii: makeRadii((angle) => 0.74 + wave(angle, 6, Math.PI / 6, 1.05) * 0.18), rotation: -20, sx: 1.04, sy: 0.98 },
  { id: 'comet', radii: makeRadii((angle) => 0.76 + wave(angle, 1, 0.15, 1.24) * 0.22 + Math.sin(angle * 3 - 0.6) * 0.02), rotation: 36, sx: 1.1, sy: 0.93 },
  { id: 'clover', radii: makeRadii((angle) => 0.72 + wave(angle, 3, Math.PI / 2, 1.1) * 0.18 + wave(angle, 6, 0, 1.6) * 0.05), rotation: -34, sx: 0.98, sy: 1.04 },
  { id: 'soft_starburst', radii: makeRadii((angle) => 0.73 + wave(angle, 7, 0.12, 1.08) * 0.18), rotation: 14, sx: 1, sy: 1 },
  { id: 'shield', radii: makeRadii((angle) => 0.77 + wave(angle, 3, -Math.PI / 2, 0.96) * 0.16 - wave(angle, 1, Math.PI / 2, 1.5) * 0.06), rotation: 0, sx: 0.98, sy: 1.08 },
  { id: 'ribbon', radii: makeRadii((angle) => 0.74 + wave(angle, 2, 0.4, 1.18) * 0.22 + Math.sin(angle * 4) * 0.016), rotation: 30, sx: 1.12, sy: 0.9 },
];

const PALETTES = [
  ['#38BDF8', '#2DD4BF', '#FB7185'],
  ['#8B5CF6', '#EC4899', '#FDE047'],
  ['#A7F3D0', '#22D3EE', '#3B82F6'],
  ['#FF6B6B', '#F59E0B', '#FFD166'],
  ['#10B981', '#84CC16', '#0EA5E9'],
  ['#EF4444', '#F97316', '#06B6D4'],
  ['#6366F1', '#D946EF', '#FACC15'],
  ['#14B8A6', '#0EA5E9', '#F472B6'],
  ['#F43F5E', '#FB923C', '#22C55E'],
  ['#06B6D4', '#A855F7', '#F97316'],
];

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((item) => item + item).join('')
    : value;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }) => (
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
);

const mixHex = (from, to, t) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);

  return rgbToHex({
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  });
};

const mixPalette = (from, to, t) => from.map((color, index) => mixHex(color, to[index], t));

const gradientVector = (angle) => {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians) * 52;
  const dy = Math.sin(radians) * 52;

  return {
    x1: CENTER - dx,
    y1: CENTER - dy,
    x2: CENTER + dx,
    y2: CENTER + dy,
  };
};

const pickRandomIndex = (length, previousIndex) => {
  if (length <= 1) return 0;

  let index = previousIndex;
  let attempts = 0;

  while (index === previousIndex && attempts < 8) {
    index = Math.floor(Math.random() * length);
    attempts += 1;
  }

  return index === previousIndex ? (previousIndex + 1) % length : index;
};

const createRandomFrame = (previousFrame = null) => {
  const shapeIndex = pickRandomIndex(SHAPES.length, previousFrame?.shapeIndex);
  const paletteIndex = pickRandomIndex(PALETTES.length, previousFrame?.paletteIndex);
  const angleIndex = pickRandomIndex(ANGLE_OPTIONS.length, previousFrame?.angleIndex);

  return {
    shapeIndex,
    paletteIndex,
    angleIndex,
    shape: SHAPES[shapeIndex],
    palette: PALETTES[paletteIndex],
    angle: ANGLE_OPTIONS[angleIndex],
  };
};

const createFrameQueue = (length = 4) => {
  const queue = [];

  while (queue.length < length) {
    queue.push(createRandomFrame(queue[queue.length - 1]));
  }

  return queue;
};

const ensureFrameQueue = (queue, requiredIndex) => {
  while (queue.length <= requiredIndex) {
    queue.push(createRandomFrame(queue[queue.length - 1]));
  }
};

const buildPath = (fromFrame, toFrame, morphT, breathT, rotationOffset) => {
  const pulse = 0.985 + breathT * 0.035;
  const rotation = rotationOffset + lerp(fromFrame.shape.rotation, toFrame.shape.rotation, morphT);
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sx = lerp(fromFrame.shape.sx, toFrame.shape.sx, morphT);
  const sy = lerp(fromFrame.shape.sy, toFrame.shape.sy, morphT);

  const points = fromFrame.shape.radii.map((fromRadius, index) => {
    const toRadius = toFrame.shape.radii[index];
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / POINTS;
    const radius = lerp(fromRadius, toRadius, morphT) * BASE_RADIUS * pulse;
    const rawX = Math.cos(angle) * radius * sx;
    const rawY = Math.sin(angle) * radius * sy;

    return {
      x: CENTER + rawX * cos - rawY * sin,
      y: CENTER + rawX * sin + rawY * cos,
    };
  });

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

    const prev = points[index - 1];
    const prevPrev = points[(index - 2 + POINTS) % POINTS];
    const next = points[(index + 1) % POINTS];
    const c1 = {
      x: prev.x + (point.x - prevPrev.x) * SPLINE_TENSION,
      y: prev.y + (point.y - prevPrev.y) * SPLINE_TENSION,
    };
    const c2 = {
      x: point.x - (next.x - prev.x) * SPLINE_TENSION,
      y: point.y - (next.y - prev.y) * SPLINE_TENSION,
    };

    return `${path} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, '') + ` C ${(
    points[POINTS - 1].x + (points[0].x - points[POINTS - 2].x) * SPLINE_TENSION
  ).toFixed(2)} ${(
    points[POINTS - 1].y + (points[0].y - points[POINTS - 2].y) * SPLINE_TENSION
  ).toFixed(2)}, ${(
    points[0].x - (points[1].x - points[POINTS - 1].x) * SPLINE_TENSION
  ).toFixed(2)} ${(
    points[0].y - (points[1].y - points[POINTS - 1].y) * SPLINE_TENSION
  ).toFixed(2)}, ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} Z`;
};

const createRenderState = (elapsedMs = 0, frameQueue) => {
  const frameIndex = Math.floor(elapsedMs / CYCLE_MS);
  ensureFrameQueue(frameQueue, frameIndex + 1);

  const rawMorphT = (elapsedMs % CYCLE_MS) / CYCLE_MS;
  const morphT = smootherStep(rawMorphT);
  const colorT = smootherStep(clamp01(rawMorphT * 1.18 - 0.06));
  const breathT = (Math.sin((elapsedMs / BREATH_MS) * Math.PI * 2) + 1) / 2;
  const shimmerT = (elapsedMs % SHIMMER_MS) / SHIMMER_MS;
  const fromFrame = frameQueue[frameIndex];
  const toFrame = frameQueue[frameIndex + 1];
  const continuousRotation = (elapsedMs / CONTINUOUS_ROTATION_MS) * 360;
  const transitionRotation = (frameIndex + morphT) * CHANGE_ROTATION_DEG;
  const rotationOffset = continuousRotation + transitionRotation;
  const gradient = gradientVector(
    clockwiseLerpAngle(fromFrame.angle, toFrame.angle, colorT) + continuousRotation * 0.42
  );

  return {
    path: buildPath(fromFrame, toFrame, morphT, breathT, rotationOffset),
    colors: mixPalette(fromFrame.palette, toFrame.palette, colorT),
    gradient,
    shimmerX: lerp(-82, 120, shimmerT),
    shimmerOpacity: lerp(0.2, 0.5, smootherStep(1 - Math.abs(shimmerT - 0.5) * 2)),
    scale: 0.986 + breathT * 0.04,
  };
};

const MorphingLoader = ({ size = 60, style }) => {
  const resolvedSize = Math.max(18, Number(size) || 60);
  const isTiny = resolvedSize < 38;
  const ids = useRef({
    gradient: `morphGradient${Math.random().toString(36).slice(2)}`,
    shine: `morphShine${Math.random().toString(36).slice(2)}`,
    clip: `morphClip${Math.random().toString(36).slice(2)}`,
  }).current;
  const startedAt = useRef(Date.now());
  const frameRef = useRef(null);
  const frameQueue = useRef(createFrameQueue()).current;
  const [renderState, setRenderState] = useState(() => createRenderState(0, frameQueue));

  useEffect(() => {
    const animate = () => {
      setRenderState(createRenderState(Date.now() - startedAt.current, frameQueue));
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [frameQueue]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[
        styles.container,
        {
          width: resolvedSize,
          height: resolvedSize,
          transform: [{ scale: renderState.scale }],
        },
        style,
      ]}
    >
      <Svg width={resolvedSize} height={resolvedSize} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          <SvgLinearGradient
            id={ids.gradient}
            x1={renderState.gradient.x1}
            y1={renderState.gradient.y1}
            x2={renderState.gradient.x2}
            y2={renderState.gradient.y2}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={renderState.colors[0]} />
            <Stop offset="0.52" stopColor={renderState.colors[1]} />
            <Stop offset="1" stopColor={renderState.colors[2]} />
          </SvgLinearGradient>

          <SvgLinearGradient
            id={ids.shine}
            x1="0"
            y1="50"
            x2="36"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={isTiny ? 0.36 : 0.66} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>

          <ClipPath id={ids.clip}>
            <Path d={renderState.path} />
          </ClipPath>
        </Defs>

        <Path
          d={renderState.path}
          fill={`url(#${ids.gradient})`}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={isTiny ? 0.6 : 0.85}
        />

        <G clipPath={`url(#${ids.clip})`} opacity={renderState.shimmerOpacity}>
          <Rect
            x={renderState.shimmerX}
            y="-24"
            width="22"
            height="148"
            fill={`url(#${ids.shine})`}
            transform={`rotate(24 ${renderState.shimmerX + 11} 50)`}
          />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MorphingLoader;

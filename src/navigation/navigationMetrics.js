import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const LIQUID_GLASS_NAVIGATION_STYLE = 'liquidGlass';
export const CUSTOM_NAVIGATION_STYLE_KEYS = Object.freeze(['classic', 'floating', 'dot']);
export const NAVIGATION_STYLE_KEYS = Object.freeze([
  ...CUSTOM_NAVIGATION_STYLE_KEYS,
  LIQUID_GLASS_NAVIGATION_STYLE,
]);

const getIOSMajorVersion = () => {
  if (Platform.OS !== 'ios') return 0;

  const version = Platform.Version;
  if (typeof version === 'number') return Math.floor(version);
  if (typeof version === 'string') {
    const parsed = Number.parseInt(version.split('.')[0], 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const isExpoGo = () => (
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
);

export const isLiquidGlassNavigationSupported = () => (
  Platform.OS === 'ios' && !isExpoGo() && getIOSMajorVersion() >= 26
);

export const getDefaultNavigationStyle = () => (
  isLiquidGlassNavigationSupported() ? LIQUID_GLASS_NAVIGATION_STYLE : 'classic'
);

export const getAvailableNavigationStyleKeys = () => (
  isLiquidGlassNavigationSupported()
    ? NAVIGATION_STYLE_KEYS
    : CUSTOM_NAVIGATION_STYLE_KEYS
);

export const resolveNavigationStyle = (style, fallback = getDefaultNavigationStyle()) => {
  if (style === LIQUID_GLASS_NAVIGATION_STYLE) {
    return isLiquidGlassNavigationSupported() ? style : 'classic';
  }

  if (CUSTOM_NAVIGATION_STYLE_KEYS.includes(style)) {
    return style;
  }

  return fallback;
};

export const NAVIGATION_METRICS = Object.freeze({
  classic: {
    placement: 'attached',
    heightWithLabels: 52,
    heightIconsOnly: 48,
    horizontalMargin: 0,
    radius: 0,
    bottomGap: 0,
    rowPaddingHorizontal: 8,
    iconSize: 22,
    labelSize: 10,
    indicator: {
      type: 'line',
      width: 30,
      height: 3,
      radius: 2,
      top: 0,
    },
  },
  floating: {
    placement: 'floating',
    heightWithLabels: 58,
    heightIconsOnly: 52,
    horizontalMargin: 14,
    radius: 29,
    bottomGap: 10,
    rowPaddingHorizontal: 8,
    iconSize: 22,
    labelSize: 10,
    indicator: {
      type: 'pill',
      width: '82%',
      heightWithLabels: 42,
      heightIconsOnly: 38,
      radius: 21,
    },
  },
  dot: {
    placement: 'attached',
    heightWithLabels: 54,
    heightIconsOnly: 48,
    horizontalMargin: 0,
    radius: 0,
    bottomGap: 0,
    rowPaddingHorizontal: 10,
    iconSize: 22,
    labelSize: 10,
    indicator: {
      type: 'dot',
      size: 6,
      radius: 3,
      topWithLabels: 3,
      topIconsOnly: 36,
    },
  },
  liquidGlass: {
    placement: 'native',
    heightWithLabels: 58,
    heightIconsOnly: 52,
    horizontalMargin: 14,
    radius: 29,
    bottomGap: 10,
    rowPaddingHorizontal: 8,
    iconSize: 22,
    labelSize: 10,
    indicator: {
      type: 'pill',
      width: '82%',
      heightWithLabels: 42,
      heightIconsOnly: 38,
      radius: 21,
    },
  },
});

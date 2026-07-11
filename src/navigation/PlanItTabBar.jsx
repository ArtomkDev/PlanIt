import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import AppBlur from '../components/ui/AppBlur';
import AdBanner from '../components/AdBanner/AdBanner';
import { NAVIGATION_METRICS } from './navigationMetrics';

const ACTIVE_SPRING = {
  damping: 14,
  stiffness: 150,
  mass: 0.8,
  useNativeDriver: true,
};

const BOUNCE_SPRING = {
  damping: 12,
  stiffness: 260,
  mass: 0.45,
  useNativeDriver: true,
};

const hexToRgba = (color, opacity) => {
  if (typeof color !== 'string' || !color.startsWith('#')) {
    return color;
  }

  const hex = color.replace('#', '');
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex.slice(0, 6);
  const intValue = Number.parseInt(normalized, 16);

  if (Number.isNaN(intValue)) {
    return color;
  }

  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const TAB_BAR_VARIANTS = {
  classic: {
    blurIntensity: 72,
    activeIconScale: 1.06,
    activeIconLift: -2,
    getSurfaceFillColor: ({ themeColors }) => (
      Platform.OS === 'android'
        ? themeColors.backgroundColor2
        : hexToRgba(themeColors.backgroundColor2, 0.9)
    ),
    getSurfaceOuterStyle: () => null,
    getSurfaceClipStyle: ({ themeColors }) => [
      styles.attachedSurfaceClip,
      { borderColor: themeColors.borderColor },
    ],
    getActiveColor: ({ themeColors }) => themeColors.accentColor,
    getIndicatorSlotStyle: () => styles.classicIndicatorSlot,
    getIndicatorStyle: ({ metrics, themeColors }) => ({
      width: metrics.indicator.width,
      height: metrics.indicator.height,
      borderRadius: metrics.indicator.radius,
      backgroundColor: themeColors.accentColor,
    }),
  },
  floating: {
    blurIntensity: 88,
    activeIconScale: 1.04,
    activeIconLift: 0,
    getSurfaceFillColor: ({ themeColors }) => (
      Platform.OS === 'android'
        ? themeColors.backgroundColor2
        : hexToRgba(themeColors.backgroundColor2, 0.92)
    ),
    getSurfaceOuterStyle: ({ fallbackColor }) => [
      styles.floatingSurfaceOuter,
      { backgroundColor: fallbackColor },
    ],
    getSurfaceClipStyle: ({ themeColors }) => [
      styles.floatingSurfaceClip,
      { borderColor: hexToRgba(themeColors.borderColor, 0.8) },
    ],
    getActiveColor: ({ themeColors }) => themeColors.accentColor,
    getIndicatorSlotStyle: () => styles.floatingIndicatorSlot,
    getIndicatorStyle: ({ metrics, showLabels, themeColors }) => ({
      width: metrics.indicator.width,
      height: showLabels ? metrics.indicator.heightWithLabels : metrics.indicator.heightIconsOnly,
      borderRadius: metrics.indicator.radius,
      backgroundColor: hexToRgba(themeColors.accentColor, Platform.OS === 'android' ? 0.18 : 0.22),
    }),
  },
  dot: {
    blurIntensity: 76,
    activeIconScale: 1.08,
    activeIconLift: 0,
    getSurfaceFillColor: ({ themeColors }) => (
      Platform.OS === 'android'
        ? themeColors.backgroundColor2
        : hexToRgba(themeColors.backgroundColor2, 0.9)
    ),
    getSurfaceOuterStyle: () => null,
    getSurfaceClipStyle: ({ themeColors }) => [
      styles.attachedSurfaceClip,
      { borderColor: themeColors.borderColor },
    ],
    getActiveColor: ({ themeColors }) => themeColors.accentColor,
    getIndicatorSlotStyle: ({ metrics, showLabels }) => [
      styles.dotIndicatorSlot,
      { top: showLabels ? metrics.indicator.topWithLabels : metrics.indicator.topIconsOnly },
    ],
    getIndicatorStyle: ({ metrics, themeColors }) => ({
      width: metrics.indicator.size,
      height: metrics.indicator.size,
      borderRadius: metrics.indicator.radius,
      backgroundColor: themeColors.accentColor,
    }),
  },
};

function SurfaceBackground({ fallbackColor, strategy }) {
  if (Platform.OS === 'android') {
    return null;
  }

  return (
    <AppBlur
      intensity={strategy.blurIntensity}
      style={[
        StyleSheet.absoluteFill,
        styles.surfaceBackground,
        { backgroundColor: fallbackColor },
      ]}
    />
  );
}

function TabItem({
  route,
  descriptor,
  navigation,
  focused,
  showLabels,
  animationsEnabled,
  themeColors,
  metrics,
  strategy,
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const { options } = descriptor;

  useEffect(() => () => {
    pressScale.stopAnimation();
  }, [pressScale]);

  useEffect(() => {
    if (!animationsEnabled) {
      progress.stopAnimation();
      progress.setValue(focused ? 1 : 0);
      return;
    }

    Animated.spring(progress, {
      ...ACTIVE_SPRING,
      toValue: focused ? 1 : 0,
    }).start();

    return () => {
      progress.stopAnimation();
    };
  }, [animationsEnabled, focused, progress]);

  const label = typeof options.tabBarLabel === 'string'
    ? options.tabBarLabel
    : (options.title || route.name);
  const activeColor = strategy.getActiveColor({ themeColors });
  const color = focused ? activeColor : themeColors.textColor2;
  const icon = options.tabBarIcon?.({ color, size: metrics.iconSize, focused }) ?? null;

  const runIconBounce = () => {
    if (!animationsEnabled) {
      return;
    }

    pressScale.stopAnimation();
    pressScale.setValue(1);
    Animated.sequence([
      Animated.spring(pressScale, { ...BOUNCE_SPRING, toValue: 0.9 }),
      Animated.spring(pressScale, { ...BOUNCE_SPRING, toValue: 1.1 }),
      Animated.spring(pressScale, { ...BOUNCE_SPRING, toValue: 1 }),
    ]).start();
  };

  const onPress = () => {
    runIconBounce();

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onLongPress = () => {
    navigation.emit({ type: 'tabLongPress', target: route.key });
  };

  const activeScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, strategy.activeIconScale],
  });
  const iconScale = Animated.multiply(activeScale, pressScale);
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, showLabels ? strategy.activeIconLift : Math.min(strategy.activeIconLift, 0)],
  });
  const indicatorScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel || label}
      hitSlop={6}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      testID={options.tabBarButtonTestID}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.itemIndicator,
          strategy.getIndicatorSlotStyle({ metrics, showLabels }),
          {
            opacity: progress,
            transform: [{ scale: indicatorScale }],
          },
        ]}
      >
        <View style={strategy.getIndicatorStyle({ metrics, showLabels, themeColors })} />
      </Animated.View>

      <Animated.View
        style={[
          styles.iconWrap,
          {
            transform: [
              { translateY },
              { scale: iconScale },
            ],
          },
        ]}
      >
        {icon}
      </Animated.View>

      {showLabels && (
        <Animated.View
          style={{
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ],
          }}
        >
          <Text numberOfLines={1} style={[styles.label, { color, fontSize: metrics.labelSize }]}>
            {label}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export default function PlanItTabBar({ state, descriptors, navigation, insets, onLayout }) {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styleVariant = NAVIGATION_METRICS[global?.navigationStyle] ? global.navigationStyle : 'classic';
  const showLabels = global?.navigationLabels ?? true;
  const animationsEnabled = global?.navigationAnimations ?? true;
  const metrics = NAVIGATION_METRICS[styleVariant];
  const strategy = TAB_BAR_VARIANTS[styleVariant] || TAB_BAR_VARIANTS.classic;
  const contentHeight = showLabels ? metrics.heightWithLabels : metrics.heightIconsOnly;
  const isFloating = metrics.placement === 'floating';
  const bottomInset = Math.max(insets?.bottom || 0, 0);
  const barHeight = isFloating ? contentHeight : contentHeight + bottomInset;
  const surfaceBottomGap = isFloating ? metrics.bottomGap + bottomInset : 0;
  const fallbackColor = strategy.getSurfaceFillColor({ themeColors });
  const rowPadding = metrics.rowPaddingHorizontal || 0;
  const configKey = `${styleVariant}-${showLabels ? 'labels' : 'icons'}-${animationsEnabled ? 'motion' : 'still'}-${bottomInset}`;

  return (
    <View key={`tabbar-${configKey}`} style={styles.root} onLayout={onLayout}>
      <View style={styles.adWrapper}>
        <AdBanner />
      </View>

      <View
        key={`surface-${configKey}`}
        collapsable={false}
        renderToHardwareTextureAndroid={Platform.OS === 'android'}
        style={[
          styles.surfaceOuter,
          {
            height: barHeight,
            marginHorizontal: metrics.horizontalMargin,
            marginBottom: surfaceBottomGap,
            borderRadius: metrics.radius,
          },
          strategy.getSurfaceOuterStyle({ fallbackColor, themeColors }),
        ]}
      >
        <View
          key={`clip-${configKey}`}
          collapsable={false}
          needsOffscreenAlphaCompositing={Platform.OS === 'android'}
          renderToHardwareTextureAndroid={Platform.OS === 'android'}
          style={[
            styles.surfaceClip,
            {
              borderRadius: metrics.radius,
              backgroundColor: fallbackColor,
              paddingBottom: isFloating ? 0 : bottomInset,
            },
            strategy.getSurfaceClipStyle({ themeColors }),
          ]}
        >
          <SurfaceBackground fallbackColor={fallbackColor} strategy={strategy} />

          <View style={[styles.itemsRow, { paddingHorizontal: rowPadding }]}>
            {state.routes.map((route, index) => (
              <TabItem
                key={`${styleVariant}-${showLabels ? 'labels' : 'icons'}-${route.key}`}
                route={route}
                descriptor={descriptors[route.key]}
                navigation={navigation}
                focused={state.index === index}
                showLabels={showLabels}
                animationsEnabled={animationsEnabled}
                themeColors={themeColors}
                metrics={metrics}
                strategy={strategy}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  adWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  surfaceOuter: {
    position: 'relative',
  },
  floatingSurfaceOuter: {
    ...Platform.select({
      web: { boxShadow: '0 14px 34px rgba(0,0,0,0.18)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 14,
      },
    }),
  },
  surfaceClip: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  surfaceBackground: {
    zIndex: 0,
  },
  attachedSurfaceClip: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  floatingSurfaceClip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  classicIndicatorSlot: {
    top: 0,
    height: 4,
    justifyContent: 'flex-start',
  },
  floatingIndicatorSlot: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  dotIndicatorSlot: {
    height: 8,
    justifyContent: 'center',
  },
  itemsRow: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    zIndex: 2,
  },
  item: {
    flex: 1,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
  },
  iconWrap: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'relative',
    zIndex: 2,
    fontWeight: '700',
    letterSpacing: 0,
  },
});

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import AppBlur from '../components/ui/AppBlur';
import AdBanner from '../components/AdBanner/AdBanner';
import { NAVIGATION_METRICS } from './navigationMetrics';

function TabItem({
  route,
  descriptor,
  navigation,
  focused,
  styleVariant,
  showLabels,
  animationsEnabled,
  themeColors,
  metrics,
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const { options } = descriptor;

  useEffect(() => {
    if (!animationsEnabled) {
      progress.setValue(focused ? 1 : 0);
      return;
    }

    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      damping: 16,
      stiffness: 190,
      mass: 0.65,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animationsEnabled, focused, progress]);

  const label = typeof options.tabBarLabel === 'string'
    ? options.tabBarLabel
    : (options.title || route.name);
  const isIsland = styleVariant === 'island';
  const isMaterial = styleVariant === 'material';
  const activeColor = isIsland ? '#FFFFFF' : themeColors.accentColor;
  const color = focused ? activeColor : themeColors.textColor2;
  const icon = options.tabBarIcon?.({ color, size: metrics.iconSize, focused }) ?? null;
  const activeIconLift = showLabels ? (isIsland ? -1 : -2) : 0;

  const onPress = () => {
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

  const indicatorHeight = isIsland
    ? (showLabels ? metrics.indicatorHeightWithLabels : metrics.indicatorHeightIconsOnly)
    : metrics.indicatorHeight;
  const indicatorStyle = isMaterial
    ? [
        styles.materialIndicator,
        {
          width: metrics.indicatorWidth,
          height: indicatorHeight,
          borderRadius: metrics.indicatorRadius,
          top: showLabels
            ? metrics.indicatorTopWithLabels
            : Math.round((metrics.heightIconsOnly - indicatorHeight) / 2),
          backgroundColor: themeColors.accentColorLight,
        },
      ]
    : isIsland
      ? [
          styles.islandIndicator,
          {
            width: metrics.indicatorWidth,
            height: indicatorHeight,
            borderRadius: metrics.indicatorRadius,
            backgroundColor: themeColors.accentColor,
          },
        ]
      : [
          styles.classicIndicator,
          {
            width: metrics.indicatorWidth,
            height: indicatorHeight,
            borderRadius: metrics.indicatorRadius,
            backgroundColor: themeColors.accentColor,
          },
        ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel || label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      testID={options.tabBarButtonTestID}
    >
      <Animated.View
        style={[
          indicatorStyle,
          {
            opacity: progress,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.iconWrap,
          {
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, activeIconLift] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
            ],
          },
        ]}
      >
        {icon}
      </Animated.View>

      {showLabels && (
        <Animated.View
          style={{
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
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
  const contentHeight = showLabels ? metrics.heightWithLabels : metrics.heightIconsOnly;
  const isClassic = styleVariant === 'classic';
  const floatingBottomGap = Math.max(insets.bottom, metrics.bottomGap);

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={styles.adWrapper}>
        <AdBanner />
      </View>

      <View
        style={[
          styles.surface,
          {
            height: isClassic ? contentHeight + insets.bottom : contentHeight,
            marginHorizontal: metrics.horizontalMargin,
            marginBottom: isClassic ? 0 : floatingBottomGap,
            paddingBottom: isClassic ? insets.bottom : 0,
            borderRadius: metrics.radius,
            borderColor: themeColors.borderColor,
          },
          styleVariant === 'island' && styles.islandSurface,
          styleVariant === 'material' && styles.materialSurface,
          isClassic && styles.classicSurface,
        ]}
      >
        <AppBlur style={[StyleSheet.absoluteFill, { borderRadius: metrics.radius }]} intensity={85} />
        <View style={styles.itemsRow}>
          {state.routes.map((route, index) => (
            <TabItem
              key={route.key}
              route={route}
              descriptor={descriptors[route.key]}
              navigation={navigation}
              focused={state.index === index}
              styleVariant={styleVariant}
              showLabels={showLabels}
              animationsEnabled={animationsEnabled}
              themeColors={themeColors}
              metrics={metrics}
            />
          ))}
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
  surface: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  classicSurface: {
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  islandSurface: {
    ...Platform.select({
      web: { boxShadow: '0 12px 30px rgba(0,0,0,0.18)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      },
    }),
  },
  materialSurface: {
    ...Platform.select({
      web: { boxShadow: '0 6px 20px rgba(0,0,0,0.14)' },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      },
    }),
  },
  itemsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    position: 'relative',
  },
  iconWrap: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    zIndex: 2,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  classicIndicator: {
    position: 'absolute',
    top: 0,
  },
  islandIndicator: {
    position: 'absolute',
  },
  materialIndicator: {
    position: 'absolute',
  },
});

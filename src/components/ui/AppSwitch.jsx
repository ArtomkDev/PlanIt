import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet } from "react-native";
import useReducedMotionPreference from "../../hooks/useReducedMotionPreference";

const SIZES = {
  regular: {
    width: 52,
    height: 32,
    padding: 3,
    thumb: 26,
  },
  small: {
    width: 44,
    height: 28,
    padding: 3,
    thumb: 22,
  },
};

const getSize = (size) => SIZES[size] || SIZES.regular;

export default function AppSwitch({
  value = false,
  onValueChange,
  onChange,
  onPressIn,
  onPressOut,
  disabled = false,
  size = "regular",
  themeColors,
  style,
  accessibilityLabel,
  testID,
  hitSlop = 8,
  interactive = true,
  ...pressableProps
}) {
  const isOn = value === true;
  const reduceMotion = useReducedMotionPreference();
  const metrics = getSize(size);
  const progress = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const colors = useMemo(() => {
    const inactiveTrack = themeColors?.backgroundColor3 || themeColors?.borderColor || "#D1D5DB";
    const activeTrack = themeColors?.accentColor || "#3B82F6";
    const thumb = themeColors?.backgroundColor2 || "#FFFFFF";

    return {
      inactiveTrack,
      activeTrack,
      inactiveBorder: themeColors?.borderColor || inactiveTrack,
      activeBorder: activeTrack,
      thumb,
    };
  }, [themeColors]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isOn ? 1 : 0,
      duration: reduceMotion ? 0 : 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isOn, progress, reduceMotion]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, metrics.width - metrics.thumb - metrics.padding * 2],
  });

  const handlePress = (event) => {
    event?.stopPropagation?.();
    if (disabled || !interactive) return;

    const nextValue = !isOn;
    onValueChange?.(nextValue);
    onChange?.({ nativeEvent: { value: nextValue } });
  };

  const animatePress = (toValue) => {
    if (reduceMotion) {
      pressScale.setValue(1);
      return;
    }
    Animated.spring(pressScale, {
      toValue,
      speed: 26,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      {...pressableProps}
      accessibilityElementsHidden={!interactive}
      accessibilityLabel={interactive ? accessibilityLabel : undefined}
      accessibilityRole={interactive ? "switch" : undefined}
      accessibilityState={interactive ? { checked: isOn, disabled } : undefined}
      disabled={disabled || !interactive}
      importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
      hitSlop={hitSlop}
      onPress={handlePress}
      onPressIn={(event) => {
        event?.stopPropagation?.();
        onPressIn?.(event);
        if (!disabled && interactive) animatePress(0.94);
      }}
      onPressOut={(event) => {
        event?.stopPropagation?.();
        onPressOut?.(event);
        animatePress(1);
      }}
      style={[styles.pressable, disabled && styles.disabledCursor, style]}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.track,
          disabled && styles.disabled,
          {
            width: metrics.width,
            height: metrics.height,
            padding: metrics.padding,
            borderRadius: metrics.height / 2,
            backgroundColor: isOn ? colors.activeTrack : colors.inactiveTrack,
            borderColor: isOn ? colors.activeBorder : colors.inactiveBorder,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: metrics.thumb,
              height: metrics.thumb,
              borderRadius: metrics.thumb / 2,
              backgroundColor: colors.thumb,
              transform: [{ translateX }, { scale: pressScale }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    ...Platform.select({
      web: { cursor: "pointer" },
      default: null,
    }),
  },
  track: {
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },

  thumb: {
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.24)",
      },
      default: {
        shadowColor: "#000",
        shadowOpacity: 0.24,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },

  disabled: {
    opacity: 0.48,
  },
  disabledCursor: {
    ...Platform.select({
      web: { cursor: "not-allowed" },
      default: null,
    }),
  },
});

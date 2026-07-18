import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet } from "react-native";

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
  ...pressableProps
}) {
  const isOn = value === true;
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
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isOn, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, metrics.width - metrics.thumb - metrics.padding * 2],
  });

  const handlePress = (event) => {
    event?.stopPropagation?.();
    if (disabled) return;

    const nextValue = !isOn;
    onValueChange?.(nextValue);
    onChange?.({ nativeEvent: { value: nextValue } });
  };

  const animatePress = (toValue) => {
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
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn, disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={handlePress}
      onPressIn={(event) => {
        event?.stopPropagation?.();
        onPressIn?.(event);
        if (!disabled) animatePress(0.94);
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
            backgroundColor: colors.inactiveTrack,
            borderColor: colors.inactiveBorder,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeTrack,
            {
              borderRadius: metrics.height / 2,
              backgroundColor: colors.activeTrack,
              borderColor: colors.activeBorder,
              opacity: progress,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thumb,
            {
              width: metrics.thumb,
              height: metrics.thumb,
              borderRadius: metrics.thumb / 2,
              transform: [{ translateX }, { scale: pressScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.thumbSurface,
              {
                borderRadius: metrics.thumb / 2,
                backgroundColor: colors.thumb,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeThumb,
                {
                  borderRadius: metrics.thumb / 2,
                  backgroundColor: colors.thumb,
                  opacity: progress,
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
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
  activeTrack: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
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
  thumbSurface: {
    flex: 1,
    overflow: "hidden",
  },
  activeThumb: {
    ...StyleSheet.absoluteFillObject,
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

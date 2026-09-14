import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import tinycolor from "tinycolor2";

import GradientBackground from "./GradientBackground";
import { triggerHaptic } from "../../utils/haptics";
import { t } from "../../utils/i18n";

const HUE_COLORS = [
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ff0000",
];
const HUE_MAX = 359.9;
const HUE_ACCESSIBILITY_STEP = 10;
const VALUE_ACCESSIBILITY_STEP = 0.05;
const HUE_INDICATOR_SIZE = 30;
const PICKER_INDICATOR_SIZE = 26;
const INDICATOR_SHADOW = Platform.select({
  web: { boxShadow: "0 2px 8px rgba(0,0,0,0.32)" },
  default: {
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});

const getValidColor = (color) => {
  const parsedColor = tinycolor(color);
  return parsedColor.isValid() ? parsedColor : tinycolor("#000000");
};

const getAccessibleLabel = (prefix, label) => (
  prefix ? `${prefix}: ${label}` : label
);

export default function ColorSpectrumPicker({
  color,
  onChange,
  themeColors,
  lang,
  accessibilityLabelPrefix,
  style,
  spectrumStyle,
}) {
  const [hsv, setHsv] = useState(() => getValidColor(color).toHsv());
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);
  const hsvRef = useRef(hsv);
  const onChangeRef = useRef(onChange);
  const lastEmittedColorRef = useRef(getValidColor(color).toHexString());
  const satValStart = useRef({ x: 0, y: 0 });
  const hueStart = useRef(0);

  onChangeRef.current = onChange;

  useEffect(() => {
    const nextColor = getValidColor(color);
    const normalizedColor = nextColor.toHexString();
    const displayedColor = tinycolor(hsvRef.current).toHexString();

    if (normalizedColor === displayedColor) return;

    const nextHsv = nextColor.toHsv();
    hsvRef.current = nextHsv;
    lastEmittedColorRef.current = normalizedColor;
    setHsv(nextHsv);
  }, [color]);

  const commitHsv = useCallback((nextHsv) => {
    hsvRef.current = nextHsv;
    setHsv(nextHsv);

    const nextColor = tinycolor(nextHsv).toHexString();
    if (lastEmittedColorRef.current === nextColor) return;

    lastEmittedColorRef.current = nextColor;
    onChangeRef.current?.(nextColor);
  }, []);

  const handlePickerLayout = useCallback((event) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth <= 0 || nextHeight <= 0) return;

    setPickerSize((previous) => (
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : { width: nextWidth, height: nextHeight }
    ));
  }, []);

  const handleHueLayout = useCallback((event) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth <= 0) return;
    setHueSliderWidth((previous) => (previous === nextWidth ? previous : nextWidth));
  }, []);

  const updateSatVal = useCallback((x, y) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;

    const clampedX = Math.max(0, Math.min(x, pickerSize.width));
    const clampedY = Math.max(0, Math.min(y, pickerSize.height));
    commitHsv({
      ...hsvRef.current,
      s: clampedX / pickerSize.width,
      v: 1 - clampedY / pickerSize.height,
    });
  }, [commitHsv, pickerSize]);

  const satValPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      triggerHaptic("dragStart", { key: "color-spectrum-sv" });
      Keyboard.dismiss();
      const x = Math.max(0, Math.min(event.nativeEvent.locationX, pickerSize.width));
      const y = Math.max(0, Math.min(event.nativeEvent.locationY, pickerSize.height));
      satValStart.current = { x, y };
      updateSatVal(x, y);
    },
    onPanResponderMove: (_, gestureState) => {
      updateSatVal(
        satValStart.current.x + gestureState.dx,
        satValStart.current.y + gestureState.dy,
      );
    },
  }), [pickerSize, updateSatVal]);

  const updateHue = useCallback((x) => {
    if (hueSliderWidth <= 0) return;

    const clampedX = Math.max(0, Math.min(x, hueSliderWidth));
    const hue = Math.min(HUE_MAX, (clampedX / hueSliderWidth) * 360);
    commitHsv({ ...hsvRef.current, h: hue });
  }, [commitHsv, hueSliderWidth]);

  const huePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      triggerHaptic("dragStart", { key: "color-spectrum-hue" });
      Keyboard.dismiss();
      const x = Math.max(0, Math.min(event.nativeEvent.locationX, hueSliderWidth));
      hueStart.current = x;
      updateHue(x);
    },
    onPanResponderMove: (_, gestureState) => {
      updateHue(hueStart.current + gestureState.dx);
    },
  }), [hueSliderWidth, updateHue]);

  const handleSatValAccessibilityAction = useCallback((event) => {
    const actionName = event.nativeEvent.actionName;
    if (actionName !== "increment" && actionName !== "decrement") return;

    const direction = actionName === "increment" ? 1 : -1;
    commitHsv({
      ...hsvRef.current,
      v: Math.max(
        0,
        Math.min(1, hsvRef.current.v + direction * VALUE_ACCESSIBILITY_STEP),
      ),
    });
  }, [commitHsv]);

  const handleHueAccessibilityAction = useCallback((event) => {
    const actionName = event.nativeEvent.actionName;
    if (actionName !== "increment" && actionName !== "decrement") return;

    const direction = actionName === "increment" ? 1 : -1;
    commitHsv({
      ...hsvRef.current,
      h: (hsvRef.current.h + direction * HUE_ACCESSIBILITY_STEP + 360) % 360,
    });
  }, [commitHsv]);

  const currentColor = tinycolor(hsv).toHexString();
  const saturation = Math.round(hsv.s * 100);
  const brightness = Math.round(hsv.v * 100);
  const hue = Math.round(hsv.h);
  const saturationBrightnessLabel = t("color_picker.saturation_brightness", lang);
  const hueLabel = t("color_picker.hue", lang);
  const pickerIndicatorPosition = {
    top: (1 - hsv.v) * pickerSize.height - PICKER_INDICATOR_SIZE / 2,
    left: hsv.s * pickerSize.width - PICKER_INDICATOR_SIZE / 2,
  };
  const hueIndicatorPosition = {
    left: (hsv.h / 360) * hueSliderWidth - HUE_INDICATOR_SIZE / 2,
  };

  return (
    <View style={style}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: themeColors.textColor }]}>
          {saturationBrightnessLabel}
        </Text>
        <Text style={[styles.sectionValue, { color: themeColors.textColor2 }]}>
          {saturation}% · {brightness}%
        </Text>
      </View>

      <GradientBackground
        accessibilityRole="adjustable"
        accessibilityLabel={getAccessibleLabel(
          accessibilityLabelPrefix,
          saturationBrightnessLabel,
        )}
        accessibilityHint={t("color_picker.saturation_brightness_hint", lang)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        accessibilityValue={{ text: `${saturation}%, ${brightness}%` }}
        onAccessibilityAction={handleSatValAccessibilityAction}
        onLayout={handlePickerLayout}
        {...satValPanResponder.panHandlers}
        style={[
          styles.saturationValuePicker,
          { borderColor: themeColors.borderColor },
          spectrumStyle,
        ]}
        fallbackColor="#fff"
        layers={[
          { colors: ["transparent", "#000"], angle: 90, smoothColors: false },
          {
            colors: ["#fff", tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()],
            angle: 0,
            smoothColors: false,
          },
        ]}
      >
        {pickerSize.width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.pickerIndicator,
              pickerIndicatorPosition,
              { backgroundColor: currentColor },
            ]}
          />
        )}
      </GradientBackground>

      <View style={[styles.sectionHeader, styles.hueHeader]}>
        <Text style={[styles.sectionLabel, { color: themeColors.textColor }]}>
          {hueLabel}
        </Text>
        <Text style={[styles.sectionValue, { color: themeColors.textColor2 }]}>
          {hue}°
        </Text>
      </View>

      <View
        accessibilityRole="adjustable"
        accessibilityLabel={getAccessibleLabel(accessibilityLabelPrefix, hueLabel)}
        accessibilityHint={t("color_picker.hue_hint", lang)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        accessibilityValue={{ min: 0, max: 360, now: hue }}
        onAccessibilityAction={handleHueAccessibilityAction}
        onLayout={handleHueLayout}
        {...huePanResponder.panHandlers}
        style={styles.hueSliderContainer}
      >
        <GradientBackground
          colors={HUE_COLORS}
          style={styles.hueSlider}
          angle={0}
          smoothColors={false}
        />
        {hueSliderWidth > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.hueIndicator,
              hueIndicatorPosition,
              { backgroundColor: currentColor },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    minHeight: 24,
    marginBottom: 8,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  sectionValue: {
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  saturationValuePicker: {
    minHeight: 220,
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
  },
  pickerIndicator: {
    width: PICKER_INDICATOR_SIZE,
    height: PICKER_INDICATOR_SIZE,
    borderRadius: PICKER_INDICATOR_SIZE / 2,
    borderColor: "#fff",
    borderWidth: 3,
    position: "absolute",
    ...INDICATOR_SHADOW,
  },
  hueHeader: {
    marginTop: 16,
    marginBottom: 4,
  },
  hueSliderContainer: {
    height: 44,
    position: "relative",
    justifyContent: "center",
  },
  hueSlider: {
    height: 14,
    borderRadius: 7,
    width: "100%",
  },
  hueIndicator: {
    width: HUE_INDICATOR_SIZE,
    height: HUE_INDICATOR_SIZE,
    borderRadius: 8,
    position: "absolute",
    borderWidth: 3,
    borderColor: "#fff",
    ...INDICATOR_SHADOW,
  },
});

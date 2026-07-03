import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import tinycolor from "tinycolor2";

import BottomSheet, { SheetScrollView } from "./BottomSheet";
import themes from "../../config/themes";
import { useSchedule } from "../../context/ScheduleProvider";

const HUE_COLORS = [
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ff0000",
];
const HUE_INDICATOR_WIDTH = 40;
const HUE_INDICATOR_HEIGHT = 32;

export default function AdvancedColorPicker({ visible, initialColor, onSave, onClose }) {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const [hsv, setHsv] = useState(() => tinycolor(initialColor).toHsv());
  const [hexInput, setHexInput] = useState(() => tinycolor(initialColor).toHexString());
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);

  const satValStart = useRef({ x: 0, y: 0 });
  const hueStart = useRef(0);
  const hsvRef = useRef(hsv);

  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  useEffect(() => {
    if (!visible) return;
    const newColor = tinycolor(initialColor);
    setHsv(newColor.toHsv());
    setHexInput(newColor.toHexString());
  }, [visible, initialColor]);

  useEffect(() => {
    setHexInput(tinycolor(hsv).toHexString());
  }, [hsv]);

  const handleHexInputBlur = () => {
    const newColor = tinycolor(hexInput);
    if (newColor.isValid()) {
      setHsv(newColor.toHsv());
    } else {
      setHexInput(tinycolor(hsv).toHexString());
    }
  };

  const updateSatVal = (x, y) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;
    const clampedX = Math.max(0, Math.min(x, pickerSize.width));
    const clampedY = Math.max(0, Math.min(y, pickerSize.height));
    setHsv((previous) => ({
      ...previous,
      s: clampedX / pickerSize.width,
      v: 1 - clampedY / pickerSize.height,
    }));
  };

  const satValPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          const { s, v } = hsvRef.current;
          satValStart.current = {
            x: s * pickerSize.width,
            y: (1 - v) * pickerSize.height,
          };
        },
        onPanResponderMove: (_, gestureState) => {
          updateSatVal(
            satValStart.current.x + gestureState.dx,
            satValStart.current.y + gestureState.dy
          );
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [pickerSize]
  );

  const updateHue = (x) => {
    if (hueSliderWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(x, hueSliderWidth));
    const hue = (clampedX / hueSliderWidth) * 360;
    setHsv((previous) => ({ ...previous, h: hue >= 360 ? 359.9 : hue }));
  };

  const huePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          hueStart.current = (hsvRef.current.h / 360) * hueSliderWidth;
        },
        onPanResponderMove: (_, gestureState) => {
          updateHue(hueStart.current + gestureState.dx);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [hueSliderWidth]
  );

  const currentColor = tinycolor(hsv).toHexString();
  const pickerIndicatorPosition = {
    top: (1 - hsv.v) * pickerSize.height - 10,
    left: hsv.s * pickerSize.width - 10,
  };
  const hueIndicatorPosition = {
    left: (hsv.h / 360) * hueSliderWidth - HUE_INDICATOR_WIDTH / 2,
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={["66%", "90%"]}
      initialSnapIndex={1}
      maxWidth={620}
      backgroundColor={themeColors.backgroundColor2}
      handleColor={themeColors.textColor3}
      enableContentPanningGesture={false}
      accessibilityLabel="Вибір кольору"
      closeAccessibilityLabel="Закрити"
      testID="advanced-color-picker-sheet"
    >
      <SheetScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.pickerContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={[styles.backText, { color: themeColors.accentColor }]}>{"< Назад"}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: themeColors.textColor }]}>Вибір кольору</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            accessibilityLabel="HEX color"
            style={[
              styles.hexInput,
              {
                backgroundColor: themeColors.backgroundColor3,
                color: themeColors.textColor,
                borderColor: themeColors.borderColor,
              },
            ]}
            value={hexInput}
            onChangeText={setHexInput}
            onBlur={handleHexInputBlur}
            onSubmitEditing={() => {
              handleHexInputBlur();
              Keyboard.dismiss();
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View
          accessibilityLabel="Saturation and brightness"
          onLayout={(event) => setPickerSize(event.nativeEvent.layout)}
          {...satValPanResponder.panHandlers}
          style={[styles.saturationValuePicker, { borderColor: themeColors.borderColor }]}
        >
          <LinearGradient
            colors={["#fff", tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
          <LinearGradient colors={["transparent", "#000"]} style={StyleSheet.absoluteFill} />
          {pickerSize.width > 0 && (
            <View style={[styles.pickerIndicator, pickerIndicatorPosition]} />
          )}
        </View>

        <View
          accessibilityLabel="Hue"
          onLayout={(event) => setHueSliderWidth(event.nativeEvent.layout.width)}
          {...huePanResponder.panHandlers}
          style={styles.hueSliderContainer}
        >
          <LinearGradient
            colors={HUE_COLORS}
            style={styles.hueSlider}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
          {hueSliderWidth > 0 && (
            <View
              style={[
                styles.hueIndicator,
                hueIndicatorPosition,
                { backgroundColor: currentColor },
              ]}
            />
          )}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.saveButton, { backgroundColor: currentColor }]}
          onPress={() => onSave(currentColor)}
        >
          <Text style={styles.saveButtonText}>Обрати</Text>
        </TouchableOpacity>
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  pickerContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerSpacer: { width: 58 },
  backText: { fontSize: 16 },
  title: { fontSize: 18, fontWeight: "700" },
  inputContainer: { marginBottom: 20, alignItems: "center" },
  hexInput: {
    minWidth: 160,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  saturationValuePicker: {
    height: 250,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    marginBottom: 20,
    borderWidth: 1,
  },
  pickerIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: "#fff",
    borderWidth: 2,
    position: "absolute",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  hueSliderContainer: {
    height: 50,
    marginTop: 4,
    marginBottom: 20,
    position: "relative",
    justifyContent: "center",
  },
  hueSlider: { height: 24, borderRadius: 12, width: "100%" },
  hueIndicator: {
    width: HUE_INDICATOR_WIDTH,
    height: HUE_INDICATOR_HEIGHT,
    borderRadius: 8,
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  saveButton: {
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
  },
  saveButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

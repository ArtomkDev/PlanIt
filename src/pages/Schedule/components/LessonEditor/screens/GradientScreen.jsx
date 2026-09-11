import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Keyboard } from "react-native";
import tinycolor from "tinycolor2";
import GradientBackground from "../../../../../components/ui/GradientBackground";
import TabSwitcher from "../../../../../components/ui/TabSwitcher";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";
import {
  applySoftCardinalMagnet,
  CARDINAL_GRADIENT_ANGLES,
  clampGradientSliderAngle,
  getCardinalSnapTarget,
  GRADIENT_ANGLE_MAX,
  GRADIENT_ANGLE_RELEASE_RADIUS,
  snapGradientAngleOnRelease,
} from "../../../../../utils/gradientAngles";

const HUE_COLORS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
const HUE_INDICATOR_WIDTH = 32;
const ANGLE_THUMB_SIZE = 24;
const ANGLE_ACCESSIBILITY_STEP = 5;

const AngleSlider = ({ value, onChange, themeColors, accessibilityLabel }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const gestureStartX = useRef(0);
  const rawAngleRef = useRef(clampGradientSliderAngle(value));
  const snappedTargetRef = useRef(null);
  const pendingAngleRef = useRef(clampGradientSliderAngle(value));
  const frameRef = useRef(null);

  const emitAngle = useCallback((nextAngle, immediate = false) => {
    pendingAngleRef.current = nextAngle;

    if (immediate) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      onChange(nextAngle);
      return;
    }

    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      onChange(pendingAngleRef.current);
    });
  }, [onChange]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const updateAngle = useCallback((x) => {
    if (trackWidth <= 0 || !Number.isFinite(x)) return;
    const clampedX = Math.max(0, Math.min(x, trackWidth));
    const rawAngle = Math.min(
      GRADIENT_ANGLE_MAX,
      (clampedX / trackWidth) * 360,
    );
    const snapTarget = getCardinalSnapTarget(rawAngle);

    rawAngleRef.current = rawAngle;
    if (snapTarget !== null && snappedTargetRef.current !== snapTarget) {
      snappedTargetRef.current = snapTarget;
      triggerHaptic("selection", { key: `gradient-angle-${snapTarget}` });
    } else if (snapTarget === null) {
      snappedTargetRef.current = null;
    }

    emitAngle(applySoftCardinalMagnet(rawAngle));
  }, [emitAngle, trackWidth]);

  const finishAngleGesture = useCallback(() => {
    const releasedAngle = snapGradientAngleOnRelease(rawAngleRef.current);
    const releaseTarget = getCardinalSnapTarget(
      rawAngleRef.current,
      GRADIENT_ANGLE_RELEASE_RADIUS,
    );

    if (releaseTarget !== null && snappedTargetRef.current !== releaseTarget) {
      triggerHaptic("selection", { key: `gradient-angle-${releaseTarget}` });
    }
    snappedTargetRef.current = null;
    emitAngle(releasedAngle, true);
  }, [emitAngle]);

  const anglePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      triggerHaptic("dragStart", { key: "gradient-angle-slider" });
      gestureStartX.current = event.nativeEvent.locationX;
      updateAngle(gestureStartX.current);
    },
    onPanResponderMove: (_, gestureState) => {
      updateAngle(gestureStartX.current + gestureState.dx);
    },
    onPanResponderRelease: finishAngleGesture,
    onPanResponderTerminate: finishAngleGesture,
  }), [finishAngleGesture, updateAngle]);

  const handleAccessibilityAction = useCallback((event) => {
    const direction = event.nativeEvent.actionName === "increment" ? 1 : -1;
    const rawAngle = clampGradientSliderAngle(
      Number(value) + direction * ANGLE_ACCESSIBILITY_STEP,
    );
    rawAngleRef.current = rawAngle;
    emitAngle(applySoftCardinalMagnet(rawAngle), true);
  }, [emitAngle, value]);

  const displayedAngle = clampGradientSliderAngle(value);
  const progress = trackWidth > 0 ? displayedAngle / 360 : 0;

  return (
    <View
      style={styles.angleSliderTouchArea}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: GRADIENT_ANGLE_MAX, now: Math.round(displayedAngle) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={handleAccessibilityAction}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      {...anglePanResponder.panHandlers}
    >
      <View style={[styles.angleTrack, { backgroundColor: themeColors.backgroundColor3 }]}>
        <View style={[styles.angleTrackFill, { width: `${progress * 100}%`, backgroundColor: themeColors.accentColor }]} />
        {CARDINAL_GRADIENT_ANGLES.map((cardinalAngle) => (
          <View
            key={cardinalAngle}
            pointerEvents="none"
            style={[
              styles.angleTick,
              {
                left: `${(cardinalAngle / 360) * 100}%`,
                backgroundColor: themeColors.textColor,
              },
            ]}
          />
        ))}
      </View>
      {trackWidth > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.angleThumb,
            {
              left: progress * trackWidth - ANGLE_THUMB_SIZE / 2,
              backgroundColor: themeColors.accentColor,
            },
          ]}
        />
      )}
      <View pointerEvents="none" style={styles.angleScale}>
        {CARDINAL_GRADIENT_ANGLES.map((cardinalAngle) => (
          <Text
            key={cardinalAngle}
            style={[
              styles.angleScaleLabel,
              {
                left: `${(cardinalAngle / 360) * 100}%`,
                color: themeColors.textColor2,
              },
            ]}
          >
            {cardinalAngle}°
          </Text>
        ))}
      </View>
    </View>
  );
};

const InlineColorPicker = ({ initialColor, onChange, themeColors, accessibilityLabel }) => {
  const [hsv, setHsv] = useState(() => tinycolor(initialColor).toHsv());
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);

  const satValStart = useRef({ x: 0, y: 0 });
  const hueStart = useRef(0);
  const hsvRef = useRef(hsv);

  useEffect(() => { hsvRef.current = hsv; }, [hsv]);
  useEffect(() => { onChange(tinycolor(hsv).toHexString()); }, [hsv]);

  const updateSatVal = (x, y) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;
    const clampedX = Math.max(0, Math.min(x, pickerSize.width));
    const clampedY = Math.max(0, Math.min(y, pickerSize.height));
    setHsv(prev => ({ ...prev, s: clampedX / pickerSize.width, v: 1 - (clampedY / pickerSize.height) }));
  };

  const satValPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false, 
    onShouldBlockNativeResponder: () => true,      
    onPanResponderGrant: () => {
      triggerHaptic("dragStart", { key: "inline-gradient-sv" });
      const { s, v } = hsvRef.current;
      satValStart.current = { x: s * pickerSize.width, y: (1 - v) * pickerSize.height };
    },
    onPanResponderMove: (_, gestureState) => {
      updateSatVal(satValStart.current.x + gestureState.dx, satValStart.current.y + gestureState.dy);
    },
  }), [pickerSize]);

  const updateHue = (x) => {
    if (hueSliderWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(x, hueSliderWidth));
    const h = (clampedX / hueSliderWidth) * 360;
    setHsv(prev => ({ ...prev, h: h >= 360 ? 359.9 : h }));
  };

  const huePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => {
      triggerHaptic("dragStart", { key: "inline-gradient-hue" });
      const { h } = hsvRef.current;
      hueStart.current = (h / 360) * hueSliderWidth;
    },
    onPanResponderMove: (_, gestureState) => {
      updateHue(hueStart.current + gestureState.dx);
    },
  }), [hueSliderWidth]);

  return (
    <View style={styles.inlinePickerContainer}>
      <GradientBackground
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel + " saturation and brightness"}
        onLayout={(e) => setPickerSize(e.nativeEvent.layout)}
        {...satValPanResponder.panHandlers}
        style={[styles.saturationValuePicker, { borderColor: themeColors.borderColor }]}
        fallbackColor="#fff"
        layers={[
          { colors: ['transparent', '#000'], angle: 90, smoothColors: false },
          { colors: ['#fff', tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()], angle: 0, smoothColors: false },
        ]}
      >
        {pickerSize.width > 0 && <View style={[styles.pickerIndicator, { top: (1 - hsv.v) * pickerSize.height - 12, left: hsv.s * pickerSize.width - 12 }]} />}
      </GradientBackground>
      <View accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel + " hue"} onLayout={(e) => setHueSliderWidth(e.nativeEvent.layout.width)} {...huePanResponder.panHandlers} style={styles.hueSliderContainer}>
        <GradientBackground colors={HUE_COLORS} angle={0} smoothColors={false} style={styles.hueSlider} />
        {hueSliderWidth > 0 && <View style={[styles.hueIndicator, { left: (hsv.h / 360) * hueSliderWidth - (HUE_INDICATOR_WIDTH / 2), backgroundColor: tinycolor(hsv).toHexString() }]} />}
      </View>
    </View>
  );
};

export default function LessonEditorGradientEditScreen({ themeColors, gradientToEdit, onSave }) {
  const { global , lang} = useScheduleData();

  const getInitialColor = (index, fallback) => {
    if (gradientToEdit && gradientToEdit.colors && gradientToEdit.colors[index]) {
      const c = gradientToEdit.colors[index];
      return typeof c === 'string' ? c : c.color || fallback;
    }
    return fallback;
  };

  const [color1, setColor1] = useState(() => getInitialColor(0, "#4facfe"));
  const [color2, setColor2] = useState(() => getInitialColor(1, "#00f2fe"));
  const [angle, setAngle] = useState(() => clampGradientSliderAngle(gradientToEdit?.angle ?? 90));
  const [activeTab, setActiveTab] = useState(0); 

  useEffect(() => {
    if (gradientToEdit && gradientToEdit.colors) {
      const c1 = typeof gradientToEdit.colors[0] === 'string' ? gradientToEdit.colors[0] : gradientToEdit.colors[0]?.color;
      const c2 = typeof gradientToEdit.colors[1] === 'string' ? gradientToEdit.colors[1] : gradientToEdit.colors[1]?.color;
      setColor1(c1 || "#4facfe");
      setColor2(c2 || "#00f2fe");
      setAngle(clampGradientSliderAngle(gradientToEdit.angle ?? 90));
    }
  }, [gradientToEdit]);

  const handleSave = () => {
    const newGradient = {
      ...gradientToEdit,
      id: gradientToEdit ? gradientToEdit.id : Date.now(),
      type: "linear",
      angle: Math.round(clampGradientSliderAngle(angle)),
      colors: [ { color: color1, position: 0 }, { color: color2, position: 1 } ],
    };
    onSave(newGradient);
  };

  const tabs = [
    { id: 0, label: `${t('schedule.lesson_editor.color_tab', lang)} 1`, colorDot: color1 },
    { id: 1, label: `${t('schedule.lesson_editor.color_tab', lang)} 2`, colorDot: color2 },
  ];

  return (
    <View style={styles.container} onStartShouldSetResponder={() => Keyboard.dismiss()}>
      <View style={styles.previewContainer}>
        <GradientBackground
          gradient={{ type: "linear", angle, colors: [ { color: color1, position: 0 }, { color: color2, position: 1 } ] }}
          style={styles.preview}
        />
      </View>
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.label, { color: themeColors.textColor }]}>{t('schedule.lesson_editor.gradient_angle', lang)}</Text>
          <Text style={[styles.value, { color: themeColors.accentColor }]}>{Math.round(clampGradientSliderAngle(angle))}°</Text>
        </View>
        <View style={styles.sliderTrackWrapper} onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}>
          <AngleSlider value={angle} onChange={setAngle} themeColors={themeColors} accessibilityLabel={t('schedule.lesson_editor.gradient_angle', lang)} />
        </View>
      </View>

      <TabSwitcher
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={setActiveTab}
        themeColors={themeColors}
        containerBackgroundColor={themeColors.backgroundColor3}
        activeTabBackgroundColor={themeColors.backgroundColor2}
        withShadow={true}
      />

      <InlineColorPicker 
        key={`picker-${gradientToEdit?.id || 'new'}-${activeTab}`} 
        themeColors={themeColors} 
        initialColor={activeTab === 0 ? color1 : color2} 
        onChange={(newColor) => activeTab === 0 ? setColor1(newColor) : setColor2(newColor)} 
        accessibilityLabel={tabs[activeTab].label}
      />
      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} onPress={handleSave} accessibilityRole="button" accessibilityLabel={t('schedule.lesson_editor.save_gradient', lang)}>
        <Text style={styles.saveText}>{t('schedule.lesson_editor.save_gradient', lang)}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  previewContainer: { height: 120, borderRadius: 20, marginBottom: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  preview: { flex: 1 },
  sliderContainer: { marginBottom: 20 },
  sliderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  label: { fontSize: 15, fontWeight: "600" },
  value: { fontWeight: "bold", fontSize: 15 },
  sliderTrackWrapper: { paddingHorizontal: 5 },
  angleSliderTouchArea: { minHeight: 62, paddingTop: 12, position: "relative" },
  angleTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  angleTrackFill: { height: "100%", borderRadius: 4 },
  angleTick: { position: "absolute", top: 1, bottom: 1, width: 1, opacity: 0.38 },
  angleThumb: {
    position: "absolute",
    top: 4,
    width: ANGLE_THUMB_SIZE,
    height: ANGLE_THUMB_SIZE,
    borderRadius: ANGLE_THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  angleScale: { height: 18, marginTop: 7, position: "relative" },
  angleScaleLabel: {
    position: "absolute",
    width: 42,
    marginLeft: -21,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.72,
  },
  inlinePickerContainer: { flex: 1, marginBottom: 20 },
  saturationValuePicker: { flex: 1, minHeight: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  pickerIndicator: { width: 24, height: 24, borderRadius: 12, borderColor: '#fff', borderWidth: 2.5, position: 'absolute', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  hueSliderContainer: { minHeight: 44, marginTop: 16, justifyContent: 'center' },
  hueSlider: { height: 20, borderRadius: 10, width: '100%' },
  hueIndicator: { width: HUE_INDICATOR_WIDTH, height: 28, borderRadius: 8, position: 'absolute', borderWidth: 2.5, borderColor: '#fff', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 30 },
  saveText: { fontSize: 16, fontWeight: "bold", color: "#fff" },
});

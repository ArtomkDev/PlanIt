import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from "react-native";
import { Check, Trash } from "phosphor-react-native";
import tinycolor from "tinycolor2";
import { SheetScrollView } from "../../../../../components/ui/BottomSheet";
import ColorSpectrumPicker from "../../../../../components/ui/ColorSpectrumPicker";
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

export default function LessonEditorGradientEditScreen({ themeColors, gradientToEdit, onSave, onDelete }) {
  const { lang } = useScheduleData();

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
  const saveContentColor = tinycolor(themeColors.accentColor).isLight()
    ? "#111827"
    : "#FFFFFF";

  return (
    <SheetScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.previewContainer}>
        <GradientBackground
          gradient={{
            type: "linear",
            angle,
            colors: [
              { color: color1, position: 0 },
              { color: color2, position: 1 },
            ],
          }}
          style={styles.preview}
        />
      </View>
      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.label, { color: themeColors.textColor }]}>
            {t('schedule.lesson_editor.gradient_angle', lang)}
          </Text>
          <Text style={[styles.value, { color: themeColors.accentColor }]}>
            {Math.round(clampGradientSliderAngle(angle))}°
          </Text>
        </View>
        <View style={styles.sliderTrackWrapper}>
          <AngleSlider
            value={angle}
            onChange={setAngle}
            themeColors={themeColors}
            accessibilityLabel={t('schedule.lesson_editor.gradient_angle', lang)}
          />
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

      <ColorSpectrumPicker
        color={activeTab === 0 ? color1 : color2}
        onChange={activeTab === 0 ? setColor1 : setColor2}
        themeColors={themeColors}
        lang={lang}
        accessibilityLabelPrefix={tabs[activeTab].label}
        style={styles.colorPicker}
        spectrumStyle={styles.flexibleSpectrum}
      />
      {onDelete && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={t('schedule.lesson_editor.delete_entity', lang)}
        >
          <Trash size={19} color="#DC2626" weight="bold" />
          <Text style={styles.deleteText}>{t('schedule.lesson_editor.delete_entity', lang)}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]}
        onPress={handleSave}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityLabel={t('schedule.lesson_editor.save_gradient', lang)}
      >
        <Check size={20} color={saveContentColor} weight="bold" />
        <Text style={[styles.saveText, { color: saveContentColor }]}>
          {t('schedule.lesson_editor.save_gradient', lang)}
        </Text>
      </TouchableOpacity>
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  previewContainer: {
    height: 120,
    borderRadius: 18,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  preview: { flex: 1 },
  sliderContainer: { marginBottom: 18 },
  sliderHeader: {
    minHeight: 24,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  value: {
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
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
  colorPicker: {
    flex: 1,
    minHeight: 260,
    marginTop: 16,
    marginBottom: 16,
  },
  flexibleSpectrum: {
    flex: 1,
    minHeight: 150,
  },
  deleteBtn: { minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteText: { color: "#DC2626", fontSize: 15, fontWeight: "700" },
  saveBtn: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  saveText: { fontSize: 16, fontWeight: "800" },
});

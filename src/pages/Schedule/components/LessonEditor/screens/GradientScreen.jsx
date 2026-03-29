import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Keyboard } from "react-native";
import Slider from "@react-native-assets/slider";
import { LinearGradient } from "expo-linear-gradient";
import tinycolor from "tinycolor2";
import GradientBackground from "../../../../../components/GradientBackground";
import TabSwitcher from "../ui/TabSwitcher";
import { useSchedule } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";

const HUE_COLORS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
const HUE_INDICATOR_WIDTH = 32;

const InlineColorPicker = ({ initialColor, onChange, themeColors }) => {
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
      const { h } = hsvRef.current;
      hueStart.current = (h / 360) * hueSliderWidth;
    },
    onPanResponderMove: (_, gestureState) => {
      updateHue(hueStart.current + gestureState.dx);
    },
  }), [hueSliderWidth]);

  return (
    <View style={styles.inlinePickerContainer}>
      <View onLayout={(e) => setPickerSize(e.nativeEvent.layout)} {...satValPanResponder.panHandlers} style={[styles.saturationValuePicker, { borderColor: themeColors.borderColor }]}>
        <LinearGradient colors={['#fff', tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
        <LinearGradient colors={['transparent', '#000']} style={StyleSheet.absoluteFill} />
        {pickerSize.width > 0 && <View style={[styles.pickerIndicator, { top: (1 - hsv.v) * pickerSize.height - 12, left: hsv.s * pickerSize.width - 12 }]} />}
      </View>
      <View onLayout={(e) => setHueSliderWidth(e.nativeEvent.layout.width)} {...huePanResponder.panHandlers} style={styles.hueSliderContainer}>
        <LinearGradient colors={HUE_COLORS} style={styles.hueSlider} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
        {hueSliderWidth > 0 && <View style={[styles.hueIndicator, { left: (hsv.h / 360) * hueSliderWidth - (HUE_INDICATOR_WIDTH / 2), backgroundColor: tinycolor(hsv).toHexString() }]} />}
      </View>
    </View>
  );
};

export default function LessonEditorGradientEditScreen({ themeColors, gradientToEdit, onSave }) {
  const { global , lang} = useSchedule();


  const getInitialColor = (index, fallback) => {
    if (gradientToEdit && gradientToEdit.colors && gradientToEdit.colors[index]) {
      const c = gradientToEdit.colors[index];
      return typeof c === 'string' ? c : c.color || fallback;
    }
    return fallback;
  };

  const [color1, setColor1] = useState(() => getInitialColor(0, "#4facfe"));
  const [color2, setColor2] = useState(() => getInitialColor(1, "#00f2fe"));
  const [angle, setAngle] = useState(() => gradientToEdit?.angle ?? 90);
  const [activeTab, setActiveTab] = useState(0); 

  useEffect(() => {
    if (gradientToEdit && gradientToEdit.colors) {
      const c1 = typeof gradientToEdit.colors[0] === 'string' ? gradientToEdit.colors[0] : gradientToEdit.colors[0]?.color;
      const c2 = typeof gradientToEdit.colors[1] === 'string' ? gradientToEdit.colors[1] : gradientToEdit.colors[1]?.color;
      setColor1(c1 || "#4facfe");
      setColor2(c2 || "#00f2fe");
      setAngle(gradientToEdit.angle ?? 90);
    }
  }, [gradientToEdit]);

  const handleSave = () => {
    const newGradient = {
      ...gradientToEdit,
      id: gradientToEdit ? gradientToEdit.id : Date.now(),
      type: "linear",
      angle: Math.round(angle),
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
          <Text style={[styles.value, { color: themeColors.accentColor }]}>{Math.round(angle)}°</Text>
        </View>
        <View style={styles.sliderTrackWrapper} onStartShouldSetResponder={() => true} onResponderTerminationRequest={() => false}>
          <Slider style={{ width: "100%", height: 40 }} minimumValue={0} maximumValue={360} value={angle} onValueChange={setAngle} step={1} minimumTrackTintColor={themeColors.accentColor} maximumTrackTintColor={themeColors.backgroundColor3} thumbTintColor={themeColors.accentColor} trackHeight={8} thumbSize={24} />
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
      />
      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]} onPress={handleSave}>
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
  inlinePickerContainer: { flex: 1, marginBottom: 20 },
  saturationValuePicker: { flex: 1, minHeight: 180, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  pickerIndicator: { width: 24, height: 24, borderRadius: 12, borderColor: '#fff', borderWidth: 2.5, position: 'absolute', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  hueSliderContainer: { height: 40, marginTop: 16, justifyContent: 'center' },
  hueSlider: { height: 20, borderRadius: 10, width: '100%' },
  hueIndicator: { width: HUE_INDICATOR_WIDTH, height: 28, borderRadius: 8, position: 'absolute', borderWidth: 2.5, borderColor: '#fff', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", marginBottom: 30 },
  saveText: { fontSize: 16, fontWeight: "bold", color: "#fff" },
});
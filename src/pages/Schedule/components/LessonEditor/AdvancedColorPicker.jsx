import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, TextInput, PanResponder, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tinycolor from 'tinycolor2';

const HUE_COLORS = [
  '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'
];

export default function AdvancedColorPicker({ visible, initialColor, onSave, onClose }) {
  // Master state for the color, controlled by gestures.
  const [hsv, setHsv] = useState(() => tinycolor(initialColor).toHsv());
  // Separate state for the text input to allow free typing without fighting the UI.
  const [hexInput, setHexInput] = useState(() => tinycolor(initialColor).toHexString());
  
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);

  // When the modal becomes visible, reset the state from the initialColor prop.
  useEffect(() => {
    if (visible) {
      const newColor = tinycolor(initialColor);
      setHsv(newColor.toHsv());
      setHexInput(newColor.toHexString());
    }
  }, [visible, initialColor]);

  // Sync: When the color (HSV) is changed by the sliders, update the text input.
  useEffect(() => {
    setHexInput(tinycolor(hsv).toHexString());
  }, [hsv]);

  // Handler for when the user is done editing the text input.
  const handleHexInputBlur = () => {
    const newColor = tinycolor(hexInput);
    if (newColor.isValid()) {
      // If the input is a valid color, update the master color state.
      setHsv(newColor.toHsv());
    } else {
      // If the input is invalid, revert the input to the last valid color.
      setHexInput(tinycolor(hsv).toHexString());
    }
  };

  const handleSave = () => {
    // Ensure the saved color is from the master state.
    onSave(tinycolor(hsv).toHexString());
  };

  const handleSatValChange = useCallback((event) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;
    const { locationX, locationY } = event.nativeEvent;
    const s = Math.max(0, Math.min(1, locationX / pickerSize.width));
    const v = 1 - Math.max(0, Math.min(1, locationY / pickerSize.height));
    setHsv(currentHsv => ({ ...currentHsv, s, v }));
  }, [pickerSize.width, pickerSize.height]);

  const handleHueChange = useCallback((event) => {
    if (hueSliderWidth <= 0) return;
    const { locationX } = event.nativeEvent;
    const h = (Math.max(0, Math.min(locationX, hueSliderWidth)) / hueSliderWidth) * 360;
    setHsv(currentHsv => ({ ...currentHsv, h: h >= 360 ? 359.9 : h }));
  }, [hueSliderWidth]);

  const satValPanResponder = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: handleSatValChange, onPanResponderMove: handleSatValChange }), [handleSatValChange]);
  const huePanResponder = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderGrant: handleHueChange, onPanResponderMove: handleHueChange }), [handleHueChange]);

  const pickerIndicatorPosition = { top: (1 - hsv.v) * pickerSize.height - 7.5, left: hsv.s * pickerSize.width - 7.5 };
  const hueIndicatorPosition = { left: (hsv.h / 360) * hueSliderWidth - 7.5 };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.pickerContainer} activeOpacity={1} onPress={Keyboard.dismiss}>
            <Text style={styles.title}>Обери колір</Text>
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={setHexInput} // Update text input state freely.
              onBlur={handleHexInputBlur} // Sync with master color state on blur.
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View onLayout={(e) => setPickerSize(e.nativeEvent.layout)} {...satValPanResponder.panHandlers} style={styles.saturationValuePicker}>
              <LinearGradient colors={['#fff', tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
              <LinearGradient colors={['transparent', '#000']} style={StyleSheet.absoluteFill} />
              {pickerSize.width > 0 && <View style={[styles.pickerIndicator, pickerIndicatorPosition]} />}
            </View>
            <View onLayout={(e) => setHueSliderWidth(e.nativeEvent.layout.width)} {...huePanResponder.panHandlers} style={styles.hueSliderContainer}>
              <LinearGradient colors={HUE_COLORS} style={styles.hueSlider} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
              {hueSliderWidth > 0 && <View style={[styles.hueIndicator, hueIndicatorPosition]} />}
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Обрати</Text>
            </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerContainer: { backgroundColor: '#1E1F22', paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { color: '#F2F3F5', fontSize: 16, fontWeight: '600', marginBottom: 15, textAlign: 'center' },
  hexInput: { backgroundColor: '#2B2D31', color: '#DBDEE1', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 20, fontSize: 16, fontWeight: '500' },
  saturationValuePicker: { height: 200, width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  pickerIndicator: { width: 15, height: 15, borderRadius: 7.5, borderColor: '#fff', borderWidth: 2, position: 'absolute', elevation: 5, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  hueSliderContainer: { height: 30, marginTop: 20, marginBottom: 10, position: 'relative', justifyContent: 'center' },
  hueSlider: { height: 12, borderRadius: 6, width: '100%' },
  hueIndicator: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', position: 'absolute', borderWidth: 2, borderColor: '#1E1F22', elevation: 5, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  saveButton: { backgroundColor: '#5865F2', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

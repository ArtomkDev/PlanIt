import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, StyleSheet, Text, TextInput, PanResponder, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tinycolor from 'tinycolor2';

const HUE_COLORS = [
  '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'
];

export default function LessonEditorAdvancedColorPicker({ initialColor, onColorChange, themeColors }) {
  const [hsv, setHsv] = useState(() => tinycolor(initialColor).toHsv());
  const [hexInput, setHexInput] = useState(() => tinycolor(initialColor).toHexString());
  
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);

  useEffect(() => {
    const newHex = tinycolor(hsv).toHexString();
    setHexInput(newHex);
    onColorChange(newHex); // Відправляємо зміни "вгору" в реальному часі
  }, [hsv]);

  const handleHexInputBlur = () => {
    const newColor = tinycolor(hexInput);
    if (newColor.isValid()) {
      setHsv(newColor.toHsv());
    } else {
      setHexInput(tinycolor(hsv).toHexString());
    }
  };

  const handleSatValChange = useCallback((event) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;
    const { locationX, locationY } = event.nativeEvent;
    const s = Math.max(0, Math.min(1, locationX / pickerSize.width));
    const v = 1 - Math.max(0, Math.min(1, locationY / pickerSize.height));
    setHsv(currentHsv => ({ ...currentHsv, s, v }));
  }, [pickerSize]);

  const handleHueChange = useCallback((event) => {
    if (hueSliderWidth <= 0) return;
    const { locationX } = event.nativeEvent;
    const h = (Math.max(0, Math.min(locationX, hueSliderWidth)) / hueSliderWidth) * 360;
    setHsv(currentHsv => ({ ...currentHsv, h: h >= 360 ? 359.9 : h }));
  }, [hueSliderWidth]);

  const satValPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: handleSatValChange,
    onPanResponderMove: handleSatValChange
  }), [handleSatValChange]);

  const huePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: handleHueChange,
    onPanResponderMove: handleHueChange
  }), [handleHueChange]);

  const pickerIndicatorPosition = { 
    top: (1 - hsv.v) * pickerSize.height - 10, 
    left: hsv.s * pickerSize.width - 10 
  };
  const hueIndicatorPosition = { 
    left: (hsv.h / 360) * hueSliderWidth - 10 
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        
        {/* Поле вводу HEX */}
        <TextInput
          style={[styles.hexInput, { 
            backgroundColor: themeColors.backgroundColor2, 
            color: themeColors.textColor,
            borderColor: themeColors.borderColor
          }]}
          value={hexInput}
          onChangeText={setHexInput}
          onBlur={handleHexInputBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Saturation/Value Picker */}
        <View 
          onLayout={(e) => setPickerSize(e.nativeEvent.layout)} 
          {...satValPanResponder.panHandlers} 
          style={[styles.saturationValuePicker, { borderColor: themeColors.borderColor }]}
        >
          <LinearGradient 
            colors={['#fff', tinycolor({ h: hsv.h, s: 1, v: 1 }).toHexString()]} 
            style={StyleSheet.absoluteFill} 
            start={{ x: 0, y: 0.5 }} 
            end={{ x: 1, y: 0.5 }} 
          />
          <LinearGradient 
            colors={['transparent', '#000']} 
            style={StyleSheet.absoluteFill} 
          />
          {pickerSize.width > 0 && (
            <View style={[styles.pickerIndicator, pickerIndicatorPosition]} />
          )}
        </View>

        {/* Hue Slider */}
        <View 
          onLayout={(e) => setHueSliderWidth(e.nativeEvent.layout.width)} 
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
            <View style={[styles.hueIndicator, hueIndicatorPosition]} />
          )}
        </View>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  hexInput: {
    padding: 12,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 1,
  },
  saturationValuePicker: {
    height: 250,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 20,
  },
  pickerIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderColor: '#fff',
    borderWidth: 2,
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  hueSliderContainer: {
    height: 40,
    justifyContent: 'center',
  },
  hueSlider: {
    height: 12,
    borderRadius: 6,
    width: '100%',
  },
  hueIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
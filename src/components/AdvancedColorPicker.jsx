import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, TextInput, PanResponder, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import tinycolor from 'tinycolor2';

const HUE_COLORS = [
  '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'
];

// Розміри індикатора для Hue
const HUE_INDICATOR_WIDTH = 40;
const HUE_INDICATOR_HEIGHT = 32;

export default function AdvancedColorPicker({ visible, initialColor, onSave, onClose }) {
  const [hsv, setHsv] = useState(() => tinycolor(initialColor).toHsv());
  const [hexInput, setHexInput] = useState(() => tinycolor(initialColor).toHexString());
  
  const [pickerSize, setPickerSize] = useState({ width: 0, height: 0 });
  const [hueSliderWidth, setHueSliderWidth] = useState(0);

  // Refs для жестів та актуального стану (щоб не було лагів через ре-рендер)
  const satValStart = useRef({ x: 0, y: 0 });
  const hueStart = useRef(0);
  const hsvRef = useRef(hsv);

  // Оновлюємо ref при зміні hsv, щоб PanResponder мав доступ до свіжих даних
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  useEffect(() => {
    if (visible) {
      const newColor = tinycolor(initialColor);
      setHsv(newColor.toHsv());
      setHexInput(newColor.toHexString());
    }
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

  const handleSave = () => {
    onSave(tinycolor(hsv).toHexString());
  };

  // --- Saturation / Value Logic ---
  const updateSatVal = (x, y) => {
    if (pickerSize.width <= 0 || pickerSize.height <= 0) return;
    const clampedX = Math.max(0, Math.min(x, pickerSize.width));
    const clampedY = Math.max(0, Math.min(y, pickerSize.height));
    const s = clampedX / pickerSize.width;
    const v = 1 - (clampedY / pickerSize.height);
    setHsv(prev => ({ ...prev, s, v }));
  };

  const satValPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // При натисканні беремо ПОТОЧНУ позицію з hsvRef, а не з події
      // Це гарантує, що ми починаємо тягнути з того місця, де зараз крапка
      const { s, v } = hsvRef.current;
      const currentX = s * pickerSize.width;
      const currentY = (1 - v) * pickerSize.height;
      
      satValStart.current = { x: currentX, y: currentY };
    },
    onPanResponderMove: (evt, gestureState) => {
      // Додаємо зміщення до початкової точки
      const x = satValStart.current.x + gestureState.dx;
      const y = satValStart.current.y + gestureState.dy;
      updateSatVal(x, y);
    },
    onPanResponderTerminationRequest: () => false,
  }), [pickerSize]); // Залежність тільки від розміру, а не від hsv!

  // --- Hue Logic ---
  const updateHue = (x) => {
    if (hueSliderWidth <= 0) return;
    const clampedX = Math.max(0, Math.min(x, hueSliderWidth));
    const h = (clampedX / hueSliderWidth) * 360;
    setHsv(prev => ({ ...prev, h: h >= 360 ? 359.9 : h }));
  };

  const huePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Те саме для Hue: стартуємо з поточної позиції повзунка
      const { h } = hsvRef.current;
      const currentX = (h / 360) * hueSliderWidth;
      
      hueStart.current = currentX;
    },
    onPanResponderMove: (evt, gestureState) => {
      const x = hueStart.current + gestureState.dx;
      updateHue(x);
    },
    onPanResponderTerminationRequest: () => false,
  }), [hueSliderWidth]); // Залежність тільки від ширини

  // Позиції індикаторів для рендеру
  const pickerIndicatorPosition = { 
    top: (1 - hsv.v) * pickerSize.height - 10, 
    left: hsv.s * pickerSize.width - 10 
  };
  
  const hueIndicatorPosition = { 
    left: (hsv.h / 360) * hueSliderWidth - (HUE_INDICATOR_WIDTH / 2) 
  };

  const currentColor = tinycolor(hsv).toHexString();

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.pickerContainer} activeOpacity={1} onPress={Keyboard.dismiss}>
            
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} hitSlop={10}>
                    <Text style={styles.backText}>{'< Назад'}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Вибір кольору</Text>
                <View style={{width: 50}} /> 
            </View>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.hexInput}
                    value={hexInput}
                    onChangeText={setHexInput}
                    onBlur={handleHexInputBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <View 
                onLayout={(e) => setPickerSize(e.nativeEvent.layout)} 
                {...satValPanResponder.panHandlers} 
                style={styles.saturationValuePicker}
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

            {/* HUE SLIDER */}
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
                <View style={[
                    styles.hueIndicator, 
                    hueIndicatorPosition,
                    { backgroundColor: currentColor } 
                ]} />
              )}
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
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerContainer: { 
    backgroundColor: '#1E1F22', 
    paddingHorizontal: 20, 
    paddingBottom: 40, 
    paddingTop: 20, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20,
    height: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: { color: '#4A90E2', fontSize: 16 },
  title: { color: '#F2F3F5', fontSize: 18, fontWeight: '600' },
  
  inputContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  hexInput: { 
    backgroundColor: '#2B2D31', 
    color: '#DBDEE1', 
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8, 
    textAlign: 'center', 
    fontSize: 18, 
    fontWeight: '600',
    minWidth: 150
  },
  saturationValuePicker: { 
    height: 250, 
    width: '100%', 
    borderRadius: 12, 
    overflow: 'hidden', 
    position: 'relative',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333'
  },
  pickerIndicator: { 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    borderColor: '#fff', 
    borderWidth: 2, 
    position: 'absolute', 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.5, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 } 
  },
  
  // --- Стилі для Hue Slider ---
  hueSliderContainer: { 
    height: 50, 
    marginTop: 10, 
    marginBottom: 20, 
    position: 'relative', 
    justifyContent: 'center' 
  },
  hueSlider: { 
    height: 24, 
    borderRadius: 12, 
    width: '100%' 
  },
  hueIndicator: { 
    width: HUE_INDICATOR_WIDTH, 
    height: HUE_INDICATOR_HEIGHT, 
    borderRadius: 6, 
    position: 'absolute', 
    borderWidth: 2, 
    borderColor: '#fff', 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.5, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 } 
  },
  
  saveButton: { 
    backgroundColor: '#5865F2', 
    paddingVertical: 14, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 'auto' 
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
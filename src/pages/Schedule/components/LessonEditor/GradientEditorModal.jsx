import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Slider from "@react-native-assets/slider";
import GradientBackground from "../../../../components/GradientBackground";
import AdvancedColorPicker from "./AdvancedColorPicker";

export default function GradientEditorModal({ visible, gradient, onClose, onSave }) {
  const [color1, setColor1] = useState("#ffffff");
  const [color2, setColor2] = useState("#000000");
  const [angle, setAngle] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState(null);

  useEffect(() => {
    if (gradient) {
      setColor1(gradient.colors?.[0]?.color || "#ffffff");
      setColor2(gradient.colors?.[1]?.color || "#000000");
      setAngle(gradient.angle || 0);
    }
  }, [gradient, visible]);

  const handleSave = () => {
    const newGradient = {
      ...gradient,
      angle,
      colors: [
        { color: color1, position: 0 },
        { color: color2, position: 1 },
      ],
    };
    onSave?.(newGradient);
  };

  const openColorPicker = (color, setter) => {
    setColorToEdit({ color, setter });
    setPickerVisible(true);
  };

  const handleColorSave = (newColor) => {
    colorToEdit.setter(newColor);
    setPickerVisible(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modal}>
        <Text style={styles.title}>Редагування градієнта</Text>

        <View style={styles.preview}>
          <GradientBackground
            gradient={{
              type: "linear",
              angle,
              colors: [
                { color: color1, position: 0 },
                { color: color2, position: 1 },
              ],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        <View style={styles.colorButtonsContainer}>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: color1 }]}
            onPress={() => openColorPicker(color1, setColor1)}
          />
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: color2 }]}
            onPress={() => openColorPicker(color2, setColor2)}
          />
        </View>

        <Text style={styles.label}>Кут: {Math.round(angle)}°</Text>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={360}
          value={angle}
          onValueChange={setAngle}
          step={1}
        />

        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>Зберегти</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Закрити</Text>
        </TouchableOpacity>

        {pickerVisible && (
          <AdvancedColorPicker
            visible={pickerVisible}
            initialColor={colorToEdit.color}
            onSave={handleColorSave}
            onClose={() => setPickerVisible(false)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#111", padding: 20 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 20 },
  preview: {
    height: 100,
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },
  label: { color: "#fff", marginTop: 10 },
  saveBtn: {
    backgroundColor: "orange",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  saveText: { color: "#000", fontWeight: "700" },
  cancel: {
    color: "orange",
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
  colorButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

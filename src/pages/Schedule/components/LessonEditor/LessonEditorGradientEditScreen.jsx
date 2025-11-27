import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Slider from "@react-native-assets/slider";
import GradientBackground from "../../../../components/GradientBackground";

export default function LessonEditorGradientEditScreen({
  themeColors,
  gradientToEdit,
  onSave,
  openColorPicker,
}) {
  const [color1, setColor1] = useState("#ffffff");
  const [color2, setColor2] = useState("#000000");
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    if (gradientToEdit) {
      setColor1(gradientToEdit.colors?.[0]?.color || "#ffffff");
      setColor2(gradientToEdit.colors?.[1]?.color || "#000000");
      setAngle(gradientToEdit.angle || 0);
    }
  }, [gradientToEdit]);

  const handleSave = () => {
    const newGradient = {
      ...(gradientToEdit || { id: Date.now() }),
      type: "linear",
      angle,
      colors: [
        { color: color1, position: 0 },
        { color: color2, position: 1 },
      ],
    };
    onSave(newGradient);
  };

  return (
    <View style={styles.container}>
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

      <View style={styles.colorsRow}>
        <View style={styles.colorControl}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>Колір 1</Text>
          <TouchableOpacity
            style={[styles.colorBtn, { backgroundColor: color1, borderColor: themeColors.borderColor }]}
            onPress={() => openColorPicker(color1, setColor1)}
          />
        </View>

        <View style={styles.colorControl}>
          <Text style={[styles.label, { color: themeColors.textColor2 }]}>Колір 2</Text>
          <TouchableOpacity
            style={[styles.colorBtn, { backgroundColor: color2, borderColor: themeColors.borderColor }]}
            onPress={() => openColorPicker(color2, setColor2)}
          />
        </View>
      </View>

      <View style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.label, { color: themeColors.textColor }]}>Кут нахилу</Text>
          <Text style={[styles.value, { color: themeColors.accentColor }]}>{Math.round(angle)}°</Text>
        </View>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={360}
          value={angle}
          onValueChange={setAngle}
          step={1}
          minimumTrackTintColor={themeColors.accentColor}
          maximumTrackTintColor={themeColors.backgroundColor2}
          thumbTintColor={themeColors.textColor}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: themeColors.accentColor }]}
        onPress={handleSave}
      >
        <Text style={[styles.saveText, { color: "#fff" }]}>Зберегти градієнт</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  previewContainer: {
    height: 120,
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  preview: { flex: 1 },
  colorsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },
  colorControl: { alignItems: "center" },
  colorBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    marginTop: 8,
  },
  label: { fontSize: 14, fontWeight: "500" },
  sliderContainer: { marginBottom: 30 },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  value: { fontWeight: "bold" },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { fontSize: 16, fontWeight: "bold" },
});
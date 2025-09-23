import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Slider from "@react-native-assets/slider";
import GradientBackground from "../../../../components/GradientBackground";

export default function GradientEditorModal({ visible, gradient, onClose, onSave }) {
  const [color1, setColor1] = useState("#ffffff");
  const [color2, setColor2] = useState("#000000");
  const [angle, setAngle] = useState(0);

  // 🔹 Оновлюємо state коли міняється градієнт
  useEffect(() => {
    if (gradient) {
      setColor1(gradient.colors?.[0]?.color || "#ffffff");
      setColor2(gradient.colors?.[1]?.color || "#000000");
      setAngle(gradient.angle || 0);
    }
  }, [gradient, visible]);

  const handleSave = () => {
    const newGradient = {
      ...gradient, // лишаємо той самий id
      angle,
      colors: [
        { color: normalizeColor(color1), position: 0 },
        { color: normalizeColor(color2), position: 1 },
      ],
    };
    onSave?.(newGradient);
  };

  // 🔹 Перевірка кольору (додає # якщо забули)
  const normalizeColor = (c) => {
    if (!c) return "#000000";
    if (!c.startsWith("#")) return "#" + c;
    return c;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modal}>
        <Text style={styles.title}>Редагування градієнта</Text>

        {/* Превʼю */}
        <View style={styles.preview}>
          <GradientBackground
            gradient={{
              type: "linear",
              angle,
              colors: [
                { color: normalizeColor(color1), position: 0 },
                { color: normalizeColor(color2), position: 1 },
              ],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {/* Поля вводу кольорів */}
        <Text style={styles.label}>Колір 1</Text>
        <TextInput
          style={styles.input}
          value={color1}
          onChangeText={setColor1}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Колір 2</Text>
        <TextInput
          style={styles.input}
          value={color2}
          onChangeText={setColor2}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Слайдер */}
        <Text style={styles.label}>Кут: {Math.round(angle)}°</Text>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={360}
          value={angle}
          onValueChange={setAngle}
          step={1}
        />

        {/* Кнопки */}
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>Зберегти</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Закрити</Text>
        </TouchableOpacity>
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
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
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
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import ColorPicker from "./ColorPicker";
import GradientPicker from "./GradientPicker";

export default function ColorGradientModal({
  visible,
  title,
  selectedColor,
  selectedGradient,
  selectedType = "color",
  onTypeChange,
  onSelect,
  onAddNew,
  onClose,
}) {
  const [useType, setUseType] = useState(selectedType || "color");

  useEffect(() => {
    setUseType(selectedType || "color");
  }, [selectedType, visible]);

  const handleTypeChange = (type) => {
    setUseType(type);
    onTypeChange?.(type);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{title}</Text>

        {/* Три режими: колір / градієнт / картинка */}
        <View style={styles.segmentedControl}>
          {["color", "gradient", "image"].map((type) => {
            const labelMap = {
              color: "Колір",
              gradient: "Градієнт",
              image: "Картинка",
            };
            const isActive = useType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.segment, isActive && styles.activeSegment]}
                onPress={() => handleTypeChange(type)}
              >
                <Text
                  style={[styles.segmentText, isActive && styles.activeText]}
                >
                  {labelMap[type]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {useType === "color" ? (
          <ColorPicker
            selected={selectedColor}
            onSelect={(key) => onSelect?.(key, { kind: "color" })}
          />
        ) : useType === "gradient" ? (
          <GradientPicker
            selected={selectedGradient}
            onSelect={(key) => onSelect?.(key, { kind: "gradient" })}
          />
        ) : (
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#aaa" }}>
              Тут має бути вибір або завантаження картинки
            </Text>
          </View>
        )}

        {onAddNew && useType === "gradient" && (
          <TouchableOpacity onPress={onAddNew} style={styles.addBtn}>
            <Text style={styles.addText}>＋ Додати градієнт</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Закрити</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#111", paddingTop: 50 },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#555",
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  activeSegment: {
    backgroundColor: "orange",
  },
  segmentText: {
    color: "#ccc",
    fontSize: 16,
  },
  activeText: {
    color: "#000",
    fontWeight: "700",
  },
  cancel: {
    color: "orange",
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
  addBtn: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#333",
  },
  addText: { color: "orange", fontSize: 18, fontWeight: "600" },
});

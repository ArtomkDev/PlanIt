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
  onEditGradient, // Новий проп для редагування
  onClose,
  themeColors,
}) {
  const [useType, setUseType] = useState(selectedType || "color");

  const bgColor = themeColors?.backgroundColor2 || "#1E1F22";
  const textColor = themeColors?.textColor || "#fff";
  const borderColor = themeColors?.borderColor || "#333";
  const accentColor = themeColors?.accentColor || "orange";

  useEffect(() => {
    setUseType(selectedType || "color");
  }, [selectedType, visible]);

  const handleTypeChange = (type) => {
    setUseType(type);
    onTypeChange?.(type);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: bgColor }]}>
          <Text style={[styles.modalTitle, { color: textColor }]}>{title}</Text>

          <View style={[styles.segmentedControl, { borderColor }]}>
            {["color", "gradient"].map((type) => {
              const labelMap = { color: "Колір", gradient: "Градієнт" };
              const isActive = useType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.segment, isActive && { backgroundColor: accentColor }]}
                  onPress={() => handleTypeChange(type)}
                >
                  <Text style={[styles.segmentText, { color: isActive ? "#fff" : themeColors?.textColor2 || "#ccc" }]}>
                    {labelMap[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{flex: 1}}>
            {useType === "color" ? (
              <ColorPicker
                selected={selectedColor}
                onSelect={(key) => onSelect?.(key, { kind: "color" })}
              />
            ) : (
              <GradientPicker
                selected={selectedGradient}
                onSelect={(key) => onSelect?.(key, { kind: "gradient" })}
                onEdit={(grad) => onEditGradient?.(grad)} // Передаємо вгору
              />
            )}
          </View>

          {onAddNew && useType === "gradient" && (
            <TouchableOpacity onPress={onAddNew} style={[styles.addBtn, { borderColor }]}>
              <Text style={[styles.addText, { color: accentColor }]}>＋ Додати градієнт</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancel, { color: accentColor }]}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modal: { 
    height: "60%", 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 20 
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 20, textAlign: "center" },
  segmentedControl: { flexDirection: "row", borderRadius: 10, overflow: "hidden", marginBottom: 15, borderWidth: 1, height: 40 },
  segment: { flex: 1, justifyContent: "center", alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center" },
  cancel: { fontSize: 18 },
  addBtn: { padding: 16, alignItems: "center", borderTopWidth: 1 },
  addText: { fontSize: 16, fontWeight: "600" },
});
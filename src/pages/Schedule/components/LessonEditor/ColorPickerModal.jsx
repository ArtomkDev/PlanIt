import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import ColorPicker from "./ColorPicker";

export default function ColorPickerModal({
  visible,
  title,
  selectedColor,
  onSelect,
  onClose,
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{title}</Text>

        <ColorPicker
          selected={selectedColor}
          onSelect={(key) => onSelect?.(key, { kind: "color" })}
        />

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
  cancel: {
    color: "orange",
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from "react-native";
import ColorPicker from "./ColorPicker";

export default function OptionPickerModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  onAddNew,
  onUpdate, // 🔥 нове: функція для оновлення назви
  isColorPicker = false,
  selectedColor,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const startEditing = (opt) => {
    setEditingId(opt.key);
    setEditingValue(opt.label);
  };

  const saveEditing = () => {
    if (onUpdate && editingId) {
      onUpdate(editingId, editingValue);
    }
    setEditingId(null);
    setEditingValue("");
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{title}</Text>

        {isColorPicker ? (
          <ColorPicker selected={selectedColor} onSelect={onSelect} />
        ) : (
          <ScrollView>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.modalItem}
                onPress={() => onSelect(opt.key)}
                onLongPress={() => startEditing(opt)} // 🔥 довгий тап
              >
                {editingId === opt.key ? (
                  <TextInput
                    style={styles.input}
                    value={editingValue}
                    onChangeText={setEditingValue}
                    onSubmitEditing={saveEditing}
                    onBlur={saveEditing}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.modalText}>{opt.label}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {onAddNew && !isColorPicker && (
          <TouchableOpacity onPress={onAddNew} style={styles.addBtn}>
            <Text style={styles.addText}>＋ Додати</Text>
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
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  modalText: { color: "#fff", fontSize: 16 },
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
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 8,
    borderRadius: 6,
    fontSize: 16,
  },
});

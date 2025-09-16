// OptionPickerModal.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  Switch,
} from "react-native";
import ColorPicker from "./ColorPicker";
import GradientPicker from "./GradientPicker";

export default function OptionPickerModal({
  visible,
  title,
  options,
  onSelect,      // (value, meta) => {}
  onClose,
  onAddNew,
  onUpdate,
  isColorPicker = false,   // для статусу
  enableGradient = false,  // для пари (включає тумблер)
  selectedColor,
  selectedGradient,
  selectedType = "color",  // "color" | "linear"
  onTypeChange,            // (type) => {}  <-- ВАЖЛИВО: викликається при перемиканні тумблера
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [useGradient, setUseGradient] = useState(selectedType === "linear");

  // sync initial state when modal opens / selectedType changes
  useEffect(() => {
    setUseGradient(selectedType === "linear");
  }, [selectedType, visible]);

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditingValue("");
      // залишимо useGradient як є — але при повторному відкритті ми синхронізуємо з selectedType
    }
  }, [visible]);

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

  const handleToggle = (val) => {
    setUseGradient(val);
    onTypeChange?.(val ? "linear" : "color"); // важлива частина — повідомляємо батьку
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{title}</Text>

        {/* тумблер тільки для пари */}
        {enableGradient && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              {useGradient ? "Градієнт" : "Колір"}
            </Text>
            <Switch
              value={useGradient}
              onValueChange={handleToggle}
              thumbColor="orange"
            />
          </View>
        )}

        {/* режим простого кольору (статус) */}
        {isColorPicker && !enableGradient ? (
          <ColorPicker
            selected={selectedColor}
            onSelect={(key) => onSelect?.(key, { kind: "color" })}
          />
        ) : enableGradient ? (
          useGradient ? (
            <GradientPicker
              selected={selectedGradient}
              onSelect={(key) => onSelect?.(key, { kind: "gradient" })}
            />
          ) : (
            <ColorPicker
              selected={selectedColor}
              onSelect={(key) => onSelect?.(key, { kind: "color" })}
            />
          )
        ) : (
          <ScrollView>
            {options?.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.modalItem}
                onPress={() => onSelect?.(opt.key)}
                onLongPress={() => startEditing(opt)}
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

        {onAddNew && !isColorPicker && !enableGradient && (
          <TouchableOpacity onPress={onAddNew} style={styles.addBtn}>
            <Text style={styles.addText}>＋ Додати</Text>
          </TouchableOpacity>
        )}

        {enableGradient && (
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  switchLabel: { color: "#fff", fontSize: 16 },
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

import React, { useState, useEffect } from "react";
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
  selectedType = "color",  // "color" | "gradient" | "image"
  onTypeChange,            // (type) => {}  <-- викликається при зміні типу
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [useType, setUseType] = useState(selectedType || "color");

  // sync initial state when modal opens / selectedType changes
  useEffect(() => {
    setUseType(selectedType || "color");
  }, [selectedType, visible]);

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditingValue("");
      // залишимо useType як є, при повторному відкритті синхронізуємо з selectedType
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

  const handleTypeChange = (type) => {
    setUseType(type);
    let typeToSend = type === "gradient" ? "gradient" : type; // заміна linear на gradient тут
    onTypeChange?.(typeToSend);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{title}</Text>

        {/* Замість Switch — тривибірковий контрол */}
        {enableGradient && (
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
                  <Text style={[styles.segmentText, isActive && styles.activeText]}>
                    {labelMap[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Режими */}
        {isColorPicker && !enableGradient ? (
          <ColorPicker
            selected={selectedColor}
            onSelect={(key) => onSelect?.(key, { kind: "color" })}
          />
        ) : enableGradient ? (
          useType === "color" ? (
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
              <Text style={{ color: "#aaa" }}>Тут має бути вибір або завантаження картинки</Text>
              {/* TODO: додайте тут компонент для вибору картинки */}
            </View>
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
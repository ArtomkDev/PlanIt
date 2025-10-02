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

import TeacherEditor from "./TeacherEditor";
import LinkEditor from "./LinkEditor";

export default function OptionListModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  onAddNew,
  onUpdate,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingLinkId, setEditingLinkId] = useState(null);

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditingValue("");
      setEditingTeacherId(null);
      setEditingLinkId(null);
    }
  }, [visible]);

  const startEditing = (opt) => {
    if (title.includes("Викладач")) {
      setEditingTeacherId(opt.key);
    } else if (title.includes("Посилання")) {
      setEditingLinkId(opt.key);
    } else {
      setEditingId(opt.key);
      setEditingValue(opt.label);
    }
  };

  const saveEditing = () => {
    if (onUpdate && editingId) {
      onUpdate(editingId, editingValue);
    }
    setEditingId(null);
    setEditingValue("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          <ScrollView>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.option}
                onPress={() => onSelect(opt.key)}
                onLongPress={() => startEditing(opt)}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {onAddNew && (
            <TouchableOpacity style={styles.addButton} onPress={onAddNew}>
              <Text style={styles.addButtonText}>+ Додати</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Закрити</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline редагування */}
      {editingId && (
        <Modal visible={!!editingId} animationType="slide">
          <View style={styles.editContainer}>
            <TextInput
              style={styles.input}
              value={editingValue}
              onChangeText={setEditingValue}
            />
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setEditingId(null)}>
                <Text style={styles.cancel}>Скасувати</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditing}>
                <Text style={styles.save}>Зберегти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* TeacherEditor */}
      {editingTeacherId && (
        <TeacherEditor
          teacherId={editingTeacherId}
          onClose={() => setEditingTeacherId(null)}
        />
      )}

      {/* LinkEditor */}
      {editingLinkId && (
        <LinkEditor
          linkId={editingLinkId}
          onClose={() => setEditingLinkId(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 20,
    maxHeight: "80%",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  option: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
  },
  addButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "orange",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: { color: "#000", fontWeight: "600" },
  closeButton: { marginTop: 15, alignItems: "center" },
  closeText: { color: "orange", fontSize: 16 },
  editContainer: { flex: 1, backgroundColor: "#111", padding: 20 },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cancel: { color: "orange", fontSize: 18 },
  save: { color: "orange", fontSize: 18, fontWeight: "600" },
});

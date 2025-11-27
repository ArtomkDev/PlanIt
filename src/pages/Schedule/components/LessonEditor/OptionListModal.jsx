import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList, // ⚡️ Замінили ScrollView на FlatList
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

  // ⚡️ Рендер елемента списку винесено окремо для чистоти
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.option}
      onPress={() => onSelect(item.key)}
      onLongPress={() => startEditing(item)}
    >
      <Text style={styles.optionText}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>

          {/* ⚡️ Оптимізований список */}
          <FlatList
            data={options}
            keyExtractor={(item) => item.key.toString()}
            renderItem={renderItem}
            style={styles.list}
            // Додаємо відступ знизу, щоб контент не прилипав до кнопок, якщо список довгий
            contentContainerStyle={{ paddingBottom: 10 }}
          />

          <View style={styles.footerButtons}>
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
      </View>

      {/* Inline редагування */}
      {editingId && (
        <Modal visible={!!editingId} animationType="slide" transparent>
          <View style={styles.overlay}> 
             <View style={[styles.container, { height: 'auto', paddingBottom: 30 }]}>
                <Text style={[styles.title, { marginBottom: 10 }]}>Редагування</Text>
                <TextInput
                  style={styles.input}
                  value={editingValue}
                  onChangeText={setEditingValue}
                  autoFocus
                />
                <View style={styles.editFooter}>
                  <TouchableOpacity onPress={() => setEditingId(null)}>
                    <Text style={styles.cancel}>Скасувати</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveEditing}>
                    <Text style={styles.save}>Зберегти</Text>
                  </TouchableOpacity>
                </View>
             </View>
          </View>
        </Modal>
      )}

      {/* TeacherEditor */}
      {editingTeacherId && (
        <Modal visible={!!editingTeacherId} animationType="slide">
            <TeacherEditor
            teacherId={editingTeacherId}
            onClose={() => setEditingTeacherId(null)}
            />
        </Modal>
      )}

      {/* LinkEditor */}
      {editingLinkId && (
        <Modal visible={!!editingLinkId} animationType="slide">
            <LinkEditor
            linkId={editingLinkId}
            onClose={() => setEditingLinkId(null)}
            />
        </Modal>
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
    // Flex shrinking дозволяє контейнеру зменшуватись, якщо контенту мало,
    // але не рости більше max-height
    flexShrink: 1, 
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
    textAlign: 'center'
  },
  list: {
    flexGrow: 0, // Важливо для FlatList всередині контейнера з max-height
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  optionText: {
    color: "#fff",
    fontSize: 16,
  },
  footerButtons: {
    marginTop: 10,
  },
  addButton: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "orange",
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: { color: "#000", fontWeight: "600" },
  closeButton: { marginTop: 15, alignItems: "center", padding: 10 },
  closeText: { color: "orange", fontSize: 16 },
  
  // Styles for simple inline editor
  input: {
    backgroundColor: "#333",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16
  },
  editFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancel: { color: "orange", fontSize: 16 },
  save: { color: "orange", fontSize: 16, fontWeight: "600" },
});
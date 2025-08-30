import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import useUniqueId from "../../../hooks/useUniqueId";

export default function SubjectSelector({ subjects, onSelect, onClose, onAdd }) {
  const [newName, setNewName] = useState("");
  const generateId = useUniqueId();

  const handleAdd = () => {
    if (!newName.trim()) return;
    const newSubject = {
      id: generateId(),
      name: newName.trim(),
      teacher: null,
      color: "grey",
    };
    onAdd(newSubject);
    setNewName("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Оберіть або створіть предмет</Text>
      <ScrollView style={{ flex: 1 }}>
        {subjects.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.item}
            onPress={() => onSelect(s.id)}
          >
            <Text style={styles.itemText}>{s.name}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.addBlock}>
          <TextInput
            style={styles.input}
            placeholder="Новий предмет"
            placeholderTextColor="#666"
            value={newName}
            onChangeText={setNewName}
          />
          <TouchableOpacity
            style={[styles.addBtn, !newName.trim() && { opacity: 0.4 }]}
            disabled={!newName.trim()}
            onPress={handleAdd}
          >
            <Text style={styles.addText}>Додати</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Text style={styles.closeText}>Закрити</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", paddingTop: 50 },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#333",
  },
  itemText: { color: "#fff", fontSize: 16 },

  addBlock: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 16,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  addBtn: {
    backgroundColor: "orange",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  addText: { color: "#000", fontSize: 16, fontWeight: "600" },

  closeBtn: { padding: 16 },
  closeText: { color: "orange", textAlign: "center", fontSize: 18 },
});

// LessonEditor/LinkEditor.jsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function LinkEditor({ linkId, onClose }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const link = schedule?.links.find((l) => l.id === linkId);

  const [name, setName] = useState(link?.name || "");
  const [url, setUrl] = useState(link?.url || "");

  useEffect(() => {
    if (link) {
      setName(link.name);
      setUrl(link.url);
    }
  }, [linkId]);

  const handleSave = () => {
    setScheduleDraft((prev) => {
      const next = { ...prev };
      next.links = prev.links.map((l) =>
        l.id === linkId ? { ...l, name, url } : l
      );
      return next;
    });
    onClose?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Редагування посилання</Text>

      <TextInput
        style={styles.input}
        placeholder="Назва"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#666"
      />
      <TextInput
        style={styles.input}
        placeholder="URL"
        value={url}
        onChangeText={setUrl}
        placeholderTextColor="#666"
      />

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Скасувати</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.save}>Зберегти</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", padding: 20 },
  title: { color: "#fff", fontSize: 20, marginBottom: 20 },
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
    marginTop: 20,
  },
  cancel: { color: "orange", fontSize: 18 },
  save: { color: "orange", fontSize: 18, fontWeight: "600" },
});

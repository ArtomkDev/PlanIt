// src/pages/Schedule/components/TeacherEditor.jsx
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSchedule } from "../../../../context/ScheduleProvider";

export default function TeacherEditor({ teacherId, onClose }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const teacher = schedule?.teachers?.find((t) => t.id === teacherId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (teacher) {
      setName(teacher.name || "");
      setPhone(teacher.phone || "");
    }
  }, [teacher]);

  const handleSave = () => {
    setScheduleDraft((prev) => {
      const next = { ...prev };
      next.teachers = next.teachers.map((t) =>
        t.id === teacherId ? { ...t, name, phone } : t
      );
      return next;
    });
    onClose?.();
  };

  if (!teacher) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Викладач не знайдений</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Закрити</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Редагування викладача</Text>

      <TextInput
        style={styles.input}
        placeholder="Ім’я"
        placeholderTextColor="#666"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Телефон"
        placeholderTextColor="#666"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
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
  header: { color: "#fff", fontSize: 20, fontWeight: "600", marginBottom: 20 },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancel: { color: "orange", fontSize: 18 },
  save: { color: "orange", fontSize: 18, fontWeight: "600" },
});

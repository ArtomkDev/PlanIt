import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useSchedule } from "../../../../../context/ScheduleProvider";

export default function TeacherEditor({ teacherId, onBack, themeColors }) {
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
    onBack(); // Повертаємось назад після збереження
  };

  if (!teacher) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textColor2 }]}>Ім'я викладача</Text>
      <TextInput
        style={[styles.input, { backgroundColor: themeColors.backgroundColor3, color: themeColors.textColor }]}
        placeholder="Введіть ім'я"
        placeholderTextColor={themeColors.textColor2}
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { color: themeColors.textColor2 }]}>Телефон / Контакт</Text>
      <TextInput
        style={[styles.input, { backgroundColor: themeColors.backgroundColor3, color: themeColors.textColor }]}
        placeholder="Введіть номер"
        placeholderTextColor={themeColors.textColor2}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.backgroundColor3 }]} 
            onPress={onBack}
        >
          <Text style={[styles.buttonText, { color: themeColors.textColor }]}>Скасувати</Text>
        </TouchableOpacity>

        <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.accentColor }]} 
            onPress={handleSave}
        >
          <Text style={[styles.buttonText, { color: "#fff" }]}>Зберегти</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  label: { fontSize: 14, marginBottom: 6, marginLeft: 4 },
  input: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
});
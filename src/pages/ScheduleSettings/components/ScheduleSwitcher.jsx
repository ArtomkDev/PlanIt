// src/pages/ScheduleSettings/components/ScheduleSwitcher.jsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Button, TouchableOpacity } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useSchedule } from "../../../context/ScheduleProvider";
import useUniqueId from "../../../hooks/useUniqueId";
import defaultSchedule from "../../../config/defaultSchedule";
import SettingsScreenLayout from "../SettingsScreenLayout";

const ScheduleSwitcher = () => {
  const { global, setGlobalDraft, schedules, setScheduleDraft, addSchedule } = useSchedule();
  const generateId = useUniqueId();

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!global) return null;

  const handleChange = (newId) => {
    setGlobalDraft((prev) => ({
      ...prev,
      currentScheduleId: newId,
    }));
  };

  const handleCreate = () => {
    if (!newName.trim()) return;

    const id = generateId();
    const newSchedule = {
      ...defaultSchedule,
      id,
      name: newName.trim(),
    };

    // додаємо у список
    addSchedule(newSchedule);

    // переключаємо глобально
    setGlobalDraft((prev) => ({
      ...prev,
      currentScheduleId: id,
    }));

    setNewName("");
    setIsCreating(false);
  };

  const handleRename = (newLabel) => {
    setScheduleDraft((prev) => ({
      ...prev,
      name: newLabel,
    }));
  };

  const currentSchedule = schedules.find((s) => s.id === global.currentScheduleId);

  return (
    <SettingsScreenLayout>
      <View style={styles.container}>
        <Text style={styles.label}>Активний розклад:</Text>

        <Picker
          selectedValue={global.currentScheduleId}
          onValueChange={handleChange}
          style={styles.picker}
        >
          {schedules.map((s) => (
            <Picker.Item key={s.id} label={s.name || s.id} value={s.id} />
          ))}
        </Picker>

        {currentSchedule && (
          <View style={styles.renameBox}>
            <Text style={styles.renameLabel}>Назва:</Text>
            <TextInput
              style={styles.input}
              value={currentSchedule.name}
              onChangeText={handleRename}
            />
          </View>
        )}

        {isCreating ? (
          <View style={styles.newBox}>
            <TextInput
              style={styles.input}
              placeholder="Назва нового розкладу"
              value={newName}
              onChangeText={setNewName}
            />
            <Button title="Створити" onPress={handleCreate} />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsCreating(true)} style={styles.addButton}>
            <Text style={styles.addText}>+ Додати розклад</Text>
          </TouchableOpacity>
        )}
      </View>
    </SettingsScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "600",
  },
  picker: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  renameBox: {
    marginTop: 12,
  },
  renameLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#fff",
  },
  newBox: {
    marginTop: 16,
    gap: 8,
  },
  addButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  addText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default ScheduleSwitcher;

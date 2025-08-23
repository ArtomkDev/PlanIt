import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import SettingsScreenLayout from "../SettingsScreenLayout";

export default function TeachersManager() {
  const { schedule, setScheduleDraft } = useSchedule();
  const teachers = schedule?.teachers || [];
  const [mode, accent] = schedule?.theme || ["light", "blue"];

  // ✅ беремо кольори з getColors()
  const themeColors = themes.getColors(mode, accent);

  const [newTeacher, setNewTeacher] = useState({ name: "", phone: "" });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState(null);

  const handleAddTeacher = () => {
    if (!newTeacher.name.trim()) return;

    setScheduleDraft((prev) => {
      const updated = { ...prev, teachers: prev.teachers || [] };

      if (isEditMode) {
        updated.teachers = updated.teachers.map((t) =>
          t.id === editTeacherId ? { ...t, ...newTeacher } : t
        );
      } else {
        updated.teachers = [
          ...updated.teachers,
          { id: Date.now(), ...newTeacher },
        ];
      }

      return updated;
    });

    setNewTeacher({ name: "", phone: "" });
    setIsEditMode(false);
    setEditTeacherId(null);
  };

  const handleEditTeacher = (teacher) => {
    setNewTeacher({ name: teacher.name, phone: teacher.phone });
    setIsEditMode(true);
    setEditTeacherId(teacher.id);
  };

  const handleRemoveTeacher = (id) => {
    setScheduleDraft((prev) => ({
      ...prev,
      teachers: (prev.teachers || []).filter((t) => t.id !== id),
    }));
  };

  return (
    <SettingsScreenLayout>
      <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
        <Text style={[styles.header, { color: themeColors.textColor }]}>
          Manage Teachers
        </Text>

        <TextInput
          style={[
            styles.input,
            { color: themeColors.textColor, backgroundColor: themeColors.backgroundColor2 },
          ]}
          placeholder="Teacher Name"
          placeholderTextColor={themeColors.textColor2}
          value={newTeacher.name}
          onChangeText={(text) => setNewTeacher({ ...newTeacher, name: text })}
        />

        <TextInput
          style={[
            styles.input,
            { color: themeColors.textColor, backgroundColor: themeColors.backgroundColor2 },
          ]}
          placeholder="Phone"
          placeholderTextColor={themeColors.textColor2}
          value={newTeacher.phone}
          onChangeText={(text) => setNewTeacher({ ...newTeacher, phone: text })}
        />

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: themeColors.accentColor }]}
          onPress={handleAddTeacher}
        >
          <Text style={[styles.addButtonText, { color: themeColors.textColor }]}>
            {isEditMode ? "Save Changes" : "Add Teacher"}
          </Text>
        </TouchableOpacity>

        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View
              style={[styles.teacherItem, { backgroundColor: themeColors.backgroundColor2 }]}
            >
              <Text style={[styles.teacherText, { color: themeColors.textColor }]}>
                {item.name} - {item.phone}
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: themeColors.accentColor }]}
                  onPress={() => handleEditTeacher(item)}
                >
                  <Text style={{ color: themeColors.textColor }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeButton, { backgroundColor: themes.accentColors.red }]}
                  onPress={() => handleRemoveTeacher(item.id)}
                >
                  <Text style={{ color: themeColors.textColor }}>Видалити</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: { padding: 10, marginBottom: 15, borderRadius: 5 },
  addButton: { padding: 10, borderRadius: 5, alignItems: "center", marginBottom: 15 },
  addButtonText: { fontSize: 16 },
  teacherItem: { marginBottom: 10, padding: 10, borderRadius: 5 },
  teacherText: { fontSize: 16, marginBottom: 5 },
  actionButtons: { flexDirection: "row", justifyContent: "space-between" },
  editButton: { padding: 5, borderRadius: 5, marginRight: 10 },
  removeButton: { padding: 5, borderRadius: 5 },
});

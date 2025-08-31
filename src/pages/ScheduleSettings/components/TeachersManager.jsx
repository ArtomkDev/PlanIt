import React, { useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import SettingsScreenLayout from "../SettingsScreenLayout";
import useUniqueId from "../../../hooks/useUniqueId";

export default function TeachersManager() {
  const { global, schedule, setScheduleDraft } = useSchedule();
  const teachers = schedule?.teachers || [];
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const [newTeacher, setNewTeacher] = useState({ name: "", phone: "" });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState(null);

  const generateId = useUniqueId();

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
          { id: generateId(), ...newTeacher },
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
      <View
        style={[
          styles.container,
          { backgroundColor: themeColors.backgroundColor },
        ]}
      >
        <Text style={[styles.header, { color: themeColors.textColor }]}>
          Manage Teachers
        </Text>

        {/* Name */}
        <TextInput
          style={[
            styles.input,
            {
              color: themeColors.textColor,
              backgroundColor: themeColors.backgroundColor2,
            },
          ]}
          placeholder="Teacher Name"
          placeholderTextColor={themeColors.textColor2}
          value={newTeacher.name}
          onChangeText={(text) => setNewTeacher({ ...newTeacher, name: text })}
        />

        {/* Phone */}
        <TextInput
          style={[
            styles.input,
            {
              color: themeColors.textColor,
              backgroundColor: themeColors.backgroundColor2,
            },
          ]}
          placeholder="Phone"
          placeholderTextColor={themeColors.textColor2}
          value={newTeacher.phone}
          onChangeText={(text) => setNewTeacher({ ...newTeacher, phone: text })}
        />

        {/* Add / Save */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: themeColors.accentColor }]}
          onPress={handleAddTeacher}
        >
          <Text
            style={[styles.addButtonText, { color: themeColors.textOnAccent }]}
          >
            {isEditMode ? "💾 Save Changes" : "➕ Add Teacher"}
          </Text>
        </TouchableOpacity>

        {/* Teachers list */}
        <FlatList
          data={teachers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View
              style={[
                styles.teacherCard,
                { backgroundColor: themeColors.backgroundColor2 },
              ]}
            >
              <View>
                <Text
                  style={[
                    styles.teacherName,
                    { color: themeColors.textColor },
                  ]}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.teacherPhone,
                    { color: themeColors.textColor2 },
                  ]}
                >
                  {item.phone}
                </Text>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleEditTeacher(item)}>
                  <Ionicons name="create-outline" size={22} color={themeColors.accentColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveTeacher(item.id)}>
                  <Ionicons name="trash-outline" size={22} color="tomato" />
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
  header: { fontSize: 22, fontWeight: "600", marginBottom: 15 },
  input: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  addButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  addButtonText: { fontSize: 16, fontWeight: "600" },
  teacherCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  teacherName: { fontSize: 16, fontWeight: "500" },
  teacherPhone: { fontSize: 14, marginTop: 2 },
  actionButtons: { flexDirection: "row", gap: 12, alignItems: "center" },
});

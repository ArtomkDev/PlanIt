import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import themes from "../../../config/themes";
import { useSchedule } from "../../../context/ScheduleProvider";
import SettingsScreenLayout from "../SettingsScreenLayout";
import useUniqueId from "../../../hooks/useUniqueId"; // ⬅️ новий хук

export default function SubjectsManager() {
  const { global, schedule, setScheduleDraft, isLoading } = useSchedule();
  const generateId = useUniqueId(); // ⬅️ використовуємо хук

  if (isLoading || !schedule) {
    return <Text style={{ padding: 20 }}>Loading...</Text>;
  }

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const subjects = schedule?.subjects || [];
  const teachers = schedule?.teachers || [];

  const [newSubject, setNewSubject] = useState({
    name: "",
    teacher: "",
    zoom_link: "",
    color: "red",
  });

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSubjectId, setEditSubjectId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const getTeacherName = (teacherId) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher ? teacher.name : "Unknown Teacher";
  };

  const handleColorSelect = (color) => {
    setNewSubject((prev) => ({ ...prev, color }));
  };

  const handleAddOrSave = () => {
    if (!newSubject.teacher) {
      alert("Please select a teacher.");
      return;
    }

    if (isEditMode) {
      setScheduleDraft((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === editSubjectId ? { ...s, ...newSubject } : s
        ),
      }));
      setIsEditMode(false);
      setEditSubjectId(null);
    } else {
      setScheduleDraft((prev) => ({
        ...prev,
        subjects: [...prev.subjects, { ...newSubject, id: generateId() }], // ⬅️ новий ID
      }));
    }

    setNewSubject({ name: "", teacher: "", zoom_link: "", color: "red" });
    setSelectedTeacher("");
  };

  const handleEditSubject = (subject) => {
    setNewSubject({
      name: subject.name,
      teacher: subject.teacher,
      zoom_link: subject.zoom_link,
      color: subject.color || "red",
    });
    setSelectedTeacher(getTeacherName(subject.teacher));
    setIsEditMode(true);
    setEditSubjectId(subject.id);
  };

  const handleRemoveSubject = (id) => {
    setScheduleDraft((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    }));
  };

  const toggleModal = () => setIsModalVisible((v) => !v);

  const handleTeacherSelect = (teacherId) => {
    setNewSubject((prev) => ({ ...prev, teacher: teacherId }));
    setSelectedTeacher(getTeacherName(teacherId));
    toggleModal();
  };

  return (
    <SettingsScreenLayout>
      <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
        <Text style={[styles.header, { color: themeColors.textColor }]}>
          Manage Subjects
        </Text>

        {/* Назва предмету */}
        <TextInput
          style={[styles.input, { color: themeColors.textColor, backgroundColor: themeColors.backgroundColor2 }]}
          placeholder="Subject Name"
          placeholderTextColor={themeColors.textColor2}
          value={newSubject.name}
          onChangeText={(text) => setNewSubject((prev) => ({ ...prev, name: text }))}
        />

        {/* Викладач */}
        <Pressable
          style={[styles.input, {
            flexDirection: "row", justifyContent: "space-between",
            alignItems: "center", backgroundColor: themeColors.backgroundColor2
          }]}
          onPress={toggleModal}
        >
          <Text style={{ color: themeColors.textColor, fontSize: 16 }}>
            {selectedTeacher || "Select Teacher"}
          </Text>
          <Ionicons name="chevron-down" size={20} color={themeColors.textColor} />
        </Pressable>

        {/* Zoom посилання */}
        <TextInput
          style={[styles.input, { color: themeColors.textColor, backgroundColor: themeColors.backgroundColor2 }]}
          placeholder="Zoom Link"
          placeholderTextColor={themeColors.textColor2}
          value={newSubject.zoom_link}
          onChangeText={(text) => setNewSubject((prev) => ({ ...prev, zoom_link: text }))}
        />

        {/* Вибір кольору */}
        <Text style={{ fontSize: 16, fontWeight: "500", marginBottom: 8, color: themeColors.textColor }}>
          Subject Color
        </Text>

        <FlatList
          data={Object.entries(themes.accentColors)}
          keyExtractor={([name]) => name}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 6 }}
          renderItem={({ item }) => {
            const [colorName, colorValue] = item;
            const isSelected = newSubject.color === colorName;

            return (
              <TouchableOpacity
                style={[styles.colorCircle, {
                  backgroundColor: colorValue,
                  borderWidth: isSelected ? 3 : 1,
                  borderColor: isSelected ? themeColors.accentColor : "#ccc",
                }]}
                onPress={() => handleColorSelect(colorName)}
              />
            );
          }}
        />

        {/* Додати/Зберегти */}
        <TouchableOpacity style={[styles.addButton, { backgroundColor: accent }]} onPress={handleAddOrSave}>
          <Text style={[styles.addButtonText, { color: themeColors.textColor }]}>
            {isEditMode ? "💾 Save Changes" : "➕ Add Subject"}
          </Text>
        </TouchableOpacity>

        {/* Модалка вибору викладача */}
        <Modal transparent visible={isModalVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.backgroundColor2 }]}>
              <Text style={[styles.modalHeader, { color: themeColors.textColor }]}>
                Select Teacher
              </Text>
              <FlatList
                data={teachers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.teacherItem, { backgroundColor: themeColors.backgroundColor3 }]}
                    onPress={() => handleTeacherSelect(item.id)}
                  >
                    <Text style={{ color: themeColors.textColor, fontSize: 16 }}>
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
              <TouchableOpacity style={[styles.closeModalButton, { backgroundColor: accent }]} onPress={toggleModal}>
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Список предметів */}
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.subjectCard, { backgroundColor: themeColors.backgroundColor2 }]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={[styles.subjectColor, { backgroundColor: themes.accentColors[item.color] }]} />
                <Text style={[styles.subjectText, { color: themeColors.textColor }]}>
                  {item.name} · {getTeacherName(item.teacher)}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => handleEditSubject(item)}>
                  <Ionicons name="create-outline" size={22} color={accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveSubject(item.id)}>
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
  input: { padding: 12, borderRadius: 10, marginBottom: 12 },
  colorCircle: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  addButton: { padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 20, shadowColor: "#000",
    shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 3 },
  addButtonText: { fontSize: 16, fontWeight: "600" },
  subjectCard: { flexDirection: "row", justifyContent: "space-between", padding: 14, borderRadius: 12,
    marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, elevation: 2 },
  subjectColor: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  subjectText: { fontSize: 16, fontWeight: "500" },
  actionButtons: { flexDirection: "row", gap: 12 },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContent: { width: "80%", borderRadius: 14, padding: 20 },
  modalHeader: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  teacherItem: { padding: 12, borderRadius: 8, marginBottom: 8 },
  closeModalButton: { padding: 12, borderRadius: 10, marginTop: 15, alignItems: "center" },
  closeModalButtonText: { color: "#fff", fontSize: 16, fontWeight: "500" },
});

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import SettingRow from "./SettingRow";
import Group from "./Group";
import LessonTeacherGroup from "./LessonTeacherGroup";
import GradientBackground from "../../../../components/GradientBackground";
import themes from "../../../../config/themes";

export default function LessonEditorMainScreen({
  themeColors,
  selectedSubjectId,
  currentSubject,
  gradients,
  // Actions
  setActivePicker,
  setTeacherIndex,
  handleUpdateSubject,
  onEditStatusColor, // <--- Ми використовуємо це
  onEditSubjectColor, // <--- І це (замість goToScreen)
  getLabel,
}) {
  
  const renderColorPreview = () => {
    if (currentSubject?.typeColor === "gradient" && currentSubject?.colorGradient) {
      const grad = gradients.find((g) => g.id === currentSubject.colorGradient);
      return grad ? <GradientBackground gradient={grad} style={styles.colorPreview} /> : null;
    }
    const color = themes.accentColors[currentSubject?.color] || currentSubject?.color || themes.accentColors.grey;
    return <View style={[styles.colorPreview, { backgroundColor: color }]} />;
  };

  if (!selectedSubjectId) {
    return (
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <Group themeColors={themeColors} title="Предмет">
          <SettingRow
            label="Назва предмету"
            value={getLabel("subject", selectedSubjectId) || "Не обрано"}
            onPress={() => setActivePicker("subject")}
            themeColors={themeColors}
            icon="book-outline"
          />
        </Group>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
      <Group themeColors={themeColors} title="Предмет">
        <SettingRow
          label="Назва предмету"
          value={getLabel("subject", selectedSubjectId) || "Не обрано"}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon="book-outline"
        />
      </Group>

      <LessonTeacherGroup
        teachers={currentSubject.teachers || []}
        themeColors={themeColors}
        onSelect={(idx) => {
          setTeacherIndex(idx);
          setActivePicker("teacher");
        }}
        onChange={(newTeachers) => handleUpdateSubject({ teachers: newTeachers })}
      />

      <Group themeColors={themeColors} title="Деталі">
        <SettingRow
          label="Тип заняття"
          value={getLabel("type", currentSubject.type) || "Не вказано"}
          onPress={() => setActivePicker("type")}
          themeColors={themeColors}
          icon="pricetag-outline"
        />
        <SettingRow
          label="Корпус"
          value={currentSubject.building || "—"}
          onPress={() => setActivePicker("building")}
          themeColors={themeColors}
          icon="business-outline"
        />
        <SettingRow
          label="Аудиторія"
          value={currentSubject.room || "—"}
          onPress={() => setActivePicker("room")}
          themeColors={themeColors}
          icon="location-outline"
        />
      </Group>

      <Group themeColors={themeColors} title="Оформлення">
        <SettingRow
          label="Колір картки"
          rightContent={renderColorPreview()}
          // Виправлено: викликаємо проп, а не goToScreen
          onPress={onEditSubjectColor} 
          themeColors={themeColors}
          icon="color-palette-outline"
        />
      </Group>

      <Group themeColors={themeColors} title="Посилання">
        <SettingRow
          label="Прикріплені посилання"
          value={getLabel("link", currentSubject.links) || "Немає"}
          onPress={() => setActivePicker("link")}
          themeColors={themeColors}
          icon="link-outline"
        />
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  colorPreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
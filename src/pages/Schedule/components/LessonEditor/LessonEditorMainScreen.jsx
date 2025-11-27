import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import SettingRow from "./SettingRow"; // Переконайтеся, що імпорт правильний
import Group from "./Group";
import GradientBackground from "../../../../components/GradientBackground";
import themes from "../../../../config/themes";

export default function LessonEditorMainScreen({
  themeColors,
  selectedSubjectId,
  currentSubject,
  gradients,
  // Actions
  setActivePicker,
  handleUpdateSubject,
  onEditSubjectColor,
  getLabel, // Ця функція приходить з батьківського компонента
}) {
  
  // Захист від крашу, якщо getLabel не передано
  const safeGetLabel = getLabel || ((type, val) => "Не визначено");

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
            value={safeGetLabel("subject", selectedSubjectId) || "Не обрано"}
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
          value={safeGetLabel("subject", selectedSubjectId) || "Не обрано"}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon="book-outline"
        />
      </Group>

      {/* Секція людей (Вчителі) - Множинний вибір */}
      <Group themeColors={themeColors} title="Люди">
        <SettingRow
            label="Викладачі"
            value={safeGetLabel("teacher", currentSubject.teachers)} 
            onPress={() => setActivePicker("teacher")}
            themeColors={themeColors}
            icon="people-outline"
        />
      </Group>

      <Group themeColors={themeColors} title="Деталі">
        <SettingRow
          label="Тип заняття"
          value={safeGetLabel("type", currentSubject.type) || "Не вказано"}
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
          onPress={onEditSubjectColor} 
          themeColors={themeColors}
          icon="color-palette-outline"
        />
      </Group>

      {/* Секція посилань - Множинний вибір */}
      <Group themeColors={themeColors} title="Матеріали">
        <SettingRow
          label="Посилання"
          value={safeGetLabel("link", currentSubject.links)}
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
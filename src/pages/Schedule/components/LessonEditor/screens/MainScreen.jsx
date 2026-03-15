import React from "react";
import { ScrollView, StyleSheet, View, Text } from "react-native";
import SettingRow from "../ui/SettingRow"; 
import Group from "../ui/Group";
import GradientBackground from "../../../../../components/GradientBackground";
import themes from "../../../../../config/themes";
import { getIconComponent } from "../../../../../config/subjectIcons"; 

export default function LessonEditorMainScreen({
  themeColors,
  selectedSubjectId,
  currentSubject,
  gradients,
  setActivePicker,
  onEditSubjectColor,
  getLabel,
  scopes,
  onScopeChange,
  getValueLabel,
  getArrayData
}) {
  const safeGetLabel = getLabel || ((type, val) => "Не визначено");

  const renderIconValue = () => {
    if (!currentSubject.icon) {
      return <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>Немає</Text>;
    }
    const IconCmp = getIconComponent(currentSubject.icon);
    return IconCmp ? (
      <IconCmp size={20} color={themeColors.textColor2} />
    ) : (
      <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>Немає</Text>
    );
  };

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
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Group themeColors={themeColors} title="Предмет" showScopeToggle={false}>
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

  const { array: teachersArr } = getArrayData("teachers", "people");
  const { array: linksArr } = getArrayData("links", "materials");

  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
      
      <Group themeColors={themeColors} title="Предмет" showScopeToggle={false}>
        <SettingRow
          label="Назва предмету"
          value={safeGetLabel("subject", selectedSubjectId) || "Не обрано"}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon="book-outline"
        />
      </Group>

      <Group 
        themeColors={themeColors} 
        title="Тип заняття"
        showScopeToggle={true}
        scope={scopes.type}
        onScopeChange={(newScope) => onScopeChange('type', newScope)}
      >
        <SettingRow
          label="Тип заняття"
          value={getValueLabel("type", "type", "type")}
          onPress={() => setActivePicker("type")}
          themeColors={themeColors}
          icon="pricetag-outline"
        />
      </Group>

      <Group 
        themeColors={themeColors} 
        title="Місце проведення"
        showScopeToggle={true}
        scope={scopes.location}
        onScopeChange={(newScope) => onScopeChange('location', newScope)}
      >
        <SettingRow
          label="Корпус"
          value={getValueLabel("building", "text", "location")}
          onPress={() => setActivePicker("building")}
          themeColors={themeColors}
          icon="business-outline"
        />
        <SettingRow
          label="Аудиторія"
          value={getValueLabel("room", "text", "location")}
          onPress={() => setActivePicker("room")}
          themeColors={themeColors}
          icon="location-outline"
        />
      </Group>

      <Group 
        themeColors={themeColors} 
        title="Люди"
        showScopeToggle={true}
        scope={scopes.people}
        onScopeChange={(newScope) => onScopeChange('people', newScope)}
        onAdd={() => setActivePicker('teacher', teachersArr.length)}
      >
        {teachersArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   Немає викладачів. Натисніть + щоб додати
               </Text>
           </View>
        ) : (
            teachersArr.map((id, index) => (
                <SettingRow
                    key={`teacher-${id}`}
                    label={`Викладач ${index + 1}`}
                    value={safeGetLabel("teacher", id)}
                    onPress={() => setActivePicker("teacher", index)}
                    themeColors={themeColors}
                    icon="person-outline"
                />
            ))
        )}
      </Group>

      <Group 
        themeColors={themeColors} 
        title="Матеріали"
        showScopeToggle={true}
        scope={scopes.materials}
        onScopeChange={(newScope) => onScopeChange('materials', newScope)}
        onAdd={() => setActivePicker('link', linksArr.length)}
      >
        {linksArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   Немає посилань. Натисніть + щоб додати
               </Text>
           </View>
        ) : (
            linksArr.map((id, index) => (
                <SettingRow
                    key={`link-${id}`}
                    label={`Посилання ${index + 1}`}
                    value={safeGetLabel("link", id)}
                    onPress={() => setActivePicker("link", index)}
                    themeColors={themeColors}
                    icon="link-outline"
                />
            ))
        )}
      </Group>

      <Group themeColors={themeColors} title="Оформлення" showScopeToggle={false}>
        <SettingRow
          label="Колір картки"
          rightContent={renderColorPreview()}
          onPress={onEditSubjectColor} 
          themeColors={themeColors}
          icon="color-palette-outline"
        />
        <SettingRow
          label="Іконка предмету"
          rightContent={renderIconValue()}
          onPress={() => setActivePicker("icon")}
          themeColors={themeColors}
          icon="image-outline"
        />
      </Group>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  scrollContent: { paddingBottom: 40 },
  colorPreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  emptyContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
  }
});
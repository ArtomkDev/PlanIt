// LessonEditor.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";

import SettingRow from "./LessonEditor/SettingRow";
import LessonTeacherGroup from "./LessonEditor/LessonTeacherGroup";
import Group from "./LessonEditor/Group";
import LessonStatusGroup from "./LessonEditor/LessonStatusGroup";

import useEntityManager from "../../../hooks/useEntityManager";

// модальні
import OptionListModal from "./LessonEditor/OptionListModal";
import ColorPickerModal from "./LessonEditor/ColorPickerModal";
import ColorGradientModal from "./LessonEditor/ColorGradientModal";

import themes from "../../../config/themes";
import GradientBackground from "../../../components/GradientBackground";

export default function LessonEditor({ lesson, onClose }) {
  const { schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const { addTeacher, addSubject, addLink, addStatus, addGradient } =
    useEntityManager();

  // Use the draft schedule if it exists, otherwise fall back to the main schedule.
  // This makes the component reactive to changes made in the editor.
  const dataSource = scheduleDraft || schedule;

  const subjects = dataSource?.subjects ?? [];
  const teachers = dataSource?.teachers ?? [];
  const links = dataSource?.links ?? [];
  const statuses = dataSource?.statuses ?? [];
  const gradients = dataSource?.gradients ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(
    lesson?.subjectId || null
  );
  const [activePicker, setActivePicker] = useState(null);
  const [teacherIndex, setTeacherIndex] = useState(null);

  const [editingColor, setEditingColor] = useState(null); // {type: "subject"|"status", id}

  const currentSubject =
    subjects.find((s) => s.id === selectedSubjectId) || {};

  const handleSave = () => {
    if (!selectedSubjectId) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      // додаємо в розклад
      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;

      if (!Array.isArray(next.schedule)) {
        next.schedule = new Array(7).fill(null).map(() => ({}));
      }
      if (!next.schedule[dayIndex]) next.schedule[dayIndex] = {};
      if (!Array.isArray(next.schedule[dayIndex][weekKey])) {
        next.schedule[dayIndex][weekKey] = [];
      }

      const weekArr = [...next.schedule[dayIndex][weekKey]];
      if (Number.isInteger(lesson?.index)) {
        while (weekArr.length <= lesson.index) weekArr.push(null);
        weekArr[lesson.index] = selectedSubjectId;
      } else {
        weekArr.push(selectedSubjectId);
      }
      next.schedule[dayIndex][weekKey] = weekArr;

      return next;
    });

    onClose();
  };

  const options = {
    subject: subjects.map((s) => ({ key: s.id, label: s.name })),
    teacher: teachers.map((t) => ({ key: t.id, label: t.name })),
    link: links.map((l) => ({ key: l.id, label: l.name })),
    type: [
      { key: "Лекція", label: "Лекція" },
      { key: "Практика", label: "Практика" },
      { key: "Лабораторна", label: "Лабораторна" },
    ],
    status: statuses.map((st) => ({ key: st.id, label: st.name })),
  };

  const getLabel = (picker, value) => {
    if (picker === "subject")
      return subjects.find((s) => s.id === value)?.name;
    if (picker === "teacher")
      return teachers.find((t) => t.id === value)?.name;
    if (picker === "status")
      return statuses.find((s) => s.id === value)?.name;
    if (picker === "link") {
      return (value || [])
        .map((id) => links.find((l) => l.id === id)?.name)
        .filter(Boolean)
        .join(", ");
    }
    const opt = options[picker]?.find((o) => o.key === value);
    return opt?.label;
  };

  const handleSelect = (picker, key) => {
    if (!selectedSubjectId && picker !== "subject") return;

    setScheduleDraft((prev) => {
      if (!prev) return prev;

      let next = {
        ...prev,
        subjects: [...(prev.subjects || [])],
      };

      if (picker === "subject") {
        setSelectedSubjectId(key);
        return next;
      }

      const subjIndex = next.subjects.findIndex(
        (s) => s.id === selectedSubjectId
      );
      if (subjIndex === -1) return next;

      const subj = { ...next.subjects[subjIndex] };

      if (picker === "teacher") {
        const newTeachers = [...(subj.teachers || [])];
        if (teacherIndex !== null) {
          newTeachers[teacherIndex] = key;
        }
        subj.teachers = newTeachers;
        setTeacherIndex(null);
      }

      if (picker === "link") {
        const current = subj.links || [];
        subj.links = current.includes(key)
          ? current.filter((id) => id !== key)
          : [...current, key];
      }

      if (picker === "status") {
        subj.status = key;
      }

      if (picker === "type" || picker === "building" || picker === "room") {
        subj[picker] = key;
      }

      next.subjects[subjIndex] = subj;
      return next;
    });

    setActivePicker(null);
  };

  const handleColorSelect = (value, meta) => {
    if (!editingColor) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      if (editingColor.type === "subject") {
        const subjIndex = next.subjects.findIndex((s) => s.id === editingColor.id);
        if (subjIndex !== -1) {
          const subj = { ...next.subjects[subjIndex] };
          if (meta?.kind === "gradient") {
            subj.colorGradient = value;
            subj.typeColor = "gradient";
          } else {
            subj.color = value;
            subj.typeColor = "color";
          }
          next.subjects[subjIndex] = subj;
        }
      }

      if (editingColor.type === "status") {
        const stIndex = next.statuses.findIndex((s) => s.id === editingColor.id);
        if (stIndex !== -1) {
          const st = { ...next.statuses[stIndex] };
          st.color = value;
          next.statuses[stIndex] = st;
        }
      }

      return next;
    });

    setActivePicker(null);
    setEditingColor(null);
  };

  const handleColorTypeChange = (type) => {
    if (!editingColor) return;
    setScheduleDraft((prev) => {
      const next = { ...prev };
      if (editingColor.type === "subject") {
        const subj = next.subjects.find((s) => s.id === editingColor.id);
        if (subj) subj.typeColor = type;
      }
      if (editingColor.type === "status") {
        const st = next.statuses.find((s) => s.id === editingColor.id);
        if (st) st.typeColor = type;
      }
      return next;
    });
  };

  // 🔹 підготовка прев’ю кольору/градієнта
  let colorPreview = null;
  if (currentSubject?.typeColor === "gradient" && currentSubject?.colorGradient) {
    const grad = gradients.find((g) => g.id === currentSubject.colorGradient);
    if (grad) {
      colorPreview = (
        <GradientBackground
          gradient={grad}
          style={styles.colorPreview}
        />
      );
    }
  } else if (currentSubject?.color) {
    const subjectColor =
      themes.accentColors[currentSubject?.color] ||
      currentSubject?.color ||
      themes.accentColors.grey;
    colorPreview = (
      <View
        style={[
          styles.colorPreview,
          { backgroundColor: subjectColor },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {Number.isInteger(lesson?.index) ? "Заняття" : "Нове заняття"}
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Group title="Пара">
          <SettingRow
            label={`Предмет: ${getLabel("subject", selectedSubjectId) || "—"}`}
            onPress={() => setActivePicker("subject")}
          />
        </Group>

        <LessonTeacherGroup
          teachers={currentSubject.teachers || []}
          onSelect={(picker, index) => {
            if (picker === "teacher") {
              setTeacherIndex(index);
              setActivePicker("teacher");
            }
          }}
          onChange={(newTeachers) =>
            setScheduleDraft((prev) => {
              const next = { ...prev };
              const subj = next.subjects.find(
                (s) => s.id === selectedSubjectId
              );
              if (subj) subj.teachers = newTeachers;
              return next;
            })
          }
        />

        <Group title="Налаштування">
          <SettingRow
            label={`Тип заняття: ${
              getLabel("type", currentSubject.type) || "—"
            }`}
            onPress={() => setActivePicker("type")}
          />
          <SettingRow
            label={`Корпус: ${currentSubject.building || "—"}`}
            onPress={() => setActivePicker("building")}
          />
          <SettingRow
            label={`Аудиторія: ${currentSubject.room || "—"}`}
            onPress={() => setActivePicker("room")}
          />
        </Group>

        <LessonStatusGroup
          status={getLabel("status", currentSubject.status)}
          color={
            statuses.find((s) => s.id === currentSubject.status)?.color || "#666"
          }
          onSelect={(picker) => {
            if (picker === "statusColor") {
              setEditingColor({ type: "status", id: currentSubject.status });
              setActivePicker("color");
            } else {
              setActivePicker(picker);
            }
          }}
        />

        <Group title="Персоналізація">
          <SettingRow
            label="Колір пари"
            valueComponent={colorPreview}
            onPress={() => {
              if (!selectedSubjectId) return;
              setEditingColor({ type: "subject", id: selectedSubjectId });
              setActivePicker("color");
            }}
          />
        </Group>

        <Group title="Додатково">
          <SettingRow
            label={`Посилання: ${
              getLabel("link", currentSubject.links) || "—"
            }`}
            onPress={() => setActivePicker("link")}
          />
        </Group>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.cancel}>Скасувати</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!selectedSubjectId} onPress={handleSave}>
          <Text style={[styles.save, !selectedSubjectId && styles.disabled]}>
            Готово
          </Text>
        </TouchableOpacity>
      </View>

      {/* списковий модал */}
      <OptionListModal
        visible={!!activePicker && !!options[activePicker]}
        title={`Оберіть ${activePicker}`}
        options={options[activePicker] || []}
        onSelect={(key) => handleSelect(activePicker, key)}
        onClose={() => setActivePicker(null)}
        onAddNew={
          activePicker === "teacher"
            ? addTeacher
            : activePicker === "subject"
            ? addSubject
            : activePicker === "link"
            ? addLink
            : activePicker === "status"
            ? addStatus
            : undefined
        }
      />

      {/* модал для кольору статусу */}
      {editingColor?.type === "status" && (
        <ColorPickerModal
          visible={activePicker === "color"}
          title="Оберіть колір статусу"
          selectedColor={
            statuses.find((s) => s.id === editingColor.id)?.color || "#666"
          }
          onSelect={handleColorSelect}
          onClose={() => {
            setActivePicker(null);
            setEditingColor(null);
          }}
        />
      )}

      {/* модал для кольору/градієнта предмету */}
      {editingColor?.type === "subject" && (
        <ColorGradientModal
          visible={activePicker === "color"}
          title="Оберіть колір пари"
          selectedColor={currentSubject.color}
          selectedGradient={currentSubject.colorGradient}
          selectedType={currentSubject.typeColor || "color"}
          onSelect={handleColorSelect}
          onTypeChange={handleColorTypeChange}
          onAddNew={addGradient}
          onClose={() => {
            setActivePicker(null);
            setEditingColor(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111", paddingTop: 50 },
  header: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  cancel: { color: "orange", fontSize: 18 },
  save: { color: "orange", fontSize: 18, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  scroll: { paddingBottom: 20 },
  colorPreview: {
    width: 40,
    height: 20,
    borderRadius: 6,
  },
});

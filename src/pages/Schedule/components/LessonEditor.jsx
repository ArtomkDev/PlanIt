// LessonEditor.js
import React, { useState, useEffect } from "react";
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

// ✅ нові модальні вікна
import OptionListModal from "./LessonEditor/OptionListModal";
import ColorPickerModal from "./LessonEditor/ColorPickerModal";
import ColorGradientModal from "./LessonEditor/ColorGradientModal";

export default function LessonEditor({ lesson, onClose }) {
  const { schedule, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const { addTeacher, addSubject, addLink, addStatus, addGradient } = useEntityManager();

  const subjects = schedule?.subjects ?? [];
  const teachers = schedule?.teachers ?? [];
  const links = schedule?.links ?? [];
  const statuses = schedule?.statuses ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [subjectData, setSubjectData] = useState({});
  const [statusEdits, setStatusEdits] = useState({});
  const [activePicker, setActivePicker] = useState(null);

  // 🔥 універсальний редактор кольорів
  const [editingColor, setEditingColor] = useState(null);

  useEffect(() => {
    if (lesson?.subjectId) {
      setSelectedSubjectId(lesson.subjectId);
      const subj = subjects.find((s) => s.id === lesson.subjectId);
      setSubjectData(subj || {});
    } else {
      setSelectedSubjectId(null);
      setSubjectData({});
    }
  }, [lesson, subjects]);

  const handleSave = () => {
    if (!selectedSubjectId) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      // оновлюємо предмет
      const prevSubjects = Array.isArray(next.subjects) ? next.subjects : [];
      next.subjects = prevSubjects.map((s) =>
        s.id === selectedSubjectId ? { ...s, ...subjectData } : s
      );

      // оновлюємо статуси
      if (Object.keys(statusEdits).length > 0) {
        const prevStatuses = Array.isArray(next.statuses) ? next.statuses : [];
        next.statuses = prevStatuses.map((st) =>
          statusEdits[st.id] ? { ...st, ...statusEdits[st.id] } : st
        );
      }

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
    if (picker === "subject") return subjects.find((s) => s.id === value)?.name;
    if (picker === "teacher") return teachers.find((t) => t.id === value)?.name;
    if (picker === "status") return statuses.find((s) => s.id === value)?.name;
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
    if (picker === "subject") {
      setSelectedSubjectId(key);
      const subj = subjects.find((s) => s.id === key);
      setSubjectData(subj || {});
    } else if (picker === "link") {
      setSubjectData((prev) => {
        const current = prev.links || [];
        return {
          ...prev,
          links: current.includes(key)
            ? current.filter((id) => id !== key)
            : [...current, key],
        };
      });
    } else {
      setSubjectData((prev) => ({ ...prev, [picker]: key }));
    }
    setActivePicker(null);
  };

  const handleColorSelect = (value, meta) => {
    if (!editingColor) return;

    if (editingColor.type === "subject") {
      setSubjectData((prev) => ({
        ...prev,
        ...(meta?.kind === "gradient"
          ? { colorGradient: value, typeColor: "gradient" }
          : { color: value, typeColor: "color" }),
      }));
    }

    if (editingColor.type === "status") {
      setStatusEdits((prev) => ({
        ...prev,
        [editingColor.id]: {
          ...(prev[editingColor.id] || {}),
          color: value,
        },
      }));
    }

    setActivePicker(null);
    setEditingColor(null);
  };

  const handleColorTypeChange = (type) => {
    if (!editingColor) return;

    if (editingColor.type === "subject") {
      setSubjectData((prev) => ({ ...prev, typeColor: type }));
    }

    if (editingColor.type === "status") {
      setStatusEdits((prev) => ({
        ...prev,
        [editingColor.id]: {
          ...(prev[editingColor.id] || {}),
          typeColor: type,
        },
      }));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {Number.isInteger(lesson?.index) ? "Заняття" : "Нове заняття"}
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Group title="Пара">
          <SettingRow
            label="Предмет"
            value={getLabel("subject", selectedSubjectId)}
            onPress={() => setActivePicker("subject")}
          />
        </Group>

        <LessonTeacherGroup
          teacher={getLabel("teacher", subjectData.teacher)}
          phone={teachers.find((t) => t.id === subjectData.teacher)?.phone || ""}
          onSelect={setActivePicker}
        />

        <Group title="Налаштування">
          <SettingRow
            label="Тип заняття"
            value={getLabel("type", subjectData.type)}
            onPress={() => setActivePicker("type")}
          />
          <SettingRow
            label="Корпус"
            value={subjectData.building}
            onPress={() => setActivePicker("building")}
          />
          <SettingRow
            label="Аудиторія"
            value={subjectData.room}
            onPress={() => setActivePicker("room")}
          />
        </Group>

        <LessonStatusGroup
          status={getLabel("status", subjectData.status)}
          color={
            statusEdits[subjectData.status]?.color ||
            statuses.find((s) => s.id === subjectData.status)?.color
          }
          onSelect={(picker) => {
            if (picker === "statusColor") {
              setEditingColor({ type: "status", id: subjectData.status });
              setActivePicker("color");
            } else {
              setActivePicker(picker);
            }
          }}
        />

        <Group title="Персоналізація">
          <SettingRow
            label="Колір пари"
            value={
              subjectData?.typeColor === "gradient"
                ? `Градієнт #${subjectData?.colorGradient}`
                : subjectData?.color
            }
            onPress={() => {
              if (!selectedSubjectId) return;
              setEditingColor({ type: "subject", id: selectedSubjectId });
              setActivePicker("color");
            }}
          />
        </Group>

        <Group title="Додатково">
          <SettingRow
            label="Посилання"
            value={getLabel("link", subjectData.links)}
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

      {/* ✅ списковий модал */}
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
        onUpdate={(id, newName) => {
          if (activePicker === "teacher") {
            setSubjectData((prev) =>
              prev.teacher === id ? { ...prev, teacherName: newName } : prev
            );
          }
          if (activePicker === "subject") {
            if (selectedSubjectId === id) {
              setSubjectData((prev) => ({ ...prev, name: newName }));
            }
          }
          if (activePicker === "status") {
            setStatusEdits((prev) => ({
              ...prev,
              [id]: { ...(prev[id] || {}), name: newName },
            }));
          }
          if (activePicker === "link") {
            setSubjectData((prev) => ({
              ...prev,
              links: (prev.links || []).map((l) => (l === id ? newName : l)),
            }));
          }
        }}
      />

      {/* ✅ модал для кольору */}
      {editingColor?.type === "status" && (
        <ColorPickerModal
          visible={activePicker === "color"}
          title="Оберіть колір статусу"
          selectedColor={
            statusEdits[editingColor.id]?.color ||
            statuses.find((s) => s.id === editingColor.id)?.color
          }
          onSelect={handleColorSelect}
          onClose={() => {
            setActivePicker(null);
            setEditingColor(null);
          }}
        />
      )}

      {/* ✅ модал для кольору/градієнта */}
      {editingColor?.type === "subject" && (
        <ColorGradientModal
          visible={activePicker === "color"}
          title="Оберіть колір пари"
          selectedColor={subjectData.color}
          selectedGradient={subjectData.colorGradient}
          selectedType={subjectData.typeColor || "color"}
          onSelect={handleColorSelect}
          onTypeChange={handleColorTypeChange}
          onAddNew={addGradient} // ← додаємо сюди
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
});

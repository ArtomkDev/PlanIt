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
import OptionPickerModal from "./LessonEditor/OptionPickerModal";
import LessonTeacherGroup from "./LessonEditor/LessonTeacherGroup";
import Group from "./LessonEditor/Group";
import LessonStatusGroup from "./LessonEditor/LessonStatusGroup";

export default function LessonEditor({ lesson, onClose }) {
  const {
    schedule,
    setScheduleDraft,
    addTeacher,
    addSubject,
    addLink,
    addStatus,
  } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const subjects = schedule?.subjects ?? [];
  const teachers = schedule?.teachers ?? [];
  const links = schedule?.links ?? [];
  const statuses = schedule?.statuses ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [subjectData, setSubjectData] = useState({});
  const [activePicker, setActivePicker] = useState(null);

  // 🔥 універсальний редактор кольорів
  const [editingColor, setEditingColor] = useState(null);
  // формат: { type: "status" | "subject", id: number }

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

      // захищені перевірки
      const prevSubjects = Array.isArray(next.subjects) ? next.subjects : [];
      next.subjects = prevSubjects.map((s) =>
        s.id === selectedSubjectId ? { ...s, ...subjectData } : s
      );

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
        // ensure length
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
    if (picker === "statuses") return statuses.find((s) => s.id === value)?.name;
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

  // ---- Обробка вибору кольору / градієнта ----
  const handleColorSelect = (value, meta) => {
    if (!editingColor) return;

    setScheduleDraft((prev) => {
      const next = { ...prev };

      if (editingColor.type === "subject") {
        const prevSubjects = Array.isArray(next.subjects) ? next.subjects : [];
        next.subjects = prevSubjects.map((s) => {
          if (s.id !== editingColor.id) return s;
          if (meta?.kind === "gradient") {
            return { ...s, colorGradient: value, typeColor: "gradient" };
          } else {
            return { ...s, color: value, typeColor: "color" };
          }
        });
      }

      if (editingColor.type === "status") {
        const prevStatuses = Array.isArray(next.statuses) ? next.statuses : [];
        next.statuses = prevStatuses.map((st) =>
          st.id === editingColor.id ? { ...st, color: value } : st
        );
      }

      return next;
    });

    // оновлюємо локальний preview
    if (editingColor.type === "subject" && selectedSubjectId === editingColor.id) {
      setSubjectData((prev) => ({
        ...prev,
        ...(meta?.kind === "gradient"
          ? { colorGradient: value, typeColor: "gradient" }
          : { color: value, typeColor: "color" }),
      }));
    }

    setActivePicker(null);
    setEditingColor(null);
  };


  // ---- Обробка зміни типу фарбування (тумблер) ----
  const handleColorTypeChange = (type) => {
    // type = "linear" | "color"
    if (!editingColor) return;
    setScheduleDraft((prev) => {
      const next = { ...prev }; 
      const prevSubjects = Array.isArray(next.subjects) ? next.subjects : [];
      next.subjects = prevSubjects.map((s) =>
        s.id === editingColor.id ? { ...s, typeColor: type } : s
      );
      return next;
    });

    if (selectedSubjectId === editingColor.id) {
      setSubjectData((prev) => ({ ...prev, typeColor: type }));
    }
    // залишаємо модал відкритим — користувач вирішує чи змінювати значення
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
          color={statuses.find((s) => s.id === subjectData.status)?.color}
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

      {/* універсальний модал */}
      <OptionPickerModal
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
          setScheduleDraft((prev) => {
            const next = { ...prev };
            if (activePicker === "teacher") {
              next.teachers = (next.teachers || []).map((t) =>
                t.id === id ? { ...t, name: newName } : t
              );
            } else if (activePicker === "subject") {
              next.subjects = (next.subjects || []).map((s) =>
                s.id === id ? { ...s, name: newName } : s
              );
            } else if (activePicker === "link") {
              next.links = (next.links || []).map((l) =>
                l.id === id ? { ...l, name: newName } : l
              );
            } else if (activePicker === "status") {
              next.statuses = (next.statuses || []).map((st) =>
                st.id === id ? { ...st, name: newName } : st
              );
            }
            return next;
          });
        }}
      />

      {/* редактор кольорів */}
      <OptionPickerModal
        visible={activePicker === "color"}
        title={
          editingColor?.type === "status"
            ? "Оберіть колір статусу"
            : "Оберіть колір пари"
        }
        isColorPicker={editingColor?.type === "status"} // статус -> простий пікер
        enableGradient={editingColor?.type === "subject"} // предмет -> має тумблер
        selectedColor={
          editingColor
            ? editingColor.type === "status"
              ? statuses.find((s) => s.id === editingColor.id)?.color
              : subjects.find((s) => s.id === editingColor.id)?.color
            : undefined
        }
        selectedGradient={
          editingColor
            ? subjects.find((s) => s.id === editingColor.id)?.colorGradient
            : undefined
        }
        selectedType={
          editingColor
            ? editingColor.type === "status"
              ? "color"
              : subjects.find((s) => s.id === editingColor.id)?.typeColor || "color"
            : "color"
        }
        onSelect={handleColorSelect}
        onTypeChange={handleColorTypeChange}
        onClose={() => {
          setActivePicker(null);
          setEditingColor(null);
        }}
      />
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
  groupTitle: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 5,
    paddingHorizontal: 20,
    textTransform: "uppercase",
  },
});

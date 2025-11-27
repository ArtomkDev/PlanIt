import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  PanResponder,
  Dimensions,
  LayoutAnimation,
  Modal // Імпортуємо Modal для Advanced Picker
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import useEntityManager from "../../../hooks/useEntityManager";
import themes from "../../../config/themes";

// ЕКРАНИ (Внутрішня навігація шторки)
import LessonEditorMainScreen from "./LessonEditor/LessonEditorMainScreen";
import LessonEditorSubjectColorScreen from "./LessonEditor/LessonEditorSubjectColorScreen";
import LessonEditorGradientEditScreen from "./LessonEditor/LessonEditorGradientEditScreen";

// МОДАЛКИ
import OptionListModal from "./LessonEditor/OptionListModal";
import AdvancedColorPicker from "../../../components/AdvancedColorPicker"; // Це та сама окрема модалка

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function LessonEditor({ lesson, onClose }) {
  const { global, schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();
  const { addTeacher, addSubject, addLink, addStatus, addGradient } = useEntityManager();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const dataSource = scheduleDraft || schedule;
  const subjects = dataSource?.subjects ?? [];
  const teachers = dataSource?.teachers ?? [];
  const links = dataSource?.links ?? [];
  const statuses = dataSource?.statuses ?? [];
  const gradients = dataSource?.gradients ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(lesson?.subjectId || null);
  const [activePicker, setActivePicker] = useState(null);
  const [teacherIndex, setTeacherIndex] = useState(null);
  
  // --- НАВІГАЦІЯ ---
  // main -> subjectColor -> gradientEdit -> (AdvancedPicker Modal)
  const [currentScreen, setCurrentScreen] = useState("main");
  
  // Дані для редагування
  const [editingGradient, setEditingGradient] = useState(null);
  
  // --- ОКРЕМА МОДАЛКА ДЛЯ ADVANCED PICKER ---
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [advancedPickerTarget, setAdvancedPickerTarget] = useState(null); // { color, setter }

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || {};

  // --- АНІМАЦІЯ ШТОРКИ ---
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(panY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 100,
      mass: 0.8,
    }).start();
  }, []);

  const closeWithAnimation = () => {
    Keyboard.dismiss();
    Animated.timing(panY, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.8) {
          closeWithAnimation();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  // --- ЛОГІКА ДАНИХ ---
  const handleSave = () => {
    if (!selectedSubjectId) return;
    setScheduleDraft((prev) => {
      const next = { ...prev };
      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;
      if (!next.schedule) next.schedule = Array(7).fill(null).map(() => ({}));
      if (!next.schedule[dayIndex]) next.schedule[dayIndex] = {};
      if (!next.schedule[dayIndex][weekKey]) next.schedule[dayIndex][weekKey] = [];
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
    closeWithAnimation();
  };

  const handleUpdateSubject = (updates) => {
    if (!selectedSubjectId) return;
    setScheduleDraft((prev) => {
      const next = { ...prev };
      const subjIndex = next.subjects.findIndex((s) => s.id === selectedSubjectId);
      if (subjIndex !== -1) {
        next.subjects[subjIndex] = { ...next.subjects[subjIndex], ...updates };
      }
      return next;
    });
  };

  const handleUpdateStatus = (colorValue) => {
    if (!currentSubject.status) return;
    setScheduleDraft((prev) => {
      const next = { ...prev };
      const statusIndex = next.statuses.findIndex((s) => s.id === currentSubject.status);
      if (statusIndex !== -1) {
        next.statuses[statusIndex] = { ...next.statuses[statusIndex], color: colorValue };
      }
      return next;
    });
  };

  const handleSaveGradient = (newGradient) => {
    setScheduleDraft((prev) => {
      const next = { ...prev };
      const grads = [...(next.gradients || [])];
      const idx = grads.findIndex((g) => g.id === newGradient.id);
      if (idx !== -1) grads[idx] = newGradient;
      else grads.push(newGradient);
      next.gradients = grads;
      return next;
    });
    // Повертаємося на вибір кольору
    goToScreen("subjectColor");
  };

  // --- НАВІГАЦІЯ В ШТОРЦІ ---
  const goToScreen = (screenName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCurrentScreen(screenName);
  };

  const handleBack = () => {
    if (currentScreen === "gradientEdit") {
        goToScreen("subjectColor");
    } else if (currentScreen !== "main") {
        goToScreen("main");
    }
  };

  // --- UI HELPERS ---
  const getLabel = (type, value) => {
    if (!value) return null;
    if (type === "subject") return subjects.find((s) => s.id === value)?.name;
    if (type === "link")
      return value.map((id) => links.find((l) => l.id === id)?.name).filter(Boolean).join(", ");
    const pickerOptions = {
      type: [{ key: "Лекція", label: "Лекція" }, { key: "Практика", label: "Практика" }, { key: "Лабораторна", label: "Лабораторна" }, { key: "Семінар", label: "Семінар" }],
    };
    return pickerOptions[type]?.find((o) => o.key === value)?.label || value;
  };

  const handleSelectOption = (picker, key) => {
    if (picker === "subject") {
      setSelectedSubjectId(key);
      setActivePicker(null);
      return;
    }
    if (!selectedSubjectId) return;
    if (picker === "type" || picker === "building" || picker === "room") handleUpdateSubject({ [picker]: key });
    else if (picker === "status") handleUpdateSubject({ status: key });
    else if (picker === "teacher") {
      const newTeachers = [...(currentSubject.teachers || [])];
      if (teacherIndex !== null) {
        newTeachers[teacherIndex] = key;
        handleUpdateSubject({ teachers: newTeachers });
      }
      setTeacherIndex(null);
    } else if (picker === "link") {
      const newLinks = currentSubject.links.includes(key) ? currentSubject.links.filter(id => id !== key) : [...currentSubject.links, key];
      handleUpdateSubject({ links: newLinks });
    }
    setActivePicker(null);
  };

  const options = {
    subject: subjects.map((s) => ({ key: s.id, label: s.name })),
    teacher: teachers.map((t) => ({ key: t.id, label: t.name })),
    link: links.map((l) => ({ key: l.id, label: l.name })),
    type: [{ key: "Лекція", label: "Лекція" }, { key: "Практика", label: "Практика" }, { key: "Лабораторна", label: "Лабораторна" }, { key: "Семінар", label: "Семінар" }],
    status: statuses.map((st) => ({ key: st.id, label: st.name })),
  };

  // --- ЛОГІКА ГРАДІЄНТА ---
  const startEditingGradient = (grad) => {
    setEditingGradient(grad);
    goToScreen("gradientEdit");
  };

  const startCreatingGradient = () => {
    const newGrad = addGradient(); 
    setEditingGradient(newGrad);
    goToScreen("gradientEdit");
  };

  // Це відкриває ОКРЕМУ МОДАЛКУ
  const openAdvancedColorPicker = (colorValue, setter) => {
    setAdvancedPickerTarget({ colorValue, setter });
    setShowAdvancedPicker(true);
  };

  const getHeaderTitle = () => {
    switch (currentScreen) {
        case "main": return Number.isInteger(lesson?.index) ? "Редагування" : "Нове заняття";
        case "subjectColor": return "Колір картки";
        case "statusColor": return "Колір статусу";
        case "gradientEdit": return "Налаштування градієнта";
        default: return "";
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.overlay}
    >
      <TouchableWithoutFeedback onPress={closeWithAnimation}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheetContainer,
          {
            backgroundColor: themeColors.backgroundColor,
            transform: [{ translateY: panY }],
          },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: themeColors.borderColor || "#ccc" }]} />
          </View>

          {/* ХЕДЕР */}
          <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
            {currentScreen === "main" ? (
              <TouchableOpacity onPress={closeWithAnimation} hitSlop={15}>
                <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Скасувати</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={15}>
                <Ionicons name="chevron-back" size={24} color={themeColors.accentColor} />
                <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Назад</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.headerTitle, { color: themeColors.textColor }]}>
              {getHeaderTitle()}
            </Text>

            <View style={{ minWidth: 60, alignItems: "flex-end" }}>
              {currentScreen === "main" && (
                <TouchableOpacity onPress={handleSave} disabled={!selectedSubjectId} hitSlop={15}>
                  <Text style={{ color: selectedSubjectId ? themeColors.accentColor : themeColors.textColor2, fontSize: 17, fontWeight: "600" }}>
                    Готово
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ОСНОВНИЙ КОНТЕНТ (Всі ці екрани всередині шторки) */}
        <View style={{ flex: 1 }}>
          {currentScreen === "main" && (
            <LessonEditorMainScreen
              themeColors={themeColors}
              selectedSubjectId={selectedSubjectId}
              currentSubject={currentSubject}
              statuses={statuses}
              gradients={gradients}
              setActivePicker={setActivePicker}
              setTeacherIndex={setTeacherIndex}
              handleUpdateSubject={handleUpdateSubject}
              goToScreen={goToScreen}
              getLabel={getLabel}
              onEditStatusColor={() => {
                 if(currentSubject.status) goToScreen("statusColor");
              }}
              onEditSubjectColor={() => {
                 goToScreen("subjectColor");
              }}
            />
          )}

          {currentScreen === "subjectColor" && (
            <LessonEditorSubjectColorScreen
              themeColors={themeColors}
              currentSubject={currentSubject}
              handleUpdateSubject={handleUpdateSubject}
              onEditGradient={startEditingGradient}
              onAddGradient={startCreatingGradient}
            />
          )}

          {currentScreen === "statusColor" && (
            <LessonEditorStatusColorScreen
              statuses={statuses}
              currentSubject={currentSubject}
              handleUpdateStatus={handleUpdateStatus}
            />
          )}

          {currentScreen === "gradientEdit" && editingGradient && (
            <LessonEditorGradientEditScreen
                themeColors={themeColors}
                gradientToEdit={editingGradient}
                onSave={handleSaveGradient}
                openColorPicker={openAdvancedColorPicker} // Це викличе окрему модалку
            />
          )}
        </View>
      </Animated.View>

      {/* МОДАЛКА 1: Списки
      */}
      <OptionListModal
        visible={!!activePicker && !!options[activePicker]}
        title={`Оберіть ${activePicker}`}
        options={options[activePicker] || []}
        onSelect={(key) => handleSelectOption(activePicker, key)}
        onClose={() => setActivePicker(null)}
        onAddNew={
          activePicker === "teacher" ? addTeacher :
          activePicker === "subject" ? addSubject :
          activePicker === "link" ? addLink :
          activePicker === "status" ? addStatus : undefined
        }
      />

      {/* МОДАЛКА 2: Advanced Picker (ОКРЕМА, ПОВЕРХ УСЬОГО)
          Це саме те меню з фото, яке ти просив зробити окремо
      */}
      {advancedPickerTarget && (
        <AdvancedColorPicker
            visible={showAdvancedPicker}
            initialColor={advancedPickerTarget.colorValue}
            onSave={(color) => {
                advancedPickerTarget.setter(color);
                setShowAdvancedPicker(false);
            }}
            onClose={() => setShowAdvancedPicker(false)}
        />
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
  sheetContainer: {
    height: "92%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  dragZone: { backgroundColor: "transparent", paddingTop: 10 },
  handleContainer: { alignItems: "center", paddingBottom: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  backButton: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
});
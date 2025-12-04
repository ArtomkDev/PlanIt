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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import useEntityManager from "../../../hooks/useEntityManager";
import themes from "../../../config/themes";
import { SUBJECT_ICONS } from "../../../config/subjectIcons"; 

// ЕКРАНИ
import LessonEditorMainScreen from "./LessonEditor/screens/MainScreen";
import LessonEditorSubjectColorScreen from "./LessonEditor/screens/ColorScreen";
import LessonEditorGradientEditScreen from "./LessonEditor/screens/GradientScreen";
import LessonEditorPickerScreen from "./LessonEditor/screens/PickerScreen"; 
import LessonEditorInputScreen from "./LessonEditor/screens/InputScreen";

import TeacherEditor from "./LessonEditor/forms/TeacherForm";
import LinkEditor from "./LessonEditor/forms/LinkForm";
import AdvancedColorPicker from "../../../components/AdvancedColorPicker";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const IS_IOS = Platform.OS === "ios"; 

export default function LessonEditor({ lesson, onClose }) {
  const { global, schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();
  const { addTeacher, addSubject, addLink, addGradient } = useEntityManager();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const dataSource = scheduleDraft || schedule;
  const subjects = dataSource?.subjects ?? [];
  const teachers = dataSource?.teachers ?? [];
  const links = dataSource?.links ?? [];
  const gradients = dataSource?.gradients ?? [];

  const [selectedSubjectId, setSelectedSubjectId] = useState(lesson?.subjectId || null);
  
  const [currentScreen, setCurrentScreen] = useState("main"); 
  const [pickerType, setPickerType] = useState(null); 
  const [inputType, setInputType] = useState(null);   
  const [editingItemData, setEditingItemData] = useState(null); 
  
  const [editingGradient, setEditingGradient] = useState(null);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [advancedPickerTarget, setAdvancedPickerTarget] = useState(null);

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || {};

  // --- АНІМАЦІЯ (Тільки для Android/Web) ---
  const panY = useRef(new Animated.Value(IS_IOS ? 0 : SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!IS_IOS) {
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
        mass: 1,
      }).start();
    }
  }, []);

  const closeWithAnimation = () => {
    Keyboard.dismiss();
    if (IS_IOS) {
        onClose(); 
    } else {
        Animated.timing(panY, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onClose());
    }
  };

  // 🔥 "ЖИВИЙ" PAN RESPONDER
  const panResponder = useRef(
    PanResponder.create({
      // Даємо кнопкам шанс отримати клік. Перехоплюємо тільки якщо є рух.
      onStartShouldSetPanResponder: () => false,
      
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (IS_IOS) return false;
        // Поріг зменшено до 5 пікселів для чутливості
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },

      onPanResponderGrant: () => {
        // Зупиняємо попередню анімацію, щоб "спіймати" шторку під пальцем
        panY.stopAnimation();
      },

      onPanResponderMove: (_, gestureState) => {
        if (IS_IOS) return;
        
        let newY = gestureState.dy;

        // ЕФЕКТ ГУМКИ (Rubber Banding) при русі вгору
        if (newY < 0) {
            // Чим вище тягнемо, тим важче йде (логарифмічний опір)
            newY = -Math.pow(Math.abs(newY), 0.8); 
        }
        
        panY.setValue(newY);
      },

      onPanResponderRelease: (_, gestureState) => {
        if (IS_IOS) return;

        // Логіка закриття:
        // 1. Швидкий свайп вниз (vy > 0.5)
        // 2. Або просто потягнули достатньо далеко вниз (> 120px)
        if (gestureState.dy > 120 || (gestureState.vy > 0.5 && gestureState.dy > 40)) {
          closeWithAnimation();
        } else {
          // Повертаємо назад "пружинкою" - м'яко і приємно
          Animated.spring(panY, { 
              toValue: 0, 
              useNativeDriver: true, 
              bounciness: 6,
              speed: 14 
          }).start();
        }
      },
    })
  ).current;

  // --- НАВІГАЦІЯ ---
  const goToScreen = (screenName, data = null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (data !== null) setEditingItemData(data);
    setCurrentScreen(screenName);
  };

  const handleBack = () => {
    if (currentScreen === "gradientEdit") return goToScreen("subjectColor");
    if (currentScreen === "teacherEditor") return goToScreen("picker"); 
    if (currentScreen === "linkEditor") return goToScreen("picker");    
    if (["picker", "input", "subjectColor"].includes(currentScreen)) {
        return goToScreen("main");
    }
    goToScreen("main");
  };

  const getHeaderTitle = () => {
    switch (currentScreen) {
        case "main": return Number.isInteger(lesson?.index) ? "Редагування" : "Нове заняття";
        case "subjectColor": return "Колір картки";
        case "gradientEdit": return "Налаштування градієнта";
        case "picker": 
            if (pickerType === 'teacher') return "Викладачі";
            if (pickerType === 'link') return "Посилання";
            if (pickerType === 'subject') return "Предмети";
            if (pickerType === 'type') return "Тип заняття";
            if (pickerType === 'icon') return "Оберіть іконку";
            return "Вибір";
        case "input":
            if (inputType === 'building') return "Корпус";
            if (inputType === 'room') return "Аудиторія";
            if (inputType === 'subject_rename') return "Змінити назву";
            return "Введення";
        case "teacherEditor": return "Редагування викладача";
        case "linkEditor": return "Редагування посилання";
        default: return "";
    }
  };

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

  const handleRenameSubject = (newName) => {
    if (editingItemData) { 
       setScheduleDraft((prev) => {
        const next = { ...prev };
        const idx = next.subjects.findIndex((s) => s.id === editingItemData);
        if (idx !== -1) {
          next.subjects[idx] = { ...next.subjects[idx], name: newName };
        }
        return next;
      });
      goToScreen("picker"); 
    }
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
    goToScreen("subjectColor");
  };

  const handleOpenPicker = (type) => {
    if (["building", "room"].includes(type)) {
        setInputType(type);
        goToScreen("input");
    } else {
        setPickerType(type);
        goToScreen("picker");
    }
  };

  const openAdvancedColorPicker = (colorValue, setter) => {
    setAdvancedPickerTarget({ colorValue, setter });
    setShowAdvancedPicker(true);
  };

  const getPickerData = () => {
    if (pickerType === "teacher") {
        return {
            options: teachers.map((t) => ({ key: t.id, label: t.name })),
            selected: currentSubject.teachers || [],
            multi: true,
            onAdd: () => { const newT = addTeacher(); goToScreen("teacherEditor", newT.id); },
            onEdit: (id) => goToScreen("teacherEditor", id),
            onSelect: (ids) => handleUpdateSubject({ teachers: ids })
        };
    }
    if (pickerType === "link") {
        return {
            options: links.map((l) => ({ key: l.id, label: l.name })),
            selected: currentSubject.links || [],
            multi: true,
            onAdd: () => { const newL = addLink(); goToScreen("linkEditor", newL.id); },
            onEdit: (id) => goToScreen("linkEditor", id),
            onSelect: (ids) => handleUpdateSubject({ links: ids })
        };
    }
    if (pickerType === "subject") {
        return {
            options: subjects.map((s) => ({ key: s.id, label: s.name })),
            selected: selectedSubjectId ? [selectedSubjectId] : [],
            multi: false,
            onAdd: () => { const newS = addSubject(); setSelectedSubjectId(newS.id); goToScreen("main"); },
            onEdit: (id) => { 
                setPickerType("subject"); 
                setInputType("subject_rename");
                goToScreen("input", id); 
            },
            onSelect: (key) => { setSelectedSubjectId(key); goToScreen("main"); }
        };
    }
    if (pickerType === "type") {
        const types = ["Лекція", "Практика", "Лабораторна", "Семінар"];
        return {
            options: types.map(t => ({ key: t, label: t })),
            selected: currentSubject.type ? [currentSubject.type] : [],
            multi: false,
            onSelect: (key) => { handleUpdateSubject({ type: key }); goToScreen("main"); }
        };
    }
    if (pickerType === "icon") {
        const iconOptions = Object.keys(SUBJECT_ICONS).map((key) => ({
            key: key,
            iconComponent: SUBJECT_ICONS[key] 
        }));
        iconOptions.unshift({ key: 'none', iconComponent: null });

        return {
            options: iconOptions,
            selected: currentSubject.icon ? [currentSubject.icon] : ['none'],
            multi: false,
            onSelect: (key) => { 
                const valueToSave = key === 'none' ? null : key;
                handleUpdateSubject({ icon: valueToSave }); 
                goToScreen("main"); 
            }
        };
    }
    return { options: [], selected: [], multi: false, onSelect: () => {} };
  };

  const pickerData = getPickerData();

  const getInputData = () => {
      if (inputType === "building") return { 
          val: currentSubject.building, 
          ph: "Наприклад: Головний",
          save: (val) => { handleUpdateSubject({ building: val }); goToScreen("main"); }
      };
      if (inputType === "room") return { 
          val: currentSubject.room, 
          ph: "Наприклад: 204",
          save: (val) => { handleUpdateSubject({ room: val }); goToScreen("main"); }
      };
      if (inputType === "subject_rename") {
          const subj = subjects.find(s => s.id === editingItemData);
          return {
              val: subj?.name,
              ph: "Назва предмету",
              save: handleRenameSubject
          };
      }
      return { val: "", ph: "", save: () => {} };
  };
  const inputData = getInputData();

  const getLabel = (type, value) => {
    if (!value) return null;
    if (type === "subject") return subjects.find((s) => s.id === value)?.name;
    if (type === "link" || type === "teacher") {
        const list = Array.isArray(value) ? value : [value];
        if (list.length === 0) return "Не обрано";
        const source = type === "link" ? links : teachers;
        const names = list.map(id => source.find(item => item.id === id)?.name).filter(Boolean);
        if (names.length === 0) return "Не обрано";
        return names.join(", ");
    }
    return value;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
      
      {!IS_IOS && (
        <TouchableWithoutFeedback onPress={closeWithAnimation}>
            <View style={styles.backdrop} /> 
        </TouchableWithoutFeedback>
      )}
      
      <Animated.View 
        style={[
            styles.sheetContainer, 
            { backgroundColor: themeColors.backgroundColor },
            !IS_IOS && { transform: [{ translateY: panY }] } 
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: themeColors.borderColor || "#ccc" }]} />
          </View>
          <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
            {currentScreen === "main" ? (
              <TouchableOpacity onPress={closeWithAnimation} hitSlop={15}><Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Скасувати</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={15}>
                <Ionicons name="chevron-back" size={24} color={themeColors.accentColor} />
                <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Назад</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.headerTitle, { color: themeColors.textColor }]}>{getHeaderTitle()}</Text>
            <View style={{ minWidth: 60, alignItems: "flex-end" }}>
              {currentScreen === "main" && (
                <TouchableOpacity onPress={handleSave} disabled={!selectedSubjectId} hitSlop={15}>
                  <Text style={{ color: selectedSubjectId ? themeColors.accentColor : themeColors.textColor2, fontSize: 17, fontWeight: "600" }}>Готово</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {currentScreen === "main" && (
            <LessonEditorMainScreen
              themeColors={themeColors}
              selectedSubjectId={selectedSubjectId}
              currentSubject={currentSubject}
              gradients={gradients}
              setActivePicker={handleOpenPicker}
              handleUpdateSubject={handleUpdateSubject}
              onEditSubjectColor={() => goToScreen("subjectColor")}
              getLabel={getLabel}
            />
          )}

          {currentScreen === "subjectColor" && (
            <LessonEditorSubjectColorScreen
              themeColors={themeColors}
              currentSubject={currentSubject}
              handleUpdateSubject={handleUpdateSubject}
              onEditGradient={(grad) => { setEditingGradient(grad); goToScreen("gradientEdit"); }}
              onAddGradient={() => { setEditingGradient(addGradient()); goToScreen("gradientEdit"); }}
            />
          )}
          {currentScreen === "gradientEdit" && editingGradient && (
            <LessonEditorGradientEditScreen
                themeColors={themeColors}
                gradientToEdit={editingGradient}
                onSave={handleSaveGradient}
                openColorPicker={openAdvancedColorPicker}
            />
          )}

          {currentScreen === "picker" && (
            <LessonEditorPickerScreen
              title={getHeaderTitle()}
              options={pickerData.options}
              selectedValues={pickerData.selected}
              multiSelect={pickerData.multi}
              onSelect={pickerData.onSelect}
              onEdit={pickerData.onEdit}
              onAdd={pickerData.onAdd}
              themeColors={themeColors}
              layout={pickerType === 'icon' ? 'grid' : 'list'} 
            />
          )}

          {currentScreen === "input" && (
            <LessonEditorInputScreen
                title={getHeaderTitle()}
                initialValue={inputData.val}
                placeholder={inputData.ph}
                onSave={inputData.save}
                themeColors={themeColors}
            />
          )}

          {currentScreen === "teacherEditor" && (
            <TeacherEditor 
                teacherId={editingItemData} 
                onBack={() => goToScreen("picker")}
                themeColors={themeColors}
            />
          )}
          {currentScreen === "linkEditor" && (
            <LinkEditor 
                linkId={editingItemData} 
                onBack={() => goToScreen("picker")}
                themeColors={themeColors}
            />
          )}
        </View>
      </Animated.View>

      {advancedPickerTarget && (
        <AdvancedColorPicker
            visible={showAdvancedPicker}
            initialColor={advancedPickerTarget.colorValue}
            onSave={(color) => { advancedPickerTarget.setter(color); setShowAdvancedPicker(false); }}
            onClose={() => setShowAdvancedPicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" }, 
  sheetContainer: { 
      flex: 1, 
      marginTop: IS_IOS ? 0 : '10%',
      // 🔥 На iOS радіус нульовий, щоб уникнути білих кутиків системи
      borderTopLeftRadius: IS_IOS ? 0 : 20, 
      borderTopRightRadius: IS_IOS ? 0 : 20, 
      overflow: "hidden", 
      shadowColor: "#000", 
      shadowOffset: { width: 0, height: -5 }, 
      shadowOpacity: 0.3, 
      shadowRadius: 10, 
      elevation: 10 
  },
  dragZone: { backgroundColor: "transparent", paddingTop: 10 },
  handleContainer: { alignItems: "center", paddingBottom: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  backButton: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
});
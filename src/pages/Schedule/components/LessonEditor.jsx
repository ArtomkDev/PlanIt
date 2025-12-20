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

  // 🔥 HELPER: Очищення даних від subjectId, щоб він не перезаписував вибір
  const getCleanInstanceData = (data) => {
    if (!data || typeof data !== 'object') return {};
    const { subjectId, ...rest } = data; // Викидаємо subjectId з об'єкта даних
    return rest;
  };

  // --- STATE ---
  const [selectedSubjectId, setSelectedSubjectId] = useState(lesson?.subjectId || null);
  
  // Використовуємо функцію очистки при ініціалізації
  const [instanceData, setInstanceData] = useState(
    lesson?.data ? getCleanInstanceData(lesson.data) : {}
  );
  
  const [currentScreen, setCurrentScreen] = useState("main"); 
  const [pickerType, setPickerType] = useState(null); 
  const [inputType, setInputType] = useState(null);   
  const [editingItemData, setEditingItemData] = useState(null); 
  
  const [editingGradient, setEditingGradient] = useState(null);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [advancedPickerTarget, setAdvancedPickerTarget] = useState(null);

  // 🔥 ВАЖЛИВО: Оновлюємо стан, якщо змінився пропс lesson (щоб не редагувати стару пару)
  useEffect(() => {
    setSelectedSubjectId(lesson?.subjectId || null);
    setInstanceData(lesson?.data ? getCleanInstanceData(lesson.data) : {});
    
    // Скидаємо навігацію на головний екран
    if (currentScreen !== "main") {
      setCurrentScreen("main");
      setPickerType(null);
      setInputType(null);
    }
  }, [lesson]);

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || {};

  // 🔥 HELPER: Санітайзер масивів
  const sanitizeArray = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.flat(Infinity).filter(id => id && id !== 0 && id !== "0");
  };

  // --- АНІМАЦІЯ ---
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (IS_IOS) return false;
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        panY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (IS_IOS) return;
        let newY = gestureState.dy;
        if (newY < 0) {
            newY = -Math.pow(Math.abs(newY), 0.8); 
        }
        panY.setValue(newY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (IS_IOS) return;
        if (gestureState.dy > 120 || (gestureState.vy > 0.5 && gestureState.dy > 40)) {
          closeWithAnimation();
        } else {
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

  // --- ЗБЕРЕЖЕННЯ ---
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
      
      // 🔥 ВИПРАВЛЕНО: Змінено порядок злиття об'єктів
      // Спочатку instanceData, а потім subjectId, щоб нове значення перекрило старе
      const lessonObject = {
        ...instanceData,
        subjectId: selectedSubjectId, 
      };

      // Чистка пустих полів
      Object.keys(lessonObject).forEach(key => {
          if (lessonObject[key] === undefined || lessonObject[key] === null || lessonObject[key] === "") {
              delete lessonObject[key];
          }
          if (Array.isArray(lessonObject[key]) && lessonObject[key].length === 0) {
              delete lessonObject[key];
          }
      });

      if (Number.isInteger(lesson?.index)) {
        while (weekArr.length <= lesson.index) weekArr.push(null);
        weekArr[lesson.index] = lessonObject;
      } else {
        weekArr.push(lessonObject);
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

  const handleUpdateInstance = (updates) => {
      setInstanceData(prev => ({ ...prev, ...updates }));
  };

  const handleGenericSave = (field, value, scope) => {
      const cleanValue = Array.isArray(value) ? sanitizeArray(value) : value;

      if (scope === 'global') {
          handleUpdateSubject({ [field]: cleanValue });
          // При глобальному збереженні видаляємо локальне перевизначення
          setInstanceData(prev => {
              const next = { ...prev };
              delete next[field];
              return next;
          });
      } else {
          handleUpdateInstance({ [field]: cleanValue });
      }
      goToScreen("main");
  };

  const handleResetLocal = (field) => {
      setInstanceData(prev => {
          const next = { ...prev };
          delete next[field];
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

  // --- GET DATA ---
  const getPickerData = () => {
    
    // Вчителі
    if (pickerType === "teacher") {
        const hasLocal = instanceData.teachers !== undefined;
        const rawTeachers = hasLocal 
            ? instanceData.teachers 
            : (currentSubject.teachers || (currentSubject.teacher ? [currentSubject.teacher] : []));
            
        const cleanSelected = sanitizeArray(rawTeachers);

        return {
            options: teachers.map((t) => ({ key: t.id, label: t.name })),
            selected: cleanSelected,
            multi: true,
            onAdd: () => { const newT = addTeacher(); goToScreen("teacherEditor", newT.id); },
            onEdit: (id) => goToScreen("teacherEditor", id),
            
            onSaveLocal: (ids) => handleGenericSave("teachers", ids, 'local'),
            onSaveGlobal: (ids) => handleGenericSave("teachers", ids, 'global'),
            
            onReset: hasLocal ? () => handleResetLocal("teachers") : null
        };
    }

    // Посилання
    if (pickerType === "link") {
        const hasLocal = instanceData.links !== undefined;
        const rawLinks = hasLocal ? instanceData.links : currentSubject.links;
        const cleanSelected = sanitizeArray(rawLinks);
        
        return {
            options: links.map((l) => ({ key: l.id, label: l.name })),
            selected: cleanSelected,
            multi: true,
            onAdd: () => { const newL = addLink(); goToScreen("linkEditor", newL.id); },
            onEdit: (id) => goToScreen("linkEditor", id),
            
            onSaveLocal: (ids) => handleGenericSave("links", ids, 'local'),
            onSaveGlobal: (ids) => handleGenericSave("links", ids, 'global'),
            
            onReset: hasLocal ? () => handleResetLocal("links") : null
        };
    }

    // Тип
    if (pickerType === "type") {
        const types = ["Лекція", "Практика", "Лабораторна", "Семінар"];
        const hasLocal = instanceData.type !== undefined;
        const currentType = hasLocal ? instanceData.type : currentSubject.type;

        return {
            options: types.map(t => ({ key: t, label: t })),
            selected: currentType ? [currentType] : [],
            multi: false,
            onSaveLocal: (key) => handleGenericSave("type", key, 'local'),
            onSaveGlobal: (key) => handleGenericSave("type", key, 'global'),
            onReset: hasLocal ? () => handleResetLocal("type") : null
        };
    }

    // Предмет
    if (pickerType === "subject") {
        return {
            options: subjects.map((s) => ({ key: s.id, label: s.name })),
            selected: selectedSubjectId ? [selectedSubjectId] : [],
            multi: false,
            onAdd: () => { const newS = addSubject(); setSelectedSubjectId(newS.id); goToScreen("main"); },
            onEdit: (id) => { setPickerType("subject"); setInputType("subject_rename"); goToScreen("input", id); },
            onSelect: (key) => { setSelectedSubjectId(key); goToScreen("main"); }
        };
    }

    // Іконка
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
    return { options: [], selected: [], multi: false };
  };

  const pickerData = getPickerData();

  // --- ДАНІ ДЛЯ INPUT ---
  const getInputData = () => {
      if (inputType === "building") {
          const hasLocal = instanceData.building !== undefined;
          return { 
            val: hasLocal ? instanceData.building : (currentSubject.building || ""), 
            ph: "Наприклад: Головний",
            onSaveLocal: (val) => handleGenericSave("building", val, 'local'),
            onSaveGlobal: (val) => handleGenericSave("building", val, 'global'),
            onReset: hasLocal ? () => handleResetLocal("building") : null
          };
      }
      if (inputType === "room") {
          const hasLocal = instanceData.room !== undefined;
          return { 
            val: hasLocal ? instanceData.room : (currentSubject.room || ""),
            ph: "Наприклад: 204",
            onSaveLocal: (val) => handleGenericSave("room", val, 'local'),
            onSaveGlobal: (val) => handleGenericSave("room", val, 'global'),
            onReset: hasLocal ? () => handleResetLocal("room") : null
          };
      }
      if (inputType === "subject_rename") {
          const subj = subjects.find(s => s.id === editingItemData);
          return {
              val: subj?.name,
              ph: "Назва предмету",
              onSave: handleRenameSubject
          };
      }
      return { val: "", ph: "", onSave: () => {} };
  };
  const inputData = getInputData();

  const getLabel = (type, value) => {
    if (!value) return null;
    if (type === "subject") return subjects.find((s) => s.id === value)?.name;
    if (type === "link" || type === "teacher") {
        const list = sanitizeArray(Array.isArray(value) ? value : [value]);
        
        if (list.length === 0) return "Не обрано";
        const source = type === "link" ? links : teachers;
        const names = list.map(id => source.find(item => item.id === id)?.name).filter(Boolean);
        if (names.length === 0) return "Не обрано";
        return names.join(", ");
    }
    return value;
  };

  // Helper для MainScreen
  const getDisplayData = () => {
      return {
          teachers: instanceData.teachers !== undefined ? instanceData.teachers : (currentSubject.teachers || []),
          links: instanceData.links !== undefined ? instanceData.links : (currentSubject.links || []),
          type: instanceData.type !== undefined ? instanceData.type : currentSubject.type,
          building: instanceData.building !== undefined ? instanceData.building : currentSubject.building,
          room: instanceData.room !== undefined ? instanceData.room : currentSubject.room,
      };
  };
  const displayData = getDisplayData();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
      {!IS_IOS && (<TouchableWithoutFeedback onPress={closeWithAnimation}><View style={styles.backdrop} /></TouchableWithoutFeedback>)}
      
      <Animated.View style={[styles.sheetContainer, { backgroundColor: themeColors.backgroundColor }, !IS_IOS && { transform: [{ translateY: panY }] }]}>
        <View {...panResponder.panHandlers} style={styles.dragZone}>
          <View style={styles.handleContainer}><View style={[styles.handle, { backgroundColor: themeColors.borderColor || "#ccc" }]} /></View>
          <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
            {currentScreen === "main" ? (
              <TouchableOpacity onPress={closeWithAnimation} hitSlop={15}><Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Скасувати</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={15}>
                <Ionicons name="chevron-back" size={24} color={themeColors.accentColor} /><Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Назад</Text>
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
              instanceData={displayData}
              gradients={gradients}
              setActivePicker={handleOpenPicker}
              onEditSubjectColor={() => goToScreen("subjectColor")}
              getLabel={getLabel}
            />
          )}

          {currentScreen === "subjectColor" && (
            <LessonEditorSubjectColorScreen themeColors={themeColors} currentSubject={currentSubject} handleUpdateSubject={handleUpdateSubject} onEditGradient={(grad) => { setEditingGradient(grad); goToScreen("gradientEdit"); }} onAddGradient={() => { setEditingGradient(addGradient()); goToScreen("gradientEdit"); }} />
          )}
          {currentScreen === "gradientEdit" && editingGradient && (
            <LessonEditorGradientEditScreen themeColors={themeColors} gradientToEdit={editingGradient} onSave={handleSaveGradient} openColorPicker={openAdvancedColorPicker} />
          )}

          {currentScreen === "picker" && (
            <LessonEditorPickerScreen
              title={getHeaderTitle()}
              options={pickerData.options}
              selectedValues={pickerData.selected}
              multiSelect={pickerData.multi}
              
              onSelect={pickerData.onSelect} 
              onSaveLocal={pickerData.onSaveLocal} 
              onSaveGlobal={pickerData.onSaveGlobal} 
              onReset={pickerData.onReset}
              
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
                
                onSave={inputData.onSave} 
                onSaveLocal={inputData.onSaveLocal} 
                onSaveGlobal={inputData.onSaveGlobal} 
                onReset={inputData.onReset}
                
                themeColors={themeColors}
            />
          )}

          {currentScreen === "teacherEditor" && (<TeacherEditor teacherId={editingItemData} onBack={() => goToScreen("picker")} themeColors={themeColors}/>)}
          {currentScreen === "linkEditor" && (<LinkEditor linkId={editingItemData} onBack={() => goToScreen("picker")} themeColors={themeColors}/>)}
        </View>
      </Animated.View>
      {advancedPickerTarget && (<AdvancedColorPicker visible={showAdvancedPicker} initialColor={advancedPickerTarget.colorValue} onSave={(color) => { advancedPickerTarget.setter(color); setShowAdvancedPicker(false); }} onClose={() => setShowAdvancedPicker(false)}/>)}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" }, 
  sheetContainer: { flex: 1, marginTop: IS_IOS ? 0 : '10%', borderTopLeftRadius: IS_IOS ? 0 : 20, borderTopRightRadius: IS_IOS ? 0 : 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
  dragZone: { backgroundColor: "transparent", paddingTop: 10 },
  handleContainer: { alignItems: "center", paddingBottom: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  backButton: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
});
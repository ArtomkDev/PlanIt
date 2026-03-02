import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  Keyboard,
  Animated,
  PanResponder,
  Dimensions,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import { SUBJECT_ICONS } from "../../../config/subjectIcons"; 

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

// Deep clone used to guarantee complete detachment from global context references
const deepClone = (data) => JSON.parse(JSON.stringify(data || []));
const generateLocalId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

export default function LessonEditor({ lesson, onClose }) {
  const { global, schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const dataSource = scheduleDraft || schedule;

  // Fully isolated local state buffer
  const [localData, setLocalData] = useState({
    subjects: deepClone(dataSource?.subjects),
    teachers: deepClone(dataSource?.teachers),
    links: deepClone(dataSource?.links),
    gradients: deepClone(dataSource?.gradients),
  });

  const getCleanInstanceData = (data) => {
    if (!data || typeof data !== 'object') return {};
    const { subjectId, ...rest } = data; 
    return rest;
  };

  const [selectedSubjectId, setSelectedSubjectId] = useState(lesson?.subjectId || null);
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

  useEffect(() => {
    setSelectedSubjectId(lesson?.subjectId || null);
    setInstanceData(lesson?.data ? getCleanInstanceData(lesson.data) : {});
    setLocalData({
        subjects: deepClone(dataSource?.subjects),
        teachers: deepClone(dataSource?.teachers),
        links: deepClone(dataSource?.links),
        gradients: deepClone(dataSource?.gradients),
    });
    
    if (currentScreen !== "main") {
      setCurrentScreen("main");
      setPickerType(null);
      setInputType(null);
    }
  }, [lesson]);

  const currentSubject = localData.subjects.find((s) => s.id === selectedSubjectId) || {};

  const sanitizeArray = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.flat(Infinity).filter(id => id && id !== 0 && id !== "0");
  };

  const panY = useRef(new Animated.Value(IS_IOS ? 0 : SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (!IS_IOS) {
      Animated.spring(panY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
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
          useNativeDriver: Platform.OS !== 'web',
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
              useNativeDriver: Platform.OS !== 'web', 
              bounciness: 6,
              speed: 14 
          }).start();
        }
      },
    })
  ).current;

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
      
      // Batch apply all buffered local changes to the global context
      next.subjects = localData.subjects;
      next.teachers = localData.teachers;
      next.links = localData.links;
      next.gradients = localData.gradients;

      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;
      
      next.schedule = next.schedule ? [...next.schedule] : Array(7).fill(null).map(() => ({}));
      next.schedule[dayIndex] = next.schedule[dayIndex] ? { ...next.schedule[dayIndex] } : {};
      
      const weekArr = next.schedule[dayIndex][weekKey] ? [...next.schedule[dayIndex][weekKey]] : [];
      
      const lessonObject = {
        ...instanceData,
        subjectId: selectedSubjectId, 
      };

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

  // Local state modifiers replacing immediate global dispatches
  const handleUpdateSubject = (updates) => {
    if (!selectedSubjectId) return;
    setLocalData((prev) => {
      const nextSubjects = [...prev.subjects];
      const subjIndex = nextSubjects.findIndex((s) => s.id === selectedSubjectId);
      if (subjIndex !== -1) nextSubjects[subjIndex] = { ...nextSubjects[subjIndex], ...updates };
      return { ...prev, subjects: nextSubjects };
    });
  };

  const handleUpdateInstance = (updates) => {
      setInstanceData(prev => ({ ...prev, ...updates }));
  };

  const handleGenericSave = (field, value, scope) => {
      const cleanValue = Array.isArray(value) ? sanitizeArray(value) : value;

      if (scope === 'global') {
          handleUpdateSubject({ [field]: cleanValue });
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
       setLocalData((prev) => {
        const nextSubjects = [...prev.subjects];
        const idx = nextSubjects.findIndex((s) => s.id === editingItemData);
        if (idx !== -1) nextSubjects[idx] = { ...nextSubjects[idx], name: newName };
        return { ...prev, subjects: nextSubjects };
      });
      goToScreen("picker"); 
    }
  };

  const handleSaveGradient = (newGradient) => {
    setLocalData((prev) => {
      const grads = [...prev.gradients];
      const idx = grads.findIndex((g) => g.id === newGradient.id);
      if (idx !== -1) grads[idx] = newGradient;
      else grads.push(newGradient);
      return { ...prev, gradients: grads };
    });
    
    // ОДРАЗУ вибираємо цей градієнт для предмету
    handleUpdateSubject({ colorGradient: newGradient.id, typeColor: "gradient" });
    // ЗАКРИВАЄМО всі вікна вибору і повертаємось на головний екран
    goToScreen("main");
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
        const hasLocal = instanceData.teachers !== undefined;
        const rawTeachers = hasLocal 
            ? instanceData.teachers 
            : (currentSubject.teachers || (currentSubject.teacher ? [currentSubject.teacher] : []));
            
        const cleanSelected = sanitizeArray(rawTeachers);

        return {
            options: localData.teachers.map((t) => ({ key: t.id, label: t.name })),
            selected: cleanSelected,
            multi: true,
            onAdd: () => {
                const newT = { id: generateLocalId(), name: "Новий викладач" };
                setLocalData(prev => ({ ...prev, teachers: [...prev.teachers, newT] }));
                goToScreen("teacherEditor", newT.id);
            },
            onEdit: (id) => goToScreen("teacherEditor", id),
            onSaveLocal: (ids) => handleGenericSave("teachers", ids, 'local'),
            onSaveGlobal: (ids) => handleGenericSave("teachers", ids, 'global'),
            onReset: hasLocal ? () => handleResetLocal("teachers") : null
        };
    }

    if (pickerType === "link") {
        const hasLocal = instanceData.links !== undefined;
        const rawLinks = hasLocal ? instanceData.links : currentSubject.links;
        const cleanSelected = sanitizeArray(rawLinks);
        
        return {
            options: localData.links.map((l) => ({ key: l.id, label: l.name })),
            selected: cleanSelected,
            multi: true,
            onAdd: () => {
                const newL = { id: generateLocalId(), name: "Нове посилання", url: "" };
                setLocalData(prev => ({ ...prev, links: [...prev.links, newL] }));
                goToScreen("linkEditor", newL.id);
            },
            onEdit: (id) => goToScreen("linkEditor", id),
            onSaveLocal: (ids) => handleGenericSave("links", ids, 'local'),
            onSaveGlobal: (ids) => handleGenericSave("links", ids, 'global'),
            onReset: hasLocal ? () => handleResetLocal("links") : null
        };
    }

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

    if (pickerType === "subject") {
        return {
            options: localData.subjects.map((s) => ({ key: s.id, label: s.name })),
            selected: selectedSubjectId ? [selectedSubjectId] : [],
            multi: false,
            onAdd: () => {
                const newS = { id: generateLocalId(), name: "Новий предмет" };
                setLocalData(prev => ({ ...prev, subjects: [...prev.subjects, newS] }));
                setSelectedSubjectId(newS.id);
                goToScreen("main");
            },
            onEdit: (id) => { setPickerType("subject"); setInputType("subject_rename"); goToScreen("input", id); },
            onSelect: (key) => { setSelectedSubjectId(key); goToScreen("main"); }
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
    return { options: [], selected: [], multi: false };
  };

  const pickerData = getPickerData();

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
          const subj = localData.subjects.find(s => s.id === editingItemData);
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
    if (type === "subject") return localData.subjects.find((s) => s.id === value)?.name;
    if (type === "link" || type === "teacher") {
        const list = sanitizeArray(Array.isArray(value) ? value : [value]);
        
        if (list.length === 0) return "Не обрано";
        const source = type === "link" ? localData.links : localData.teachers;
        const names = list.map(id => source.find(item => item.id === id)?.name).filter(Boolean);
        if (names.length === 0) return "Не обрано";
        return names.join(", ");
    }
    return value;
  };

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
      {!IS_IOS && (<Pressable onPress={closeWithAnimation} style={styles.backdrop} />)}
      
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
              gradients={localData.gradients}
              setActivePicker={handleOpenPicker}
              onEditSubjectColor={() => goToScreen("subjectColor")}
              getLabel={getLabel}
            />
          )}

          {currentScreen === "subjectColor" && (
            <LessonEditorSubjectColorScreen 
                themeColors={themeColors} 
                currentSubject={currentSubject} 
                // Замінюємо handleUpdateSubject на onSelect
                onSelect={(updates) => {
                    handleUpdateSubject(updates);
                    goToScreen("main"); // Повертаємось на головний екран після вибору
                }} 
                onEditGradient={(grad) => { setEditingGradient(grad); goToScreen("gradientEdit"); }} 
                onAddGradient={() => {
                    const newG = { id: generateLocalId(), colors: ["#4facfe", "#00f2fe"] };
                    setLocalData(prev => ({ ...prev, gradients: [...prev.gradients, newG] }));
                    setEditingGradient(newG);
                    goToScreen("gradientEdit");
                }} 
            />
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

          {currentScreen === "teacherEditor" && (
              <TeacherEditor 
                teacherId={editingItemData} 
                localTeacherData={localData.teachers.find(t => t.id === editingItemData)}
                onSaveLocal={(updated) => {
                    setLocalData(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === updated.id ? updated : t) }));
                    goToScreen("picker");
                }}
                onBack={() => goToScreen("picker")} 
                themeColors={themeColors}
              />
          )}
          {currentScreen === "linkEditor" && (
              <LinkEditor 
                linkId={editingItemData} 
                localLinkData={localData.links.find(l => l.id === editingItemData)}
                onSaveLocal={(updated) => {
                    setLocalData(prev => ({ ...prev, links: prev.links.map(l => l.id === updated.id ? updated : l) }));
                    goToScreen("picker");
                }}
                onBack={() => goToScreen("picker")} 
                themeColors={themeColors}
              />
          )}
        </View>
      </Animated.View>
      {advancedPickerTarget && (<AdvancedColorPicker visible={showAdvancedPicker} initialColor={advancedPickerTarget.colorValue} onSave={(color) => { advancedPickerTarget.setter(color); setShowAdvancedPicker(false); }} onClose={() => setShowAdvancedPicker(false)}/>)}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" }, 
  sheetContainer: { 
    flex: 1, 
    marginTop: IS_IOS ? 0 : '10%', 
    borderTopLeftRadius: IS_IOS ? 0 : 20, 
    borderTopRightRadius: IS_IOS ? 0 : 20, 
    overflow: "hidden", 
    elevation: 10,
    ...Platform.select({
      web: { boxShadow: "0px -5px 10px rgba(0,0,0,0.3)" },
      default: { shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10 }
    })
  },
  dragZone: { backgroundColor: "transparent", paddingTop: 10 },
  handleContainer: { alignItems: "center", paddingBottom: 10 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', paddingHorizontal: 16, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  backButton: { flexDirection: "row", alignItems: "center", marginLeft: -8 },
}); 
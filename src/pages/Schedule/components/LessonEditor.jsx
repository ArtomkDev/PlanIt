import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  Animated,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import { SUBJECT_ICONS } from "../../../config/subjectIcons"; 

import BottomSheet from "../../../components/BottomSheet";
import AppBlur from "../../../components/AppBlur";

import LessonEditorMainScreen from "./LessonEditor/screens/MainScreen";
import LessonEditorSubjectColorScreen from "./LessonEditor/screens/ColorScreen";
import LessonEditorGradientEditScreen from "./LessonEditor/screens/GradientScreen";
import LessonEditorPickerScreen from "./LessonEditor/screens/PickerScreen"; 
import LessonEditorInputScreen from "./LessonEditor/screens/InputScreen";

import TeacherEditor from "./LessonEditor/forms/TeacherForm";
import LinkEditor from "./LessonEditor/forms/LinkForm";
import AdvancedColorPicker from "../../../components/AdvancedColorPicker";

import { t } from "../../../utils/i18n";

const deepClone = (data) => JSON.parse(JSON.stringify(data || []));
const generateLocalId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

export default function LessonEditor({ lesson, onClose }) {
  const { global, schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const lang = global?.language || 'uk';

  const dataSource = scheduleDraft || schedule;

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
  
  const [scopes, setScopes] = useState({
    people: 'global',
    type: 'global',
    location: 'global',
    materials: 'global'
  });
  
  const [currentScreen, setCurrentScreen] = useState("main"); 
  const [pickerType, setPickerType] = useState(null); 
  const [inputType, setInputType] = useState(null);   
  const [editingItemData, setEditingItemData] = useState(null); 
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);
  
  const [editingGradient, setEditingGradient] = useState(null);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [advancedPickerTarget, setAdvancedPickerTarget] = useState(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeAnim = useRef(new Animated.Value(0)).current;

  const sheetRef = useRef(null); 

  useEffect(() => {
    setSelectedSubjectId(lesson?.subjectId || null);
    
    const initialInstanceData = lesson?.data ? getCleanInstanceData(lesson.data) : {};
    setInstanceData(initialInstanceData);

    setScopes({
      people: initialInstanceData.teachers !== undefined ? 'local' : 'global',
      type: initialInstanceData.type !== undefined ? 'local' : 'global',
      location: (initialInstanceData.building !== undefined || initialInstanceData.room !== undefined) ? 'local' : 'global',
      materials: initialInstanceData.links !== undefined ? 'local' : 'global'
    });

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
      setEditingSlotIndex(null);
    }

    if (isMinimized) {
      handleExpand();
    }
  }, [lesson]);

  useEffect(() => {
    if (isMinimized) {
      Animated.spring(minimizeAnim, {
        toValue: 1,
        stiffness: 300,
        damping: 20,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    } else {
      minimizeAnim.setValue(0);
    }
  }, [isMinimized]);

  const handleExpand = () => {
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setIsMinimized(false));
  };
  
  const handleCloseMinimized = () => {
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onClose());
  };

  const currentSubject = localData.subjects.find((s) => s.id === selectedSubjectId) || {};

  const sanitizeArray = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.flat(Infinity).filter(id => id && id !== 0 && id !== "0");
  };

  const goToScreen = (screenName, data = null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (data !== null) setEditingItemData(data);
    setCurrentScreen(screenName);
  };

  const handleBack = () => {
    if (currentScreen === "gradientEdit") return goToScreen("subjectColor");
    if (currentScreen === "teacherEditor") return goToScreen(pickerType ? "picker" : "main"); 
    if (currentScreen === "linkEditor") return goToScreen(pickerType ? "picker" : "main");    
    if (currentScreen === "input" && pickerType === "subject") return goToScreen("picker");
    
    if (["picker", "input", "subjectColor"].includes(currentScreen)) {
        return goToScreen("main");
    }
    goToScreen("main");
  };

  const getHeaderTitle = () => {
    switch (currentScreen) {
        case "main": return Number.isInteger(lesson?.index) ? t('schedule.lesson_editor.edit', lang) : t('schedule.lesson_editor.new_lesson', lang);
        case "subjectColor": return t('schedule.lesson_editor.card_color', lang);
        case "gradientEdit": return t('schedule.lesson_editor.gradient_settings', lang);
        case "picker": 
            if (pickerType === 'teacher') return t('schedule.lesson_editor.teachers', lang);
            if (pickerType === 'link') return t('schedule.lesson_editor.links', lang);
            if (pickerType === 'subject') return t('schedule.lesson_editor.subjects', lang);
            if (pickerType === 'type') return t('schedule.lesson_editor.lesson_type', lang);
            if (pickerType === 'icon') return t('schedule.lesson_editor.choose_icon', lang);
            return t('schedule.lesson_editor.selection', lang);
        case "input":
            if (inputType === 'building') return t('schedule.lesson_editor.building', lang);
            if (inputType === 'room') return t('schedule.lesson_editor.room', lang);
            if (inputType === 'subject_rename') return t('schedule.lesson_editor.change_name', lang);
            return t('schedule.lesson_editor.input', lang);
        case "teacherEditor": return t('schedule.lesson_editor.edit_teacher', lang);
        case "linkEditor": return t('schedule.lesson_editor.edit_link', lang);
        default: return "";
    }
  };

  const handleSave = () => {
    if (!selectedSubjectId) return;
    setScheduleDraft((prev) => {
      const next = { ...prev };
      
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

      if (scopes.people === 'global') delete lessonObject.teachers;
      if (scopes.type === 'global') delete lessonObject.type;
      if (scopes.location === 'global') {
          delete lessonObject.building;
          delete lessonObject.room;
      }
      if (scopes.materials === 'global') delete lessonObject.links;

      Object.keys(lessonObject).forEach(key => {
          if (lessonObject[key] === undefined || lessonObject[key] === null) {
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
    
    if (isMinimized) {
      Animated.timing(minimizeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => onClose());
    } else {
      sheetRef.current?.close();
    }
  };

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

  const handleGenericSave = (field, value, groupName) => {
      const cleanValue = Array.isArray(value) ? sanitizeArray(value) : value;
      const scope = scopes[groupName] || 'global';

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
      goToScreen("main");
  };

  const handleRenameSubject = (newName) => {
    if (editingItemData) { 
       setLocalData((prev) => {
        const nextSubjects = [...prev.subjects];
        const idx = nextSubjects.findIndex((s) => s.id === editingItemData);
        if (idx !== -1) {
            nextSubjects[idx] = { ...nextSubjects[idx], name: newName };
        } else {
            nextSubjects.push({ id: editingItemData, name: newName });
        }
        return { ...prev, subjects: nextSubjects };
      });
      
      const isNew = !localData.subjects.some((s) => s.id === editingItemData);
      if (isNew) {
          setSelectedSubjectId(editingItemData);
          goToScreen("main");
      } else {
          goToScreen("picker"); 
      }
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
    
    handleUpdateSubject({ colorGradient: newGradient.id, typeColor: "gradient" });
    goToScreen("main");
  };

  const handleOpenPicker = (type, index = null) => {
    if (["building", "room"].includes(type)) {
        setInputType(type);
        goToScreen("input");
    } else {
        setPickerType(type);
        setEditingSlotIndex(index);
        goToScreen("picker");
    }
  };

  const handleDirectEdit = (type, id, index) => {
    if (!id) return;
    setEditingSlotIndex(index); 
    setPickerType(null); 
    
    if (type === "teacher") goToScreen("teacherEditor", id);
    if (type === "link") goToScreen("linkEditor", id);
  };

  const openAdvancedColorPicker = (colorValue, setter) => {
    setAdvancedPickerTarget({ colorValue, setter });
    setShowAdvancedPicker(true);
  };

  const getArrayData = (field, scopeGroup) => {
      const scope = scopes[scopeGroup];
      let val;
      if (scope === 'global') {
          val = field === 'teachers' ? (currentSubject.teachers || currentSubject.teacher) : currentSubject[field];
      } else {
          val = instanceData[field] !== undefined ? instanceData[field] : [];
      }
      return { array: sanitizeArray(val), isInherited: false };
  };

  const getPickerData = () => {
    if (pickerType === "teacher") {
        const { array: cleanSelected } = getArrayData("teachers", "people");
        const currentSelectedId = editingSlotIndex !== null && editingSlotIndex < cleanSelected.length ? cleanSelected[editingSlotIndex] : null;
        const alreadySelected = cleanSelected.filter((_, i) => i !== editingSlotIndex);

        const options = localData.teachers.map((t) => ({ key: t.id, label: t.name }));
        options.unshift({ key: 'none', label: t('schedule.lesson_editor.delete_slot', lang) });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => {
                const newId = generateLocalId();
                goToScreen("teacherEditor", newId);
            },
            onEdit: (id) => { if (id !== 'none') goToScreen("teacherEditor", id); },
            onSave: (key) => {
                let newArr = [...cleanSelected];
                if (key === 'none') {
                    if (editingSlotIndex !== null && editingSlotIndex < newArr.length) newArr.splice(editingSlotIndex, 1);
                } else {
                    if (editingSlotIndex !== null && editingSlotIndex < newArr.length) newArr[editingSlotIndex] = key;
                    else newArr.push(key);
                }
                newArr = [...new Set(newArr)];
                handleGenericSave("teachers", newArr, 'people');
            },
            onReset: scopes.people === 'local' && instanceData.teachers !== undefined ? () => handleResetLocal("teachers") : null
        };
    }

    if (pickerType === "link") {
        const { array: cleanSelected } = getArrayData("links", "materials");
        const currentSelectedId = editingSlotIndex !== null && editingSlotIndex < cleanSelected.length ? cleanSelected[editingSlotIndex] : null;
        const alreadySelected = cleanSelected.filter((_, i) => i !== editingSlotIndex);

        const options = localData.links.map((l) => ({ key: l.id, label: l.name }));
        options.unshift({ key: 'none', label: t('schedule.lesson_editor.delete_slot', lang) });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => {
                const newId = generateLocalId();
                goToScreen("linkEditor", newId);
            },
            onEdit: (id) => { if (id !== 'none') goToScreen("linkEditor", id); },
            onSave: (key) => {
                let newArr = [...cleanSelected];
                if (key === 'none') {
                    if (editingSlotIndex !== null && editingSlotIndex < newArr.length) newArr.splice(editingSlotIndex, 1);
                } else {
                    if (editingSlotIndex !== null && editingSlotIndex < newArr.length) newArr[editingSlotIndex] = key;
                    else newArr.push(key);
                }
                newArr = [...new Set(newArr)];
                handleGenericSave("links", newArr, 'materials');
            },
            onReset: scopes.materials === 'local' && instanceData.links !== undefined ? () => handleResetLocal("links") : null
        };
    }

    if (pickerType === "type") {
        const types = [
            { key: "Лекція", label: t('schedule.lesson_types.lecture', lang) },
            { key: "Практика", label: t('schedule.lesson_types.practice', lang) },
            { key: "Лабораторна", label: t('schedule.lesson_types.lab', lang) },
            { key: "Семінар", label: t('schedule.lesson_types.seminar', lang) }
        ];
        const scope = scopes.type;
        const hasLocal = instanceData.type !== undefined;
        const currentType = scope === 'local' ? (hasLocal ? instanceData.type : null) : currentSubject.type;

        return {
            options: types,
            selected: currentType ? [currentType] : [],
            multi: false,
            onSave: (key) => handleGenericSave("type", key, 'type'),
            onReset: scope === 'local' && hasLocal ? () => handleResetLocal("type") : null
        };
    }

    if (pickerType === "subject") {
        return {
            options: localData.subjects.map((s) => ({ key: s.id, label: s.name })),
            selected: selectedSubjectId ? [selectedSubjectId] : [],
            multi: false,
            onAdd: () => {
                const newId = generateLocalId();
                setPickerType("subject");
                setInputType("subject_rename");
                goToScreen("input", newId);
            },
            onEdit: (id) => { setPickerType("subject"); setInputType("subject_rename"); goToScreen("input", id); },
            onSave: (key) => { setSelectedSubjectId(key); goToScreen("main"); }
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
            onSave: (key) => { 
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
          const scope = scopes.location;
          const hasLocal = instanceData.building !== undefined;
          const currentBuilding = scope === 'local' ? (hasLocal ? instanceData.building : "") : currentSubject.building;
          
          return { 
            val: currentBuilding || "", 
            ph: t('schedule.lesson_editor.placeholder_building', lang),
            onSave: (val) => handleGenericSave("building", val, 'location'),
            onReset: scope === 'local' && hasLocal ? () => handleResetLocal("building") : null
          };
      }
      if (inputType === "room") {
          const scope = scopes.location;
          const hasLocal = instanceData.room !== undefined;
          const currentRoom = scope === 'local' ? (hasLocal ? instanceData.room : "") : currentSubject.room;

          return { 
            val: currentRoom || "",
            ph: t('schedule.lesson_editor.placeholder_room', lang),
            onSave: (val) => handleGenericSave("room", val, 'location'),
            onReset: scope === 'local' && hasLocal ? () => handleResetLocal("room") : null
          };
      }
      if (inputType === "subject_rename") {
          const subj = localData.subjects.find(s => s.id === editingItemData);
          return {
              val: subj?.name || "", 
              ph: t('schedule.lesson_editor.placeholder_subject', lang),
              onSave: handleRenameSubject
          };
      }
      return { val: "", ph: "", onSave: () => {} };
  };
  const inputData = getInputData();

  const getLabel = (type, value) => {
    if (value === "" || value === null || value === undefined) return null;
    if (type === "subject") return localData.subjects.find((s) => s.id === value)?.name;
    if (type === "link" || type === "teacher") {
        const list = sanitizeArray(Array.isArray(value) ? value : [value]);
        if (list.length === 0) return t('schedule.lesson_editor.not_selected', lang);
        const source = type === "link" ? localData.links : localData.teachers;
        const names = list.map(id => source.find(item => item.id === id)?.name).filter(Boolean);
        if (names.length === 0) return t('schedule.lesson_editor.not_selected', lang);
        return names.join(", ");
    }
    
    if (type === "type") {
        switch (value) {
            case "Лекція": return t('schedule.lesson_types.lecture', lang);
            case "Практика": return t('schedule.lesson_types.practice', lang);
            case "Лабораторна": return t('schedule.lesson_types.lab', lang);
            case "Семінар": return t('schedule.lesson_types.seminar', lang);
            default: return value;
        }
    }
    
    return value;
  };

  const getValueLabel = (field, type, scopeGroup) => {
      const scope = scopes[scopeGroup];
      let val;
      if (scope === 'global') {
          val = field === 'teachers' ? (currentSubject.teachers || currentSubject.teacher) : currentSubject[field];
      } else {
          val = instanceData[field] !== undefined ? instanceData[field] : null;
      }
      const labelStr = getLabel(type, val);
      const isEmpty = !labelStr || labelStr === t('schedule.lesson_editor.not_selected', lang);
      return isEmpty ? t('schedule.lesson_editor.not_specified', lang) : labelStr;
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
      {currentScreen === "main" ? (
        <TouchableOpacity onPress={() => sheetRef.current?.close()} hitSlop={15}>
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t('common.cancel', lang)}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={15}>
          <Ionicons name="chevron-back" size={24} color={themeColors.accentColor} />
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t('common.back', lang)}</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.headerTitle, { color: themeColors.textColor }]}>{getHeaderTitle()}</Text>
      <View style={{ minWidth: 60, alignItems: "flex-end" }}>
        {currentScreen === "main" && (
          <TouchableOpacity onPress={handleSave} disabled={!selectedSubjectId} hitSlop={15}>
            <Text style={{ color: selectedSubjectId ? themeColors.accentColor : themeColors.textColor2, fontSize: 17, fontWeight: "600" }}>
              {t('common.done', lang)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <>
      {isMinimized && (
        <View style={styles.minimizedOverlay} pointerEvents="box-none">
          <Animated.View 
            style={[
              styles.minimizedBar, 
              { borderColor: themeColors.borderColor, backgroundColor: "transparent" },
              {
                opacity: minimizeAnim,
                transform: [
                  {
                    translateY: minimizeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0]
                    })
                  },
                  {
                    scale: minimizeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: "hidden" }]}>
              <AppBlur style={StyleSheet.absoluteFill} intensity={80} />
            </View>

            <TouchableOpacity 
              style={styles.minimizedContent} 
              onPress={handleExpand}
              activeOpacity={0.7}
            >
              <View style={[styles.minimizedIcon, { backgroundColor: themeColors.accentColor + '20' }]}>
                <Ionicons name="pencil" size={18} color={themeColors.accentColor} />
              </View>
              <View style={{ flex: 1, paddingRight: 5 }}>
                <Text style={[styles.minimizedTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                  {Number.isInteger(lesson?.index) ? t('schedule.lesson_editor.editing', lang) : t('schedule.lesson_editor.new_lesson_ellipsis', lang)}
                </Text>
                <Text style={[styles.minimizedSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {currentSubject.name || t('schedule.lesson_editor.subject_not_selected', lang)}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.minimizedActions}>
              {selectedSubjectId && (
                <TouchableOpacity onPress={handleSave} style={styles.minimizedActionBtn}>
                  <Ionicons name="checkmark-circle" size={28} color={themeColors.accentColor} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleCloseMinimized} style={[styles.minimizedActionBtn, { marginLeft: 2 }]}>
                <Ionicons name="close-circle" size={28} color={themeColors.accentColor || "#ff4444"} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <Modal
        visible={!isMinimized}
        transparent={true}
        animationType="none"
        onRequestClose={onClose}
      >
        <BottomSheet
          ref={sheetRef}
          onClose={onClose}
          onMinimize={() => setIsMinimized(true)}
          backgroundColor={themeColors.backgroundColor}
          handleColor={themeColors.borderColor || "#ccc"}
          header={renderHeader()}
        >
          <View style={{ flex: 1 }}>
            {currentScreen === "main" && (
              <LessonEditorMainScreen
                themeColors={themeColors}
                selectedSubjectId={selectedSubjectId}
                currentSubject={currentSubject}
                gradients={localData.gradients}
                setActivePicker={handleOpenPicker}
                onDirectEdit={handleDirectEdit}
                onEditSubjectColor={() => goToScreen("subjectColor")}
                getLabel={getLabel}
                scopes={scopes}
                onScopeChange={(group, newScope) => setScopes(prev => ({ ...prev, [group]: newScope }))}
                getValueLabel={getValueLabel} 
                getArrayData={getArrayData}
              />
            )}

            {currentScreen === "subjectColor" && (
              <LessonEditorSubjectColorScreen 
                  themeColors={themeColors} 
                  currentSubject={currentSubject} 
                  gradients={localData.gradients}
                  onSelect={(updates) => {
                      handleUpdateSubject(updates);
                      goToScreen("main");
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
                alreadySelected={pickerData.alreadySelected}
                multiSelect={pickerData.multi}
                onSave={pickerData.onSave} 
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
                  onReset={inputData.onReset}
                  themeColors={themeColors}
              />
            )}

            {currentScreen === "teacherEditor" && (
                <TeacherEditor 
                  teacherId={editingItemData} 
                  localTeacherData={localData.teachers.find(t => t.id === editingItemData) || {}}
                  onSaveLocal={(updated) => {
                      setLocalData(prev => {
                          const exists = prev.teachers.some(t => t.id === updated.id);
                          return {
                              ...prev, 
                              teachers: exists 
                                  ? prev.teachers.map(t => t.id === updated.id ? updated : t) 
                                  : [...prev.teachers, updated] 
                          };
                      });
                      goToScreen(pickerType ? "picker" : "main"); 
                  }}
                  onBack={() => goToScreen(pickerType ? "picker" : "main")} 
                  themeColors={themeColors}
                />
            )}

            {currentScreen === "linkEditor" && (
                <LinkEditor 
                  linkId={editingItemData} 
                  localLinkData={localData.links.find(l => l.id === editingItemData) || {}}
                  onSaveLocal={(updated) => {
                      setLocalData(prev => {
                          const exists = prev.links.some(l => l.id === updated.id);
                          return {
                              ...prev, 
                              links: exists 
                                  ? prev.links.map(l => l.id === updated.id ? updated : l) 
                                  : [...prev.links, updated] 
                          };
                      });
                      goToScreen(pickerType ? "picker" : "main");
                  }}
                  onBack={() => goToScreen(pickerType ? "picker" : "main")} 
                  themeColors={themeColors}
                />
            )}
          </View>
        </BottomSheet>
      </Modal>
      
      {advancedPickerTarget && (
        <AdvancedColorPicker 
          visible={showAdvancedPicker} 
          initialColor={advancedPickerTarget.colorValue} 
          onSave={(color) => { advancedPickerTarget.setter(color); setShowAdvancedPicker(false); }} 
          onClose={() => setShowAdvancedPicker(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingBottom: 15, 
    borderBottomWidth: StyleSheet.hairlineWidth 
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: "600", 
    flex: 1, 
    textAlign: "center" 
  },
  backButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginLeft: -8 
  },
  minimizedOverlay: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 88, 
    zIndex: 999,
  },
  minimizedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    paddingLeft: 8,
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    ...Platform.select({
      web: { boxShadow: "0px 4px 12px rgba(0,0,0,0.15)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  minimizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 10,
  },
  minimizedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  minimizedTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  minimizedSubtitle: {
    fontSize: 11,
  },
  minimizedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    zIndex: 10,
  },
  minimizedActionBtn: {
    padding: 2,
  },
});
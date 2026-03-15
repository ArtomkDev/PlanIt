import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSchedule } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import { SUBJECT_ICONS } from "../../../config/subjectIcons"; 

import BottomSheet from "../../../components/BottomSheet";

import LessonEditorMainScreen from "./LessonEditor/screens/MainScreen";
import LessonEditorSubjectColorScreen from "./LessonEditor/screens/ColorScreen";
import LessonEditorGradientEditScreen from "./LessonEditor/screens/GradientScreen";
import LessonEditorPickerScreen from "./LessonEditor/screens/PickerScreen"; 
import LessonEditorInputScreen from "./LessonEditor/screens/InputScreen";

import TeacherEditor from "./LessonEditor/forms/TeacherForm";
import LinkEditor from "./LessonEditor/forms/LinkForm";
import AdvancedColorPicker from "../../../components/AdvancedColorPicker";

const deepClone = (data) => JSON.parse(JSON.stringify(data || []));
const generateLocalId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

export default function LessonEditor({ lesson, onClose }) {
  const { global, schedule, scheduleDraft, setScheduleDraft } = useSchedule();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

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
  }, [lesson]);

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
    // Якщо ми створювали/редагували предмет і натиснули назад, повертаємось до списку предметів
    if (currentScreen === "input" && pickerType === "subject") return goToScreen("picker");
    
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

      if (scopes.people === 'global') {
          delete lessonObject.teachers;
      }

      if (scopes.type === 'global') {
          delete lessonObject.type;
      }

      if (scopes.location === 'global') {
          delete lessonObject.building;
          delete lessonObject.room;
      }

      if (scopes.materials === 'global') {
          delete lessonObject.links;
      }

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
    
    sheetRef.current?.close();
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
            // Додаємо новий предмет ТІЛЬКИ якщо користувач натиснув "Зберегти"
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
        options.unshift({ key: 'none', label: '❌ Видалити слот' });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => {
                // НЕ додаємо об'єкт в localData одразу, лише відкриваємо форму з новим ID
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
        options.unshift({ key: 'none', label: '❌ Видалити слот' });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => {
                // НЕ додаємо об'єкт в localData одразу
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
        const types = ["Лекція", "Практика", "Лабораторна", "Семінар"];
        const scope = scopes.type;
        const hasLocal = instanceData.type !== undefined;
        const currentType = scope === 'local' ? (hasLocal ? instanceData.type : null) : currentSubject.type;

        return {
            options: types.map(t => ({ key: t, label: t })),
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
                // Одразу переходимо до вводу імені предмету, НЕ зберігаючи "пустишку"
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
            ph: "Наприклад: Головний",
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
            ph: "Наприклад: 204",
            onSave: (val) => handleGenericSave("room", val, 'location'),
            onReset: scope === 'local' && hasLocal ? () => handleResetLocal("room") : null
          };
      }
      if (inputType === "subject_rename") {
          const subj = localData.subjects.find(s => s.id === editingItemData);
          return {
              val: subj?.name || "", // Якщо об'єкта ще немає, повертаємо пустий рядок
              ph: "Назва предмету",
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
        
        if (list.length === 0) return "Не обрано";
        const source = type === "link" ? localData.links : localData.teachers;
        const names = list.map(id => source.find(item => item.id === id)?.name).filter(Boolean);
        if (names.length === 0) return "Не обрано";
        return names.join(", ");
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
      const isEmpty = !labelStr || labelStr === "Не обрано";

      return isEmpty ? "Не вказано" : labelStr;
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
      {currentScreen === "main" ? (
        <TouchableOpacity onPress={() => sheetRef.current?.close()} hitSlop={15}>
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>Скасувати</Text>
        </TouchableOpacity>
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
  );

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        onClose={onClose}
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
                // Передаємо пустий об'єкт, якщо викладача ще немає в масиві
                localTeacherData={localData.teachers.find(t => t.id === editingItemData) || {}}
                onSaveLocal={(updated) => {
                    setLocalData(prev => {
                        const exists = prev.teachers.some(t => t.id === updated.id);
                        return {
                            ...prev, 
                            teachers: exists 
                                ? prev.teachers.map(t => t.id === updated.id ? updated : t) 
                                : [...prev.teachers, updated] // Додаємо лише при збереженні
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
                // Передаємо пустий об'єкт, якщо посилання ще немає в масиві
                localLinkData={localData.links.find(l => l.id === editingItemData) || {}}
                onSaveLocal={(updated) => {
                    setLocalData(prev => {
                        const exists = prev.links.some(l => l.id === updated.id);
                        return {
                            ...prev, 
                            links: exists 
                                ? prev.links.map(l => l.id === updated.id ? updated : l) 
                                : [...prev.links, updated] // Додаємо лише при збереженні
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
});
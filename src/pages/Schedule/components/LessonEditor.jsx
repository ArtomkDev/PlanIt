import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Easing,
  Platform,
  Animated,
  Alert,
} from "react-native";
import { CaretLeft, X, PencilSimple, CheckCircle, XCircle } from "phosphor-react-native";
import { useScheduleActions, useScheduleData } from "../../../context/ScheduleProvider";
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import themes from "../../../config/themes";
import { SUBJECT_ICONS } from "../../../config/subjectIcons";
import {
  getContactIconComponent,
  getLinkIconComponent,
  getLinkTypeMeta,
  getTeacherContactTypeMeta,
} from "../../../config/contactTypes";
import { getTeacherAppearance, normalizeTeacherContacts } from "../../../utils/contactData";

import BottomSheet from "../../../components/ui/BottomSheet";
import AppBlur from "../../../components/ui/AppBlur";

import LessonEditorMainScreen from "./LessonEditor/screens/MainScreen";
import LessonEditorSubjectColorScreen from "./LessonEditor/screens/ColorScreen";
import LessonEditorGradientEditScreen from "./LessonEditor/screens/GradientScreen";
import LessonEditorPickerScreen from "./LessonEditor/screens/PickerScreen";
import LessonEditorInputScreen from "./LessonEditor/screens/InputScreen";

import TeacherEditor from "./LessonEditor/forms/TeacherForm";
import LinkEditor from "./LessonEditor/forms/LinkForm";
import AdvancedColorPicker from "../../../components/ui/AdvancedColorPicker";

import { t } from "../../../utils/i18n";
import { triggerHaptic } from "../../../utils/haptics";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import {
  deleteLocalAttachmentCaches,
  MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES,
  normalizeAttachmentDraftList,
  normalizeAttachmentLibrary,
  resolveAttachmentList,
} from "../../../services/attachmentService";
import {
  addMinutes,
  buildLessonTimes,
  buildScheduleSlots,
  materializeScheduleLessons,
  getDurationMinutes,
  normalizeScheduleRepeat,
  parseTimeToMinutes,
} from "../../../utils/scheduleTime";
import { removeScheduleEntity } from "../../../utils/scheduleDeletion";
import {
  applyLessonRecurrence,
  getLessonRecurrenceSelection,
} from "../../../utils/lessonRecurrence";

const deepClone = (data) => JSON.parse(JSON.stringify(data || []));
const generateLocalId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 8);


const EMPTY_ENTITY = Object.freeze({});

const getInitialEditorRoute = (initialEditTarget, dataSource, subjectId) => {
  const requestedTeacherId = initialEditTarget?.type === "teacher"
    ? initialEditTarget.teacherId
    : null;
  const canOpenRequestedTeacher = requestedTeacherId
    && (dataSource?.teachers || []).some((teacher) => teacher.id === requestedTeacherId);

  if (canOpenRequestedTeacher) {
    return {
      currentScreen: "teacherEditor",
      pickerType: null,
      inputType: null,
      editingItemData: requestedTeacherId,
    };
  }

  if (initialEditTarget?.type === "subject" || !subjectId) {
    const hasSubjects = (dataSource?.subjects || []).length > 0;
    return {
      currentScreen: hasSubjects ? "picker" : "input",
      pickerType: "subject",
      inputType: hasSubjects ? null : "subject_rename",
      editingItemData: hasSubjects ? null : generateLocalId(),
    };
  }

  return {
    currentScreen: "main",
    pickerType: null,
    inputType: null,
    editingItemData: null,
  };
};

export default function LessonEditor({ lesson, initialEditTarget = null, onClose }) {
  const { global, schedule, lang, user } = useScheduleData();
  const { setGlobalDraft, setScheduleDraft } = useScheduleActions();
  const { getDayIndex, calculateCurrentWeek, currentDate } = useDaySchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const reduceMotion = useReducedMotionPreference();

  const dataSource = schedule;

  const [localData, setLocalData] = useState({
    subjects: deepClone(dataSource?.subjects),
    teachers: deepClone(dataSource?.teachers),
    links: deepClone(dataSource?.links),
    gradients: deepClone(dataSource?.gradients),
  });

  const getCleanInstanceData = (data) => {
    if (!data || typeof data !== 'object') return {};
    const { subjectId, recurrence, ...rest } = data;
    return rest;
  };

  const [selectedSubjectId, setSelectedSubjectId] = useState(lesson?.subjectId || null);
  const initialTimingData = () => {
    const day = dataSource?.schedule?.[getDayIndex(currentDate)]?.[`week${calculateCurrentWeek(currentDate)}`] || [];
    const resolved = materializeScheduleLessons(dataSource, day);
    if (Number.isInteger(lesson?.index) && resolved[lesson.index]) return getCleanInstanceData(resolved[lesson.index]);
    const slots = buildScheduleSlots(dataSource?.start_time || "08:30", Number(dataSource?.duration) || 45, dataSource?.breaks || []);
    const times = buildLessonTimes(dataSource?.start_time || "08:30", Number(dataSource?.duration) || 45, dataSource?.breaks || [], day);
    const available = slots.find((slot) => !times.some((time, index) => day[index] && time.start < slot.end && slot.start < time.end));
    return available ? { timeMode: "slot", slotNumber: available.number } : { timeMode: "custom", startTime: "08:30", endTime: "09:15" };
  };
  const [instanceData, setInstanceData] = useState(initialTimingData);
  const [swapTiming] = useState(initialTimingData);
  const [slotConflict, setSlotConflict] = useState(null);
  const [conflictResolution, setConflictResolution] = useState(null);

  const dayIndex = getDayIndex(currentDate);
  const currentWeekNumber = calculateCurrentWeek(currentDate);
  const resolveInitialRecurrence = () => (
    getLessonRecurrenceSelection(dataSource, dayIndex, currentWeekNumber, lesson)
  );
  const [recurrenceSelection, setRecurrenceSelection] = useState(resolveInitialRecurrence);
  const [initialRecurrenceSelection, setInitialRecurrenceSelection] = useState(resolveInitialRecurrence);

  const start_time_global = dataSource?.start_time || "08:30";
  const duration_global = Number(dataSource?.duration) || 45;
  const breaks_global = dataSource?.breaks || [];

  const placementOptions = {
    dayIndex, weekNumber: currentWeekNumber,
    lessonIndex: Number.isInteger(lesson?.index) ? lesson.index : null,
    selection: recurrenceSelection, previousSelection: initialRecurrenceSelection, swapTiming,
  };
  const getSlotConflict = (slotNumber, source = schedule) => {
    const result = applyLessonRecurrence(source, {
      ...placementOptions, lesson: { timeMode: 'slot', slotNumber }, preview: true,
    });
    return { ...result, slotNumber, signature: JSON.stringify([slotNumber, recurrenceSelection, result.conflicts]) };
  };
  const timeSlots = useMemo(() => buildScheduleSlots(start_time_global, duration_global, breaks_global).map(slot => ({
    ...slot, occupied: getSlotConflict(slot.number).conflicts.length > 0,
  })), [start_time_global, duration_global, breaks_global, schedule, dayIndex, currentWeekNumber, lesson?.index, recurrenceSelection, initialRecurrenceSelection, swapTiming]);
  const storedDefaultTime = timeSlots.find((slot) => slot.number === instanceData.slotNumber) || timeSlots[0] || {};
  const selectSlot = (slotNumber) => setInstanceData((prev) => {
    const next = { ...prev, timeMode: "slot", slotNumber };
    delete next.startTime;
    delete next.endTime;
    return next;
  });
  const handleSlotChange = (slotNumber) => {
    const conflict = getSlotConflict(slotNumber);
    if (conflict.conflicts.length) {
      setSlotConflict(conflict);
      return;
    }
    setSlotConflict(null);
    setConflictResolution(null);
    selectSlot(slotNumber);
  };
  const handleConflictResolution = (action) => {
    if (action !== 'cancel') {
      setConflictResolution({ action, signature: slotConflict.signature });
      selectSlot(slotConflict.slotNumber);
    }
    setSlotConflict(null);
  };
  const handleTimeModeChange = (mode) => {
    setSlotConflict(null);
    setConflictResolution(null);
    if (mode === "slot") handleSlotChange(instanceData.slotNumber || timeSlots[0]?.number);
    else setInstanceData((prev) => ({ ...prev, timeMode: "custom", startTime: prev.startTime || storedDefaultTime.start, endTime: prev.endTime || storedDefaultTime.end }));
  };

  const [scopes, setScopes] = useState({
    people: 'global',
    type: 'global',
    location: 'global',
    materials: 'global',
    attachments: 'global'
  });

  const initialEditorRouteRef = useRef(null);
  if (!initialEditorRouteRef.current) {
    initialEditorRouteRef.current = getInitialEditorRoute(initialEditTarget, dataSource, lesson?.subjectId);
  }
  const didSyncInitialRouteRef = useRef(false);

  const [currentScreen, setCurrentScreen] = useState(initialEditorRouteRef.current.currentScreen);
  const mainScrollOffset = useRef(0);
  const screenOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    screenOpacity.stopAnimation();
    screenOpacity.setValue(reduceMotion ? 1 : 0.7);
    if (reduceMotion) return;
    const animation = Animated.timing(screenOpacity, {
      toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [currentScreen, reduceMotion, screenOpacity]);

  const [pickerType, setPickerType] = useState(initialEditorRouteRef.current.pickerType);
  const [inputType, setInputType] = useState(initialEditorRouteRef.current.inputType);
  const [editingItemData, setEditingItemData] = useState(initialEditorRouteRef.current.editingItemData);
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);
  const [attachAfterEdit, setAttachAfterEdit] = useState(false);
  const [relatedEditReturnScreen, setRelatedEditReturnScreen] = useState("main");

  const [editingGradient, setEditingGradient] = useState(null);
  const [showAdvancedPicker, setShowAdvancedPicker] = useState(false);
  const [advancedPickerTarget, setAdvancedPickerTarget] = useState(null);
  const [removedStoredAttachments, setRemovedStoredAttachments] = useState([]);
  const [attachmentUploadState, setAttachmentUploadState] = useState({ uploading: false });

  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeAnim = useRef(new Animated.Value(0)).current;

  const sheetRef = useRef(null);

  useEffect(() => {
    mainScrollOffset.current = 0;
    setSelectedSubjectId(lesson?.subjectId || null);

    const initialInstanceData = initialTimingData();
    setInstanceData(initialInstanceData);
    const nextRecurrence = resolveInitialRecurrence();
    setRecurrenceSelection(nextRecurrence);
    setInitialRecurrenceSelection(nextRecurrence);

    setScopes({
      people: initialInstanceData.teachers !== undefined ? 'local' : 'global',
      type: initialInstanceData.type !== undefined ? 'local' : 'global',
      location: (initialInstanceData.building !== undefined || initialInstanceData.room !== undefined) ? 'local' : 'global',
      materials: initialInstanceData.links !== undefined ? 'local' : 'global',
      attachments: initialInstanceData.attachments !== undefined ? 'local' : 'global'
    });

    setLocalData({
        subjects: deepClone(dataSource?.subjects),
        teachers: deepClone(dataSource?.teachers),
        links: deepClone(dataSource?.links),
        gradients: deepClone(dataSource?.gradients),
    });
    setRemovedStoredAttachments([]);
    setAttachmentUploadState({ uploading: false });

    const nextRoute = didSyncInitialRouteRef.current
      ? getInitialEditorRoute(initialEditTarget, dataSource, lesson?.subjectId)
      : initialEditorRouteRef.current;
    didSyncInitialRouteRef.current = true;

    setCurrentScreen(nextRoute.currentScreen);
    setEditingItemData(nextRoute.editingItemData);
    setPickerType(nextRoute.pickerType);
    setInputType(nextRoute.inputType);
    setEditingSlotIndex(null);
    setAttachAfterEdit(false);
    setRelatedEditReturnScreen("main");

    if (isMinimized) {
      handleExpand(false);
    }
  }, [initialEditTarget, lesson]);

  useEffect(() => {
    if (isMinimized) {
      if (reduceMotion) {
        minimizeAnim.setValue(1);
        return;
      }

      const animation = Animated.timing(minimizeAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      });
      animation.start();
      return () => animation.stop();
    } else {
      minimizeAnim.setValue(0);
    }
  }, [isMinimized, minimizeAnim, reduceMotion]);

  const handleExpand = (withHaptic = true) => {
    if (withHaptic) triggerHaptic("expand");
    if (reduceMotion) {
      minimizeAnim.setValue(0);
      setIsMinimized(false);
      return;
    }

    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => { if (finished) setIsMinimized(false); });
  };

  const closeEditor = () => {
    onClose?.();
  };

  const handleCloseMinimized = () => {
    triggerHaptic("sheetClose");
    if (reduceMotion) {
      minimizeAnim.setValue(0);
      closeEditor();
      return;
    }

    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => closeEditor());
  };

  const currentSubject = localData.subjects.find((s) => s.id === selectedSubjectId) || {};
  const fileLibrary = useMemo(
    () => normalizeAttachmentLibrary(global?.fileLibrary),
    [global?.fileLibrary]
  );
  const effectiveAttachmentRefs = scopes.attachments === 'global'
    ? normalizeAttachmentDraftList(currentSubject.attachments)
    : normalizeAttachmentDraftList(instanceData.attachments);

  const sanitizeArray = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.flat(Infinity).filter(id => id && id !== 0 && id !== "0");
  };

  const goToScreen = (screenName, data = null) => {
    Keyboard.dismiss();
    if (screenName === "main" && !selectedSubjectId) {
      setPickerType("subject");
      setInputType(null);
      setCurrentScreen("picker");
      return;
    }
    if (data !== null) setEditingItemData(data);
    setCurrentScreen(screenName);
  };

  const openNewSubjectInput = () => {
    const newId = generateLocalId();
    setPickerType("subject");
    setInputType("subject_rename");
    setAttachAfterEdit(false);
    goToScreen("input", newId);
  };
  const getRelatedEditReturnScreen = () => {
    return relatedEditReturnScreen === "picker" ? "picker" : "main";
  };

  const openNewRelatedItemEditor = (type, index = editingSlotIndex, returnScreen = "main") => {
    const newId = generateLocalId();
    setPickerType(type);
    setInputType(null);
    setEditingSlotIndex(index);
    setAttachAfterEdit(true);
    setRelatedEditReturnScreen(returnScreen);
    goToScreen(type === "teacher" ? "teacherEditor" : "linkEditor", newId);
  };

  const handleBack = () => {
    triggerHaptic("navigateBack");
    if (!selectedSubjectId && (currentScreen === "picker" || (currentScreen === "input" && localData.subjects.length === 0))) {
      sheetRef.current?.close();
      return;
    }
    if (currentScreen === "gradientEdit") return goToScreen("subjectColor");
    if (currentScreen === "teacherEditor") {
      setAttachAfterEdit(false);
      return goToScreen(getRelatedEditReturnScreen("teacher"));
    }
    if (currentScreen === "linkEditor") {
      setAttachAfterEdit(false);
      return goToScreen(getRelatedEditReturnScreen("link"));
    }

    if (currentScreen === "input" && inputType === "subject_rename") {
      return goToScreen(localData.subjects.length > 0 ? "picker" : "main");
    }

    if (["picker", "input", "subjectColor"].includes(currentScreen)) {
        return goToScreen("main");
    }
    goToScreen("main");
  };

  const getHeaderTitle = () => {
    switch (currentScreen) {
        case "main": return Number.isInteger(lesson?.index) ? t('schedule.lesson_editor.edit', lang) : t('schedule.lesson_editor.new_lesson', lang);
        case "subjectColor": return t('common.card_color', lang);
        case "gradientEdit": return t('schedule.lesson_editor.gradient_settings', lang);
        case "picker":
            if (pickerType === 'teacher') return t('schedule.lesson_editor.teachers', lang);
            if (pickerType === 'link') return t('common.links', lang);
            if (pickerType === 'subject') return t('schedule.lesson_editor.subjects', lang);
            if (pickerType === 'icon') return t('schedule.lesson_editor.choose_icon', lang);
            return t('schedule.lesson_editor.selection', lang);
        case "input":
            if (inputType === 'building') return t('common.building', lang);
            if (inputType === 'room') return t('common.room', lang);
            if (inputType === 'type') return t('common.class_type', lang);
            if (inputType === 'subject_rename') {
                const isExistingSubject = localData.subjects.some((subject) => subject.id === editingItemData);
                return isExistingSubject ? t('schedule.lesson_editor.change_name', lang) : t('schedule.lesson_editor.new_subject', lang);
            }
            return t('schedule.lesson_editor.input', lang);
        case "teacherEditor": {
            const isExistingTeacher = localData.teachers.some((teacher) => teacher.id === editingItemData);
            return isExistingTeacher ? t('schedule.lesson_editor.edit_teacher', lang) : t('schedule.lesson_editor.new_teacher', lang);
        }
        case "linkEditor": {
            const isExistingLink = localData.links.some((link) => link.id === editingItemData);
            return isExistingLink ? t('schedule.lesson_editor.edit_link', lang) : t('schedule.lesson_editor.new_link', lang);
        }
        default: return "";
    }
  };

  const handleSave = async () => {
    if (slotConflict) return;
    if (instanceData.timeMode === 'slot') {
      const conflict = getSlotConflict(instanceData.slotNumber);
      if (conflict.conflicts.length && conflictResolution?.signature !== conflict.signature) {
        setSlotConflict(conflict);
        setCurrentScreen('main');
        return;
      }
    }
    const start = parseTimeToMinutes(instanceData.timeMode === "slot" ? storedDefaultTime.start : instanceData.startTime);
    const end = parseTimeToMinutes(instanceData.timeMode === "slot" ? storedDefaultTime.end : instanceData.endTime);
    if (start === null || end === null || end <= start) {
      Alert.alert(t('schedule.main_screen.time', lang), t('schedule.lesson_editor.invalid_time', lang));
      return;
    }
    const draftAttachments = normalizeAttachmentDraftList(effectiveAttachmentRefs);
    const resolvedDraftAttachments = resolveAttachmentList(draftAttachments, fileLibrary);
    const hasPendingAttachments = resolvedDraftAttachments.some((attachment) => (
      !attachment?.fileId
      && (!attachment?.storagePath || !attachment?.downloadURL)
    ));

    if (attachmentUploadState.uploading || hasPendingAttachments) {
      triggerHaptic("error");
      setAttachmentUploadState({
        uploading: false,
        attachmentId: null,
        progress: 0,
        error: t('attachments.errors.upload_incomplete', lang),
      });
      return;
    }

    const persistedAttachments = normalizeAttachmentDraftList(draftAttachments);

    setScheduleDraft((prev) => {
      const next = { ...prev };
      const removedEntities = ["subjects", "teachers", "links", "gradients"].flatMap((collection) => {
        const retainedIds = new Set((localData[collection] || []).map((item) => item.id));
        return (prev[collection] || [])
          .filter((item) => !retainedIds.has(item.id))
          .map((item) => ({ collection, id: item.id }));
      });
      const finishDeletionCleanup = (candidate) => removedEntities.reduce(
        (current, { collection, id }) => removeScheduleEntity(current, collection, id),
        candidate,
      );

      next.subjects = localData.subjects;
      next.teachers = localData.teachers;
      next.links = localData.links;
      next.gradients = localData.gradients;

      const dayIndex = getDayIndex(currentDate);
      const weekKey = `week${calculateCurrentWeek(currentDate)}`;

      next.schedule = next.schedule ? [...next.schedule] : Array(7).fill(null).map(() => ({}));
      next.schedule[dayIndex] = next.schedule[dayIndex] ? { ...next.schedule[dayIndex] } : {};

      const weekArr = next.schedule[dayIndex][weekKey] ? [...next.schedule[dayIndex][weekKey]] : [];

      if (!selectedSubjectId && !Number.isInteger(lesson?.index)) {
          next.schedule[dayIndex][weekKey] = weekArr;
          return finishDeletionCleanup(next);
      }

      const lessonObject = { ...instanceData };
      if (selectedSubjectId) {
        lessonObject.subjectId = selectedSubjectId;
        delete lessonObject.subjectDeleted;
      } else {
        delete lessonObject.subjectId;
        lessonObject.subjectDeleted = true;
      }
      if (scopes.attachments === 'local' && persistedAttachments.length > 0) {
        lessonObject.attachments = persistedAttachments;
      } else {
        delete lessonObject.attachments;
      }

      if (scopes.people === 'global') delete lessonObject.teachers;
      if (scopes.type === 'global') delete lessonObject.type;
      if (scopes.location === 'global') {
          delete lessonObject.building;
          delete lessonObject.room;
      }
      if (scopes.materials === 'global') delete lessonObject.links;
      if (scopes.attachments === 'global') delete lessonObject.attachments;

      Object.keys(lessonObject).forEach(key => {
          if (lessonObject[key] === undefined || lessonObject[key] === null) {
              delete lessonObject[key];
          }
      });

      delete lessonObject.defaultStartTime;
      delete lessonObject.defaultEndTime;
      if (lessonObject.timeMode === "slot") {
        delete lessonObject.startTime;
        delete lessonObject.endTime;
      } else {
        delete lessonObject.slotNumber;
      }

      const withRecurrence = applyLessonRecurrence(next, {
        dayIndex,
        weekNumber: currentWeekNumber,
        lessonIndex: Number.isInteger(lesson?.index) ? lesson.index : null,
        lesson: lessonObject,
        selection: recurrenceSelection,
        previousSelection: initialRecurrenceSelection,
        conflictAction: instanceData.timeMode === 'slot' ? conflictResolution?.action : undefined,
        swapTiming,
      });

      return finishDeletionCleanup(withRecurrence);
    });

    const attachmentsToDelete = removedStoredAttachments;
    if (attachmentsToDelete.length > 0) {
      deleteLocalAttachmentCaches(attachmentsToDelete).catch(() => {});
    }
    setRemovedStoredAttachments([]);
    setAttachmentUploadState({ uploading: false });

    if (isMinimized) {
      triggerHaptic("success");
      Animated.timing(minimizeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => closeEditor());
    } else {
      triggerHaptic("success");
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

  const handleUpdateSubjectReminder = (nextReminder) => {
    if (!selectedSubjectId) return;
    setLocalData((prev) => {
      const nextSubjects = [...prev.subjects];
      const subjIndex = nextSubjects.findIndex((s) => s.id === selectedSubjectId);
      if (subjIndex === -1) return prev;

      const nextSubject = { ...nextSubjects[subjIndex] };
      if (nextReminder === undefined) {
        delete nextSubject.reminder;
      } else {
        nextSubject.reminder = nextReminder;
      }

      nextSubjects[subjIndex] = nextSubject;
      return { ...prev, subjects: nextSubjects };
    });
  };

  const handleUpdateInstance = (updates) => {
      setInstanceData(prev => ({ ...prev, ...updates }));
  };

  const handleAttachmentsChange = (nextAttachments) => {
    const cleanAttachments = normalizeAttachmentDraftList(nextAttachments);
    if (scopes.attachments === 'global') {
      handleUpdateSubject({ attachments: cleanAttachments });
      setInstanceData((prev) => {
        const next = { ...prev };
        delete next.attachments;
        return next;
      });
    } else {
      handleUpdateInstance({ attachments: cleanAttachments });
    }
  };

  const handleFileLibraryChange = (nextFiles) => {
    setGlobalDraft((prev) => ({
      ...prev,
      fileLibrary: normalizeAttachmentLibrary(nextFiles),
    }));
  };

  const handleRemoveStoredAttachment = (attachment) => {
    if (!attachment?.storagePath) return;
    setRemovedStoredAttachments((prev) => (
      prev.some((item) => item.storagePath === attachment.storagePath)
        ? prev
        : [...prev, attachment]
    ));
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

  const handleTimeChange = (field, value) => {
    if (!value) {
        setInstanceData(prev => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
        return;
    }

    if (field === "startTime") {
        const currentStart = instanceData.startTime !== undefined ? instanceData.startTime : storedDefaultTime.start;
        const currentEnd = instanceData.endTime !== undefined ? instanceData.endTime : storedDefaultTime.end;

        const duration = getDurationMinutes(currentStart, currentEnd);

        setInstanceData(prev => {
            const updates = { startTime: value };
            if (duration !== null) {
                const newEndTime = addMinutes(value, duration);
                if (newEndTime) {
                    updates.endTime = newEndTime;
                }
            }
            return { ...prev, ...updates };
        });
    } else {
        handleUpdateInstance({ [field]: value });
    }
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
          setCurrentScreen("main");
      } else {
          goToScreen("picker");
      }
    }
  };

  const handleSaveGradient = (newGradient) => {
    triggerHaptic("success");
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

  const handleDeleteEntity = (collection, id, name) => {
    if (!id) return;

    triggerHaptic("warning");
    Alert.alert(
      t("common.warning", lang),
      t("schedule.lesson_editor.delete_entity_confirm", lang, { name: name || t("common.untitled", lang) }),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        {
          text: t("common.delete", lang),
          style: "destructive",
          onPress: () => {
            triggerHaptic("success");
            setScheduleDraft((prev) => removeScheduleEntity(prev, collection, id));
            setLocalData((prev) => {
              const cleaned = removeScheduleEntity(
                { ...prev, schedule: [], tasks: [] },
                collection,
                id,
              );
              return {
                subjects: cleaned.subjects,
                teachers: cleaned.teachers,
                links: cleaned.links,
                gradients: cleaned.gradients,
              };
            });
            setInstanceData((prev) => {
              const cleaned = removeScheduleEntity(
                {
                  subjects: [],
                  teachers: [],
                  links: [],
                  gradients: [],
                  schedule: [{ week1: [prev] }],
                },
                collection,
                id,
              );
              return cleaned.schedule[0].week1[0];
            });
            if (collection === "subjects" && selectedSubjectId === id) {
              setSelectedSubjectId(null);
            }
            setAttachAfterEdit(false);
            if (collection === "subjects" && selectedSubjectId === id) {
              setPickerType("subject");
              goToScreen("picker");
            } else {
              goToScreen("main");
            }
          },
        },
      ],
    );
  };

  const handleOpenPicker = (type, index = null) => {
    if (["building", "room", "type"].includes(type)) {
        setInputType(type);
        setPickerType(null);
        setAttachAfterEdit(false);
        setRelatedEditReturnScreen("main");
        goToScreen("input");
        return;
    }

    if (type === "subject" && localData.subjects.length === 0) {
        setEditingSlotIndex(null);
        openNewSubjectInput();
        return;
    }

    setPickerType(type);
    setInputType(null);
    setEditingSlotIndex(index);
    setAttachAfterEdit(false);
    setRelatedEditReturnScreen("picker");
    goToScreen("picker");
  };

  const handleDirectEdit = (type, id, index) => {
    if (!id) return;
    triggerHaptic("open");
    setEditingSlotIndex(index);
    setPickerType(null);
    setAttachAfterEdit(false);
    setRelatedEditReturnScreen("main");

    if (type === "teacher") goToScreen("teacherEditor", id);
    if (type === "link") goToScreen("linkEditor", id);
  };

  const openAdvancedColorPicker = (colorValue, setter) => {
    triggerHaptic("open");
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

  const bindItemToCurrentSlot = (type, id) => {
      const field = type === "teacher" ? "teachers" : "links";
      const groupName = type === "teacher" ? "people" : "materials";
      const { array } = getArrayData(field, groupName);
      let nextArray = [...array];

      if (editingSlotIndex !== null && editingSlotIndex < nextArray.length) {
          nextArray[editingSlotIndex] = id;
      } else {
          nextArray.push(id);
      }

      handleGenericSave(field, [...new Set(nextArray)], groupName);
  };

  const getItemVisual = (type, id) => {
      if (type === "teacher") {
          const teacher = localData.teachers.find((item) => item.id === id);
          const appearance = getTeacherAppearance(teacher);
          return {
            icon: getContactIconComponent(appearance.icon, "user"),
            color: appearance.color,
          };
      }
      if (type === "link") {
          const link = localData.links.find((item) => item.id === id);
          const meta = getLinkTypeMeta(link?.type, link?.url);
          return { icon: getLinkIconComponent(link), color: link?.color || meta.color };
      }
      return null;
  };

  const getPickerData = () => {
    if (pickerType === "teacher") {
        const { array: cleanSelected } = getArrayData("teachers", "people");
        const currentSelectedId = editingSlotIndex !== null && editingSlotIndex < cleanSelected.length ? cleanSelected[editingSlotIndex] : null;
        const alreadySelected = cleanSelected.filter((_, i) => i !== editingSlotIndex);

        const options = localData.teachers.map((teacher) => {
            const primaryContact = normalizeTeacherContacts(teacher, () => "")[0];
            const meta = getTeacherContactTypeMeta(primaryContact?.type || "phone");
            const appearance = getTeacherAppearance(teacher);
            return {
                key: teacher.id,
                label: teacher.name,
                hint: primaryContact ? `${t(meta.labelKey, lang)} · ${primaryContact.label || primaryContact.value}` : null,
                iconComponent: getContactIconComponent(appearance.icon, "user"),
                iconColor: appearance.color,
            };
        });
        if (currentSelectedId) options.unshift({ key: 'none', label: t('schedule.lesson_editor.delete_slot', lang) });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => openNewRelatedItemEditor("teacher", editingSlotIndex, "picker"),
            onEdit: (id) => { if (id !== 'none') { setAttachAfterEdit(false); setRelatedEditReturnScreen("picker"); goToScreen("teacherEditor", id); } },
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

        const options = localData.links.map((link) => {
            const meta = getLinkTypeMeta(link.type, link.url);
            return {
                key: link.id,
                label: link.name,
                hint: t(meta.labelKey, lang),
                iconComponent: getLinkIconComponent(link),
                iconColor: link.color || meta.color,
            };
        });
        if (currentSelectedId) options.unshift({ key: 'none', label: t('schedule.lesson_editor.delete_slot', lang) });

        return {
            options,
            selected: currentSelectedId ? [currentSelectedId] : [],
            alreadySelected,
            multi: false,
            onAdd: () => openNewRelatedItemEditor("link", editingSlotIndex, "picker"),
            onEdit: (id) => { if (id !== 'none') { setAttachAfterEdit(false); setRelatedEditReturnScreen("picker"); goToScreen("linkEditor", id); } },
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

    if (pickerType === "subject") {
        return {
            options: localData.subjects.map((s) => ({ key: s.id, label: s.name })),
            selected: selectedSubjectId ? [selectedSubjectId] : [],
            multi: false,
            onAdd: openNewSubjectInput,
            onEdit: (id) => { setPickerType("subject"); setInputType("subject_rename"); goToScreen("input", id); },
            onSave: (key) => { setSelectedSubjectId(key); setCurrentScreen("main"); }
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
      if (inputType === "type") {
          const scope = scopes.type;
          const hasLocal = instanceData.type !== undefined;
          const currentType = scope === 'local' ? (hasLocal ? instanceData.type : "") : currentSubject.type;

          return {
            val: currentType || "",
            ph: t('common.class_type', lang),
            onSave: (val) => handleGenericSave("type", val, 'type'),
            onReset: scope === 'local' && hasLocal ? () => handleResetLocal("type") : null
          };
      }
      if (inputType === "subject_rename") {
          const subj = localData.subjects.find(s => s.id === editingItemData);
          return {
              val: subj?.name || "",
              ph: t('common.subject_name', lang),
              onSave: handleRenameSubject,
              onDelete: subj
                ? () => handleDeleteEntity("subjects", subj.id, subj.name)
                : null,
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

  const canSave = (selectedSubjectId !== null || Number.isInteger(lesson?.index)) && !attachmentUploadState.uploading;

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
      <TouchableOpacity
        style={styles.headerIcon}
        onPress={currentScreen === 'main' ? () => sheetRef.current?.close() : handleBack}
        accessibilityRole="button"
        accessibilityLabel={t(currentScreen === 'main' ? 'common.cancel' : 'common.back', lang)}
      >
        {currentScreen === 'main' ? <X size={22} color={themeColors.textColor2} /> : <CaretLeft size={24} color={themeColors.textColor} />}
      </TouchableOpacity>
      <Text accessibilityRole="header" style={[styles.headerTitle, { color: themeColors.textColor }]}>{getHeaderTitle()}</Text>
      {currentScreen === 'main' && <TouchableOpacity
        onPress={handleSave}
        disabled={!canSave}
        style={[styles.headerSave, { backgroundColor: themeColors.backgroundColor2, opacity: canSave ? 1 : 0.5 }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave, busy: attachmentUploadState.uploading }}
      >
        <Text style={[styles.headerSaveText, { color: themeColors.accentColor }]}>{t(attachmentUploadState.uploading ? 'attachments.uploading' : 'common.save', lang)}</Text>
      </TouchableOpacity>}
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
                      outputRange: [0.98, 1]
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
              onPress={() => handleExpand()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={(Number.isInteger(lesson?.index) ? t('schedule.lesson_editor.editing', lang) : t('schedule.lesson_editor.new_lesson_ellipsis', lang)) + ': ' + (currentSubject.name || t('schedule.lesson_editor.subject_not_selected', lang))}
            >
              <View style={[styles.minimizedIcon, { backgroundColor: themeColors.accentColor + '20' }]}>
                <PencilSimple size={18} color={themeColors.accentColor} weight="bold" />
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
              {canSave && (
                <TouchableOpacity onPress={handleSave} style={styles.minimizedActionBtn} accessibilityRole="button" accessibilityLabel={t('common.save', lang)}>
                  <CheckCircle size={30} color={themeColors.accentColor} weight="fill" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleCloseMinimized} style={[styles.minimizedActionBtn, { marginLeft: 2 }]} accessibilityRole="button" accessibilityLabel={t('common.close', lang)}>
                <XCircle size={30} color={themeColors.accentColor || "#ff4444"} weight="fill" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        visible={!isMinimized}
        onClose={closeEditor}
        onMinimize={() => {
          triggerHaptic("minimize");
          setIsMinimized(true);
        }}
        snapPoints={["62%", "92%"]}
        initialSnapIndex={1}
        maxWidth={800}
        backgroundColor={themeColors.backgroundColor}
        handleColor={themeColors.borderColor || "#ccc"}
        header={renderHeader()}
        enableContentPanningGesture={false}
        accessibilityLabel={getHeaderTitle()}
        closeAccessibilityLabel={t('common.close', lang)}
        testID="lesson-editor-sheet"
      >
          <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
            {currentScreen === "main" && (
              <LessonEditorMainScreen
                scrollOffsetRef={mainScrollOffset}
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
                instanceData={instanceData}
                defaultTime={storedDefaultTime}
                onTimeChange={handleTimeChange}
                timeSlots={timeSlots}
                onSlotChange={handleSlotChange}
                slotConflict={slotConflict}
                onConflictResolution={handleConflictResolution}
                onTimeModeChange={handleTimeModeChange}
                recurrenceSelection={recurrenceSelection}
                onRecurrenceChange={setRecurrenceSelection}
                scheduleRepeat={normalizeScheduleRepeat(schedule?.repeat)}
                currentWeekNumber={currentWeekNumber}
                onClearSubject={() => { setSelectedSubjectId(null); setPickerType("subject"); goToScreen("picker"); }}
                scheduleReminder={schedule?.reminder}
                onSubjectReminderChange={handleUpdateSubjectReminder}
                attachments={effectiveAttachmentRefs}
                onAttachmentsChange={handleAttachmentsChange}
                onRemoveStoredAttachment={handleRemoveStoredAttachment}
                onUploadedAttachments={null}
                onAttachmentUploadStateChange={setAttachmentUploadState}
                attachmentUploadState={attachmentUploadState}
                attachmentOwnerAvailable={!!user?.uid}
                attachmentUserId={user?.uid}
                fileLibrary={fileLibrary}
                getItemVisual={getItemVisual}
                onFileLibraryChange={handleFileLibraryChange}
                attachmentStorageLimitBytes={MAX_ACCOUNT_ATTACHMENT_STORAGE_BYTES}
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
                  onEditGradient={(grad) => {
                      setEditingGradient(grad);
                      goToScreen("gradientEdit");
                  }}
                  onAddGradient={() => {
                      const newG = { id: generateLocalId(), colors: ["#4facfe", "#00f2fe"] };
                      setLocalData(prev => ({ ...prev, gradients: [...prev.gradients, newG] }));
                      setEditingGradient(newG);
                      goToScreen("gradientEdit");
                  }}
              />
            )}

            {currentScreen === "gradientEdit" && editingGradient && (
              <LessonEditorGradientEditScreen
                themeColors={themeColors}
                gradientToEdit={editingGradient}
                onSave={handleSaveGradient}
                onDelete={() => handleDeleteEntity("gradients", editingGradient.id, editingGradient.name || t('schedule.lesson_editor.gradient_settings', lang))}
              />
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
                  onDelete={inputData.onDelete}
                  themeColors={themeColors}
                  saveLabel={inputType === "subject_rename" && !localData.subjects.some((subject) => subject.id === editingItemData) ? t("common.create", lang) : undefined}
                  autoFocusDelayMs={initialEditTarget?.type === "subject" && inputType === "subject_rename" ? 280 : 0}
              />
            )}

            {currentScreen === "teacherEditor" && (
                <TeacherEditor
                  teacherId={editingItemData}
                  localTeacherData={localData.teachers.find(t => t.id === editingItemData) || EMPTY_ENTITY}
                  initialContactId={
                    initialEditTarget?.type === "teacher" && initialEditTarget.teacherId === editingItemData
                      ? initialEditTarget.contactId
                      : null
                  }
                  initialContact={
                    initialEditTarget?.type === "teacher" && initialEditTarget.teacherId === editingItemData
                      ? initialEditTarget.contact
                      : null
                  }
                  onSaveLocal={(updated) => {
                      triggerHaptic("success");
                      setLocalData(prev => {
                          const exists = prev.teachers.some(t => t.id === updated.id);
                          return {
                              ...prev,
                              teachers: exists
                                  ? prev.teachers.map(t => t.id === updated.id ? updated : t)
                                  : [...prev.teachers, updated]
                          };
                      });
                      if (attachAfterEdit) {
                        bindItemToCurrentSlot("teacher", updated.id);
                        setAttachAfterEdit(false);
                      } else {
                        goToScreen(pickerType === "teacher" ? getRelatedEditReturnScreen("teacher") : "main");
                      }
                  }}
                  onDelete={localData.teachers.some(t => t.id === editingItemData)
                    ? () => handleDeleteEntity("teachers", editingItemData, localData.teachers.find(t => t.id === editingItemData)?.name)
                    : null}
                  onBack={() => {
                    triggerHaptic("navigateBack");
                    setAttachAfterEdit(false);
                    goToScreen(pickerType === "teacher" ? getRelatedEditReturnScreen("teacher") : "main");
                  }}
                  saveLabel={localData.teachers.some(t => t.id === editingItemData) ? undefined : t("common.create", lang)}
                  onOpenColorPicker={openAdvancedColorPicker}
                  themeColors={themeColors}
                />
            )}

            {currentScreen === "linkEditor" && (
                <LinkEditor
                  linkId={editingItemData}
                  localLinkData={localData.links.find(l => l.id === editingItemData) || EMPTY_ENTITY}
                  onSaveLocal={(updated) => {
                      triggerHaptic("success");
                      setLocalData(prev => {
                          const exists = prev.links.some(l => l.id === updated.id);
                          return {
                              ...prev,
                              links: exists
                                  ? prev.links.map(l => l.id === updated.id ? updated : l)
                                  : [...prev.links, updated]
                          };
                      });
                      if (attachAfterEdit) {
                        bindItemToCurrentSlot("link", updated.id);
                        setAttachAfterEdit(false);
                      } else {
                        goToScreen(pickerType === "link" ? getRelatedEditReturnScreen("link") : "main");
                      }
                  }}
                  onDelete={localData.links.some(l => l.id === editingItemData)
                    ? () => handleDeleteEntity("links", editingItemData, localData.links.find(l => l.id === editingItemData)?.name)
                    : null}
                  onBack={() => {
                    triggerHaptic("navigateBack");
                    setAttachAfterEdit(false);
                    goToScreen(pickerType === "link" ? getRelatedEditReturnScreen("link") : "main");
                  }}
                  saveLabel={localData.links.some(l => l.id === editingItemData) ? undefined : t("common.create", lang)}
                  onOpenColorPicker={openAdvancedColorPicker}
                  themeColors={themeColors}
                />
            )}
          </Animated.View>
      </BottomSheet>

      {advancedPickerTarget && (
        <AdvancedColorPicker
          visible={showAdvancedPicker}
          initialColor={advancedPickerTarget.colorValue}
          onSave={(color) => {
            advancedPickerTarget.setter(color);
            setShowAdvancedPicker(false);
          }}
          onClose={() => {
            setShowAdvancedPicker(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  headerSave: { minHeight: 44, maxWidth: '40%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, justifyContent: 'center' },
  headerSaveText: { fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  minimizedOverlay: {
    position: 'absolute',
    bottom: 16,
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
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});

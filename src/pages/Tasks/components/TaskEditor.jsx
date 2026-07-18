import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BookOpen,
  CalendarDots,
  CaretLeft,
  CheckCircle,
  Clock,
  Link as LinkIcon,
  NotePencil,
  Trash,
  XCircle,
} from "phosphor-react-native";

import CalendarSheet from "../../../components/CalendarSheet/CalendarSheet";
import AppBlur from "../../../components/ui/AppBlur";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import SettingsActionRow from "../../../components/ui/SettingsKit/SettingsActionRow";
import SettingsGroup from "../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../components/ui/SettingsKit/SettingsRow";
import { useScheduleData } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";
import { generateId } from "../../../utils/idGenerator";
import { t } from "../../../utils/i18n";
import { resolveScheduleColor } from "../../../utils/scheduleColors";
import { addScheduleRecordToMap } from "../../../utils/scheduleRecordMerge";
import {
  areLessonRefsSame,
  buildScheduleGroupedLessonCatalogue,
  createTaskDraftFromOccurrence,
  findNextLessonGroupOccurrence,
  formatLessonRefLabel as formatTaskLessonRefLabel,
  formatOccurrenceDayLabel,
  formatOccurrenceTimeLabel,
  getLocalISODate,
  listLessonGroupOccurrences,
  normalizeLessonRef,
  resolveLessonLinkIds,
  uniqueIds,
} from "../../../utils/taskLessonLinking";
import LinkEditor from "../../Schedule/components/LessonEditor/forms/LinkForm";
import LessonEditorPickerScreen from "../../Schedule/components/LessonEditor/screens/PickerScreen";

const deepCloneArray = (value) => JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));

const sanitizeIdArray = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter(Boolean))]
    : []
);

const getScheduleName = (schedule, lang) => (
  schedule?.name || t("settings.schedule_switcher.untitled", lang)
);

const getGroupTitle = (lessonGroup, lang) => (
  lessonGroup?.label
  || lessonGroup?.fullName
  || t("tasks.no_subject", lang)
);

const getGroupSubtitle = (lessonGroup) => (
  [lessonGroup?.fullName, lessonGroup?.lessonType].filter(Boolean).join(" - ")
);

const formatOccurrenceCount = (count, lang) => (
  t("tasks.editor.occurrences_count", lang).replace("{count}", String(count || 0))
);

const buildTaskEditorSessionKey = (task, sourceScheduleId) => {
  if (task?.id) {
    return JSON.stringify({
      type: "task",
      scheduleId: sourceScheduleId || null,
      taskId: task.id,
    });
  }

  const lessonRef = normalizeLessonRef(task?.lessonRef, sourceScheduleId);
  return JSON.stringify({
    type: "draft",
    scheduleId: sourceScheduleId || null,
    subjectId: task?.subjectId || null,
    text: task?.text || "",
    links: sanitizeIdArray(task?.links),
    lessonRef: lessonRef
      ? {
        scheduleId: lessonRef.scheduleId || null,
        subjectId: lessonRef.subjectId || null,
        date: lessonRef.date || null,
        weekKey: lessonRef.weekKey || null,
        lessonIndex: lessonRef.lessonIndex ?? null,
        start: lessonRef.start || null,
        end: lessonRef.end || null,
      }
      : null,
  });
};

const getInitialTaskEditorScreen = (task) => (
  task?.id || task?.text || task?.subjectId || task?.lessonRef ? "main" : "lessonPicker"
);

const buildDateOnlyLessonRef = (scheduleId, date, subjectId = null) => normalizeLessonRef({
  scheduleId,
  subjectId,
  date: getLocalISODate(date || new Date()),
}, scheduleId);

const getLessonRefDate = (lessonRef) => {
  if (!lessonRef?.date) return null;

  const date = new Date(`${String(lessonRef.date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getInitialTaskSubjectId = (task, fallbackScheduleId) => (
  task?.subjectId || normalizeLessonRef(task?.lessonRef, fallbackScheduleId)?.subjectId || null
);

const groupOccurrencesByDay = (schedule, occurrences, lang) => {
  const groups = [];
  const groupByKey = new Map();

  occurrences.forEach((occurrence) => {
    const key = getLocalISODate(occurrence.date);
    if (!groupByKey.has(key)) {
      const dayLabel = formatOccurrenceDayLabel(occurrence.date, lang);
      const weekLabel = formatOccurrenceWeekLabel(schedule, occurrence, lang);
      const group = {
        key,
        label: [dayLabel, weekLabel].filter(Boolean).join(" - "),
        items: [],
      };
      groupByKey.set(key, group);
      groups.push(group);
    }
    groupByKey.get(key).items.push(occurrence);
  });

  return groups;
};

const getOccurrenceEndTime = (occurrence) => (
  occurrence?.endAt?.getTime?.()
  || occurrence?.startAt?.getTime?.()
  || 0
);

const formatOccurrenceWeekLabel = (schedule, occurrence, lang) => {
  const repeatWeeks = Math.max(1, Number(schedule?.repeat) || 1);
  if (repeatWeeks <= 1) return "";

  const weekNumber = occurrence?.weekNumber
    || Number(String(occurrence?.weekKey || "").replace("week", ""));
  if (!Number.isFinite(weekNumber) || weekNumber <= 0) return "";

  return t("tasks.editor.week_label", lang).replace("{week}", String(weekNumber));
};

function LessonCatalogueScreen({
  schedules,
  selectedScheduleIds,
  selectedLessonRef,
  onOpenLessonGroup,
  onSkip,
  onClear,
  themeColors,
  lang,
}) {
  const [query, setQuery] = useState("");
  const catalogue = useMemo(() => (
    buildScheduleGroupedLessonCatalogue(schedules, { selectedScheduleIds })
  ), [schedules, selectedScheduleIds]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSections = useMemo(() => (
    catalogue
      .map((section) => ({
        ...section,
        schedules: section.schedules
          .map((record) => {
            const scheduleName = getScheduleName(record.schedule, lang);
            const scheduleMatches = normalizedQuery
              ? scheduleName.toLowerCase().includes(normalizedQuery)
              : false;
            const lessonGroups = record.lessonGroups.filter((lessonGroup) => {
              if (!normalizedQuery) return true;
              if (scheduleMatches) return true;

              const searchable = [
                lessonGroup.label,
                lessonGroup.fullName,
                lessonGroup.lessonType,
                lessonGroup.subject?.name,
                lessonGroup.subject?.fullName,
              ].filter(Boolean).join(" ").toLowerCase();

              return searchable.includes(normalizedQuery);
            });

            return lessonGroups.length > 0 ? { ...record, lessonGroups } : null;
          })
          .filter(Boolean),
      }))
      .filter((section) => section.schedules.length > 0)
  ), [catalogue, lang, normalizedQuery]);

  const renderLessonGroup = (record, lessonGroup) => {
    const selected = selectedLessonRef?.scheduleId === record.scheduleId
      && selectedLessonRef?.subjectId === lessonGroup.subjectId;
    const subtitle = getGroupSubtitle(lessonGroup);

    return (
      <TouchableOpacity
        key={lessonGroup.key}
        activeOpacity={0.76}
        onPress={() => onOpenLessonGroup(record, lessonGroup)}
        style={[
          styles.lessonGroupRow,
          {
            backgroundColor: selected ? themeColors.accentColor + "14" : themeColors.backgroundColor2,
            borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.lessonGroupIcon, { backgroundColor: themeColors.accentColor + "16" }]}>
          <BookOpen size={18} color={themeColors.accentColor} weight="bold" />
        </View>
        <View style={styles.lessonGroupBody}>
          <Text style={[styles.lessonGroupTitle, { color: themeColors.textColor }]} numberOfLines={1}>
            {getGroupTitle(lessonGroup, lang)}
          </Text>
          <Text style={[styles.lessonGroupSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
            {[subtitle, formatOccurrenceCount(lessonGroup.occurrenceCount, lang)].filter(Boolean).join(" - ")}
          </Text>
        </View>
        {selected && <CheckCircle size={21} color={themeColors.accentColor} weight="fill" />}
      </TouchableOpacity>
    );
  };

  return (
    <SheetScrollView
      contentContainerStyle={styles.lessonPickerContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        activeOpacity={0.76}
        onPress={onSkip}
        style={[
          styles.lessonActionRow,
          {
            backgroundColor: themeColors.accentColor + "14",
            borderColor: themeColors.accentColor + "30",
          },
        ]}
      >
        <XCircle size={20} color={themeColors.accentColor} weight="bold" />
        <View style={styles.lessonActionText}>
          <Text style={[styles.lessonActionTitle, { color: themeColors.textColor }]}>
            {t("tasks.editor.skip_lesson", lang)}
          </Text>
          <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
            {t("tasks.editor.skip_lesson_hint", lang)}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={[styles.lessonSearchBox, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("tasks.editor.lesson_search_placeholder", lang)}
          placeholderTextColor={themeColors.textColor2 + "80"}
          style={[styles.lessonSearchInput, { color: themeColors.textColor }]}
          returnKeyType="search"
        />
      </View>

      {!!selectedLessonRef && (
        <TouchableOpacity
          activeOpacity={0.76}
          onPress={onClear}
          style={[
            styles.lessonActionRow,
            {
              backgroundColor: themeColors.backgroundColor2,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <XCircle size={20} color={themeColors.textColor2} weight="bold" />
          <View style={styles.lessonActionText}>
            <Text style={[styles.lessonActionTitle, { color: themeColors.textColor }]}>
              {t("tasks.editor.no_linked_lesson", lang)}
            </Text>
            <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {t("tasks.editor.unlink_lesson_hint", lang)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {filteredSections.length === 0 ? (
        <View style={styles.lessonPickerEmpty}>
          <Text style={[styles.lessonPickerEmptyTitle, { color: themeColors.textColor }]}>
            {t("tasks.editor.no_lessons_found", lang)}
          </Text>
          <Text style={[styles.lessonPickerEmptyText, { color: themeColors.textColor2 }]}>
            {t("tasks.editor.no_lessons_found_desc", lang)}
          </Text>
        </View>
      ) : (
        filteredSections.map((section) => (
          <View key={section.key} style={styles.catalogueSection}>
            <Text style={[styles.catalogueSectionTitle, { color: themeColors.textColor2 }]}>
              {section.selected
                ? t("tasks.editor.selected_schedules", lang)
                : t("tasks.editor.other_schedules", lang)}
            </Text>

            {section.schedules.map((record) => {
              const scheduleColor = resolveScheduleColor(record.schedule, themeColors.accentColor);
              return (
                <View key={record.scheduleId} style={styles.catalogueSchedule}>
                  <View style={styles.catalogueScheduleHeader}>
                    <View style={[styles.scheduleDot, { backgroundColor: scheduleColor }]} />
                    <Text style={[styles.catalogueScheduleTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                      {getScheduleName(record.schedule, lang)}
                    </Text>
                  </View>
                  {record.lessonGroups.map((lessonGroup) => renderLessonGroup(record, lessonGroup))}
                </View>
              );
            })}
          </View>
        ))
      )}
    </SheetScrollView>
  );
}

function LessonOccurrenceScreen({
  schedule,
  lessonGroup,
  selectedLessonRef,
  dateFilter,
  onSelectOccurrence,
  onChooseDate,
  onClear,
  themeColors,
  lang,
}) {
  const occurrences = useMemo(() => (
    listLessonGroupOccurrences(schedule, lessonGroup, dateFilter
      ? { date: dateFilter, maxOccurrences: 80 }
      : {
        from: new Date(),
        horizonDays: 90,
        pastDays: 21,
        includePast: true,
        maxOccurrences: 260,
      })
  ), [dateFilter, lessonGroup, schedule]);

  const nextOccurrence = useMemo(() => (
    findNextLessonGroupOccurrence(schedule, lessonGroup, new Date())
  ), [lessonGroup, schedule]);

  const nowTime = Date.now();
  const upcomingOccurrences = dateFilter
    ? occurrences
    : occurrences.filter((occurrence) => getOccurrenceEndTime(occurrence) >= nowTime);
  const pastOccurrences = dateFilter
    ? []
    : occurrences
      .filter((occurrence) => getOccurrenceEndTime(occurrence) < nowTime)
      .sort((left, right) => right.startAt.getTime() - left.startAt.getTime());

  const upcomingGroups = groupOccurrencesByDay(schedule, upcomingOccurrences, lang);
  const pastGroups = groupOccurrencesByDay(schedule, pastOccurrences, lang);

  const renderOccurrence = (occurrence) => {
    const draft = createTaskDraftFromOccurrence(schedule, occurrence);
    if (!draft?.lessonRef) return null;

    const selected = areLessonRefsSame(selectedLessonRef, draft.lessonRef);
    const timeLabel = formatOccurrenceTimeLabel(occurrence);
    const lessonNumber = Number.isInteger(occurrence.lessonIndex) ? occurrence.lessonIndex + 1 : null;
    const roomLabel = [
      occurrence.lessonData?.building || occurrence.subject?.building,
      occurrence.lessonData?.room || occurrence.subject?.room,
    ].filter(Boolean).join(", ");
    const subtitle = [
      occurrence.lessonData?.type || occurrence.subject?.type,
      roomLabel,
    ].filter(Boolean).join(" - ");

    return (
      <TouchableOpacity
        key={`${draft.lessonRef.date}:${draft.lessonRef.weekKey}:${draft.lessonRef.lessonIndex}`}
        activeOpacity={0.76}
        onPress={() => onSelectOccurrence(schedule, occurrence)}
        style={[
          styles.lessonOptionCard,
          {
            backgroundColor: selected ? themeColors.accentColor + "16" : themeColors.backgroundColor2,
            borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.lessonOptionNumber, { backgroundColor: themeColors.accentColor + "16" }]}>
          <Text style={[styles.lessonOptionNumberText, { color: themeColors.accentColor }]}>
            {lessonNumber || "-"}
          </Text>
          <Text style={[styles.lessonOptionNumberLabel, { color: themeColors.accentColor }]} numberOfLines={1}>
            {t("tasks.editor.lesson_number_short", lang)}
          </Text>
        </View>
        <View style={styles.lessonOptionBody}>
          <View style={styles.lessonOptionTimeRow}>
            <Clock size={17} color={themeColors.accentColor} weight="bold" />
            <Text style={[styles.lessonOptionTimeTitle, { color: themeColors.textColor }]} numberOfLines={1}>
              {timeLabel || "--:--"}
            </Text>
          </View>
          {!!subtitle && (
            <Text style={[styles.lessonOptionMeta, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {selected && <CheckCircle size={22} color={themeColors.accentColor} weight="fill" />}
      </TouchableOpacity>
    );
  };

  const renderOccurrenceGroups = (title, groups) => {
    if (groups.length === 0) return null;

    return (
      <View style={styles.lessonPickerSection}>
        <Text style={[styles.lessonPickerSectionTitle, { color: themeColors.textColor2 }]}>
          {title}
        </Text>
        {groups.map((group) => (
          <View key={group.key} style={styles.dayGroup}>
            <Text style={[styles.dayGroupTitle, { color: themeColors.textColor }]} numberOfLines={1}>
              {group.label}
            </Text>
            {group.items.map(renderOccurrence)}
          </View>
        ))}
      </View>
    );
  };

  const nextLabel = nextOccurrence
    ? [
      formatOccurrenceDayLabel(nextOccurrence.date, lang),
      formatOccurrenceWeekLabel(schedule, nextOccurrence, lang),
      formatOccurrenceTimeLabel(nextOccurrence),
    ]
      .filter(Boolean)
      .join(" - ")
    : t("tasks.editor.no_upcoming_occurrence", lang);

  return (
    <SheetScrollView
      contentContainerStyle={styles.lessonPickerContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.lessonActionsStack}>
        <TouchableOpacity
          activeOpacity={0.76}
          disabled={!nextOccurrence}
          onPress={() => nextOccurrence && onSelectOccurrence(schedule, nextOccurrence)}
          style={[
            styles.lessonActionRow,
            {
              backgroundColor: themeColors.accentColor + "15",
              borderColor: themeColors.accentColor + "35",
              opacity: nextOccurrence ? 1 : 0.5,
            },
          ]}
        >
          <CalendarDots size={20} color={themeColors.accentColor} weight="bold" />
          <View style={styles.lessonActionText}>
            <Text style={[styles.lessonActionTitle, { color: themeColors.textColor }]}>
              {t("tasks.editor.bind_next_same_lesson", lang)}
            </Text>
            <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {nextLabel}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.76}
          onPress={onChooseDate}
          style={[
            styles.lessonActionRow,
            {
              backgroundColor: themeColors.backgroundColor2,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <CalendarDots size={20} color={themeColors.textColor2} weight="bold" />
          <View style={styles.lessonActionText}>
            <Text style={[styles.lessonActionTitle, { color: themeColors.textColor }]}>
              {dateFilter
                ? t("tasks.editor.choose_another_date", lang)
                : t("tasks.editor.choose_date", lang)}
            </Text>
            {!!dateFilter && (
              <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {formatOccurrenceDayLabel(dateFilter, lang)}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.76}
          onPress={onClear}
          style={[
            styles.lessonActionRow,
            {
              backgroundColor: themeColors.backgroundColor2,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          <XCircle size={20} color={themeColors.textColor2} weight="bold" />
          <View style={styles.lessonActionText}>
            <Text style={[styles.lessonActionTitle, { color: themeColors.textColor }]}>
              {t("tasks.editor.no_linked_lesson", lang)}
            </Text>
            <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {t("tasks.editor.unlink_lesson_hint", lang)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {dateFilter ? (
        occurrences.length === 0 ? (
          <View style={styles.lessonPickerEmpty}>
            <Text style={[styles.lessonPickerEmptyTitle, { color: themeColors.textColor }]}>
              {t("tasks.editor.no_occurrences_on_date", lang)}
            </Text>
            <Text style={[styles.lessonPickerEmptyText, { color: themeColors.textColor2 }]}>
              {t("tasks.editor.no_occurrences_on_date_desc", lang)}
            </Text>
          </View>
        ) : (
          renderOccurrenceGroups(t("tasks.editor.selected_date_occurrences", lang), upcomingGroups)
        )
      ) : (
        <>
          {upcomingGroups.length === 0 && pastGroups.length === 0 ? (
            <View style={styles.lessonPickerEmpty}>
              <Text style={[styles.lessonPickerEmptyTitle, { color: themeColors.textColor }]}>
                {t("tasks.editor.no_lessons_found", lang)}
              </Text>
              <Text style={[styles.lessonPickerEmptyText, { color: themeColors.textColor2 }]}>
                {t("tasks.editor.no_lessons_found_desc", lang)}
              </Text>
            </View>
          ) : (
            <>
              {renderOccurrenceGroups(t("tasks.editor.upcoming_occurrences", lang), upcomingGroups)}
              {renderOccurrenceGroups(t("tasks.editor.past_occurrences", lang), pastGroups)}
            </>
          )}
        </>
      )}
    </SheetScrollView>
  );
}

export default function TaskEditor({
  task,
  sourceSchedule,
  selectedScheduleIds = [],
  onSave,
  onDelete,
  onClose,
}) {
  const { global, schedule, schedules, lang } = useScheduleData();
  const sheetRef = useRef(null);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);

  const allSchedules = useMemo(() => {
    const map = new Map();
    const addScheduleToMap = (item) => {
      addScheduleRecordToMap(map, item, global);
    };

    (Array.isArray(schedules) ? schedules : []).forEach(addScheduleToMap);
    addScheduleToMap(schedule);
    addScheduleToMap(sourceSchedule);

    return Array.from(map.values());
  }, [global, schedule, schedules, sourceSchedule]);

  const scheduleById = useMemo(() => {
    const map = new Map();
    allSchedules.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return map;
  }, [allSchedules]);

  const getInitialTargetScheduleId = () => {
    const taskLessonRef = normalizeLessonRef(task?.lessonRef, sourceSchedule?.id);
    return taskLessonRef?.scheduleId
      || sourceSchedule?.id
      || schedule?.id
      || allSchedules[0]?.id
      || null;
  };

  const [targetScheduleId, setTargetScheduleId] = useState(getInitialTargetScheduleId);
  const targetSchedule = scheduleById.get(targetScheduleId)
    || sourceSchedule
    || schedule
    || allSchedules[0]
    || null;

  const subjects = useMemo(() => (
    Array.isArray(targetSchedule?.subjects) ? targetSchedule.subjects : []
  ), [targetSchedule]);

  const [currentScreen, setCurrentScreen] = useState(() => getInitialTaskEditorScreen(task));
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => getInitialTaskSubjectId(task, targetSchedule?.id));
  const [text, setText] = useState(task?.text || "");
  const [selectedLinks, setSelectedLinks] = useState(() => sanitizeIdArray(task?.links));
  const [selectedLessonRef, setSelectedLessonRef] = useState(() => normalizeLessonRef(task?.lessonRef, targetSchedule?.id));
  const [localLinks, setLocalLinks] = useState(() => deepCloneArray(targetSchedule?.links));
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [selectedLessonGroup, setSelectedLessonGroup] = useState(null);
  const [lessonDateFilter, setLessonDateFilter] = useState(null);
  const [lessonCalendarVisible, setLessonCalendarVisible] = useState(false);
  const [lessonCalendarPurpose, setLessonCalendarPurpose] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const minimizeAnim = useRef(new Animated.Value(0)).current;
  const editorSessionKey = useMemo(
    () => buildTaskEditorSessionKey(task, sourceSchedule?.id),
    [sourceSchedule?.id, task?.id, task?.lessonRef, task?.links, task?.subjectId, task?.text]
  );
  const previousEditorSessionKeyRef = useRef(editorSessionKey);

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
    }).start(() => onClose?.());
  };

  useEffect(() => {
    if (previousEditorSessionKeyRef.current === editorSessionKey) return;
    previousEditorSessionKeyRef.current = editorSessionKey;

    const nextLessonRef = normalizeLessonRef(task?.lessonRef, sourceSchedule?.id);
    const nextScheduleId = nextLessonRef?.scheduleId
      || sourceSchedule?.id
      || schedule?.id
      || allSchedules[0]?.id
      || null;
    const nextSchedule = scheduleById.get(nextScheduleId) || sourceSchedule || schedule || allSchedules[0] || null;

    setCurrentScreen(getInitialTaskEditorScreen(task));
    setTargetScheduleId(nextSchedule?.id || null);
    setSelectedSubjectId(task?.subjectId || nextLessonRef?.subjectId || null);
    setText(task?.text || "");
    setSelectedLinks(sanitizeIdArray(task?.links));
    setSelectedLessonRef(nextLessonRef);
    setLocalLinks(deepCloneArray(nextSchedule?.links));
    setEditingLinkId(null);
    setSelectedLessonGroup(null);
    setLessonDateFilter(null);
    setLessonCalendarVisible(false);
    setLessonCalendarPurpose(null);

    if (isMinimized) {
      handleExpand();
    }
  }, [allSchedules, editorSessionKey, isMinimized, schedule, scheduleById, sourceSchedule, task]);

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
  }, [isMinimized, minimizeAnim]);

  if (!targetSchedule) return null;

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const resolvedSubjectId = selectedSubject ? selectedSubjectId : null;
  const selectedLinkObjects = selectedLinks
    .map((id) => localLinks.find((link) => link.id === id))
    .filter(Boolean);
  const canSave = text.trim().length > 0;
  const isInitialLessonPicker = currentScreen === "lessonPicker"
    && !task?.id
    && !text.trim()
    && !selectedSubjectId
    && !selectedLessonRef;
  const linkedLessonLabel = (() => {
    const ref = normalizeLessonRef(selectedLessonRef, targetSchedule.id);
    if (!ref) return "";

    const refSchedule = scheduleById.get(ref.scheduleId) || targetSchedule;
    const refSubjects = Array.isArray(refSchedule?.subjects) ? refSchedule.subjects : [];
    const refSubject = ref.subjectId
      ? refSubjects.find((subject) => subject.id === ref.subjectId)
      : null;
    const pieces = [];

    if (allSchedules.length > 1) pieces.push(getScheduleName(refSchedule, lang));
    if (refSubject?.name) pieces.push(refSubject.name);

    const lessonLabel = formatTaskLessonRefLabel(ref, lang);
    if (lessonLabel) pieces.push(lessonLabel);

    return pieces.join(" - ");
  })();

  const getScreenTitle = () => {
    if (currentScreen === "lessonPicker") return t("tasks.editor.choose_lesson", lang);
    if (currentScreen === "lessonOccurrence") {
      return getGroupTitle(selectedLessonGroup?.lessonGroup, lang);
    }
    if (currentScreen === "linkPicker") return t("tasks.editor.links", lang);
    if (currentScreen === "linkEditor") return t("tasks.editor.edit_link", lang);
    return task?.id ? t("tasks.editor.edit_task", lang) : t("tasks.editor.new_task", lang);
  };

  const goBack = () => {
    if (currentScreen === "linkEditor") {
      setCurrentScreen("linkPicker");
      return;
    }
    if (currentScreen === "lessonOccurrence") {
      setLessonDateFilter(null);
      setCurrentScreen("lessonPicker");
      return;
    }
    setCurrentScreen("main");
  };

  const closeSheet = () => {
    sheetRef.current?.close();
  };

  const dismissEditor = () => {
    if (isMinimized) {
      handleCloseMinimized();
      return;
    }

    closeSheet();
  };

  const handleSave = () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const now = Date.now();
    const taskId = task?.id || generateId();
    const lessonRef = normalizeLessonRef(selectedLessonRef, targetSchedule.id);
    const nextTask = {
      ...(task || {}),
      id: taskId,
      subjectId: resolvedSubjectId,
      text: trimmedText,
      links: sanitizeIdArray(selectedLinks),
      lessonRef: lessonRef || null,
      completed: task?.completed === true,
      createdAt: task?.createdAt || now,
      updatedAt: now,
    };

    onSave?.({
      scheduleId: targetSchedule.id,
      task: nextTask,
      links: localLinks,
    });

    dismissEditor();
  };

  const deleteTask = () => {
    if (!task?.id) return;

    onDelete?.(sourceSchedule?.id || targetSchedule.id, task.id);
    dismissEditor();
  };

  const handleDelete = () => {
    Alert.alert(
      t("common.warning", lang),
      t("tasks.editor.delete_confirm", lang),
      [
        { text: t("common.cancel", lang), style: "cancel" },
        { text: t("common.delete", lang), style: "destructive", onPress: deleteTask },
      ]
    );
  };

  const handleSaveLink = (updatedLink) => {
    setLocalLinks((prev) => {
      const exists = prev.some((link) => link.id === updatedLink.id);
      return exists
        ? prev.map((link) => (link.id === updatedLink.id ? updatedLink : link))
        : [...prev, updatedLink];
    });
    setSelectedLinks((prev) => sanitizeIdArray([...prev, updatedLink.id]));
    setCurrentScreen("linkPicker");
  };

  const mergeDraftLinks = (nextSchedule, linkIds, scheduleChanged) => {
    if (scheduleChanged) {
      setLocalLinks(deepCloneArray(nextSchedule?.links));
      setSelectedLinks(sanitizeIdArray(linkIds));
      return;
    }

    setSelectedLinks((previous) => sanitizeIdArray([...previous, ...(linkIds || [])]));
  };

  const applyLessonDraft = (nextSchedule, draft) => {
    if (!nextSchedule?.id || !draft?.lessonRef) return;

    const scheduleChanged = nextSchedule.id !== targetSchedule.id;
    setTargetScheduleId(nextSchedule.id);
    setSelectedLessonRef(draft.lessonRef);
    setSelectedSubjectId(draft.subjectId || null);

    mergeDraftLinks(nextSchedule, draft.linkIds, scheduleChanged);
  };

  const applyDateOnlyDraft = (nextSchedule, date, lessonGroup = null) => {
    if (!nextSchedule?.id) return;

    const subjectId = lessonGroup?.subjectId || null;
    const lessonRef = buildDateOnlyLessonRef(nextSchedule.id, date, subjectId);
    const scheduleChanged = nextSchedule.id !== targetSchedule.id;

    setTargetScheduleId(nextSchedule.id);
    setSelectedSubjectId(subjectId);
    setSelectedLessonRef(lessonRef);
    setLessonDateFilter(null);
    setSelectedLessonGroup(null);
    setLessonCalendarVisible(false);
    setLessonCalendarPurpose(null);
    mergeDraftLinks(nextSchedule, resolveLessonLinkIds(nextSchedule, {}, subjectId), scheduleChanged);
    setCurrentScreen("main");
  };

  const openTaskDateCalendar = () => {
    setSelectedLessonGroup(null);
    setLessonDateFilter(null);
    setLessonCalendarPurpose("taskDate");
    setLessonCalendarVisible(true);
  };

  const openLessonGroupDateCalendar = () => {
    setLessonCalendarPurpose("lessonGroupDate");
    setLessonCalendarVisible(true);
  };

  const handleSelectLessonOccurrence = (occurrenceSchedule, occurrence) => {
    const draft = createTaskDraftFromOccurrence(occurrenceSchedule, occurrence);
    if (!draft?.lessonRef) return;

    applyLessonDraft(occurrenceSchedule, draft);
    setLessonDateFilter(null);
    setLessonCalendarPurpose(null);
    setCurrentScreen("main");
  };

  const handleClearLesson = () => {
    setSelectedLessonRef(null);
    setSelectedSubjectId(null);
    setLessonDateFilter(null);
    setCurrentScreen("main");
  };

  const handleOpenLessonGroup = (record, lessonGroup) => {
    setSelectedLessonGroup({
      scheduleId: record.scheduleId,
      lessonGroup,
    });
    setSelectedSubjectId(lessonGroup?.subjectId || null);
    setLessonDateFilter(null);
    setCurrentScreen("lessonOccurrence");
  };

  const selectedOccurrenceSchedule = selectedLessonGroup?.scheduleId
    ? scheduleById.get(selectedLessonGroup.scheduleId)
    : null;

  const handleCalendarSkip = () => {
    const today = new Date();
    if (lessonCalendarPurpose === "lessonGroupDate") {
      applyDateOnlyDraft(selectedOccurrenceSchedule || targetSchedule, today, selectedLessonGroup?.lessonGroup);
      return;
    }

    applyDateOnlyDraft(targetSchedule, today);
  };

  const handleDateSelect = (date) => {
    if (lessonCalendarPurpose === "taskDate") {
      applyDateOnlyDraft(targetSchedule, date);
      return;
    }

    if (lessonCalendarPurpose === "lessonGroupDate") {
      const occurrenceSchedule = selectedOccurrenceSchedule || targetSchedule;
      const occurrencesOnDate = listLessonGroupOccurrences(occurrenceSchedule, selectedLessonGroup?.lessonGroup, {
        date,
        maxOccurrences: Number.POSITIVE_INFINITY,
      });

      if (occurrencesOnDate.length === 0) {
        applyDateOnlyDraft(occurrenceSchedule, date, selectedLessonGroup?.lessonGroup);
        return;
      }

      setLessonDateFilter(date);
      setLessonCalendarPurpose(null);
      setCurrentScreen("lessonOccurrence");
      setLessonCalendarVisible(false);
      return;
    }

    setLessonDateFilter(date);
    setLessonCalendarVisible(false);
    setLessonCalendarPurpose(null);
  };

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: themeColors.borderColor }]}>
      {currentScreen === "main" || isInitialLessonPicker ? (
        <TouchableOpacity onPress={closeSheet} hitSlop={15}>
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t("common.cancel", lang)}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={15}>
          <CaretLeft size={24} color={themeColors.accentColor} weight="bold" />
          <Text style={{ color: themeColors.accentColor, fontSize: 17 }}>{t("common.back", lang)}</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.headerTitle, { color: themeColors.textColor }]} numberOfLines={1}>
        {getScreenTitle()}
      </Text>

      <View style={styles.headerRight}>
        {currentScreen === "main" && (
          <TouchableOpacity onPress={handleSave} disabled={!canSave} hitSlop={15}>
            <Text style={{ color: canSave ? themeColors.accentColor : themeColors.textColor2, fontSize: 17, fontWeight: "600" }}>
              {t("common.done", lang)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderLinksValue = () => {
    if (selectedLinkObjects.length === 0) return t("tasks.editor.no_links", lang);
    return t("tasks.editor.links_count", lang).replace("{count}", String(selectedLinkObjects.length));
  };

  const renderMain = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      enabled={Platform.OS === "ios"}
      keyboardVerticalOffset={110}
    >
      <SheetScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.lesson", lang)}>
          <SettingsRow
            label={t("tasks.editor.linked_lesson", lang)}
            value={linkedLessonLabel || t("tasks.editor.no_linked_lesson", lang)}
            desc={t("tasks.editor.linked_lesson_hint", lang)}
            onPress={() => setCurrentScreen("lessonPicker")}
            themeColors={themeColors}
            icon={CalendarDots}
            iconWeight="bold"
          />
        </SettingsGroup>

        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.task_text", lang)}>
          <View style={[styles.textAreaWrap, { backgroundColor: themeColors.backgroundColor2 }]}>
            <NotePencil size={22} color={themeColors.textColor2} weight="bold" style={styles.textAreaIcon} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t("tasks.editor.task_text_placeholder", lang)}
              placeholderTextColor={themeColors.textColor2 + "80"}
              style={[styles.textArea, { color: themeColors.textColor }]}
              multiline
              textAlignVertical="top"
            />
          </View>
        </SettingsGroup>

        <SettingsGroup themeColors={themeColors} title={t("tasks.editor.links", lang)}>
          <SettingsRow
            label={t("tasks.editor.attach_links", lang)}
            value={renderLinksValue()}
            onPress={() => setCurrentScreen("linkPicker")}
            themeColors={themeColors}
            icon={LinkIcon}
          />

          {selectedLinkObjects.map((link) => (
            <SettingsRow
              key={link.id}
              label={link.name || t("tasks.default_link", lang)}
              desc={link.url}
              onPress={() => {
                setEditingLinkId(link.id);
                setCurrentScreen("linkEditor");
              }}
              themeColors={themeColors}
              icon={LinkIcon}
            />
          ))}
        </SettingsGroup>

        {task?.id && (
          <SettingsActionRow
            icon={Trash}
            label={t("tasks.editor.delete_task", lang)}
            onPress={handleDelete}
            danger
            themeColors={themeColors}
          />
        )}
      </SheetScrollView>
    </KeyboardAvoidingView>
  );

  const minimizedTitle = task?.id ? t("tasks.editor.edit_task", lang) : t("tasks.editor.new_task", lang);
  const minimizedSubtitle = selectedSubject?.name || linkedLessonLabel || text.trim() || t("tasks.editor.no_subject", lang);
  const calendarCurrentDate = lessonDateFilter || getLessonRefDate(selectedLessonRef) || new Date();

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
                      outputRange: [40, 0],
                    }),
                  },
                  {
                    scale: minimizeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.85, 1],
                    }),
                  },
                ],
              },
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
              <View style={[styles.minimizedIcon, { backgroundColor: themeColors.accentColor + "20" }]}>
                <NotePencil size={18} color={themeColors.accentColor} weight="bold" />
              </View>
              <View style={styles.minimizedText}>
                <Text style={[styles.minimizedTitle, { color: themeColors.textColor }]} numberOfLines={1}>
                  {minimizedTitle}
                </Text>
                <Text style={[styles.minimizedSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
                  {minimizedSubtitle}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.minimizedActions}>
              {canSave && (
                <TouchableOpacity onPress={handleSave} style={styles.minimizedActionBtn}>
                  <CheckCircle size={30} color={themeColors.accentColor} weight="fill" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleCloseMinimized} style={[styles.minimizedActionBtn, { marginLeft: 2 }]}>
                <XCircle size={30} color={themeColors.accentColor} weight="fill" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        visible={!isMinimized}
        onClose={onClose}
        onMinimize={() => setIsMinimized(true)}
        snapPoints={["62%", "92%"]}
        initialSnapIndex={1}
        maxWidth={800}
        backgroundColor={themeColors.backgroundColor}
        handleColor={themeColors.borderColor || "#ccc"}
        header={renderHeader()}
        enableContentPanningGesture={false}
        accessibilityLabel={getScreenTitle()}
        closeAccessibilityLabel={t("common.close", lang)}
        testID="task-editor-sheet"
      >
        <View style={{ flex: 1 }}>
          {currentScreen === "main" && renderMain()}

          {currentScreen === "lessonPicker" && (
            <LessonCatalogueScreen
              schedules={allSchedules}
              selectedScheduleIds={selectedScheduleIds}
              selectedLessonRef={selectedLessonRef}
              onOpenLessonGroup={handleOpenLessonGroup}
              onSkip={openTaskDateCalendar}
              onClear={handleClearLesson}
              themeColors={themeColors}
              lang={lang}
            />
          )}

          {currentScreen === "lessonOccurrence" && (
            <LessonOccurrenceScreen
              schedule={selectedOccurrenceSchedule}
              lessonGroup={selectedLessonGroup?.lessonGroup}
              selectedLessonRef={selectedLessonRef}
              dateFilter={lessonDateFilter}
              onSelectOccurrence={handleSelectLessonOccurrence}
              onChooseDate={openLessonGroupDateCalendar}
              onClear={handleClearLesson}
              themeColors={themeColors}
              lang={lang}
            />
          )}

          {currentScreen === "linkPicker" && (
            <LessonEditorPickerScreen
              options={localLinks.map((link) => ({ key: link.id, label: link.name || t("tasks.default_link", lang) }))}
              selectedValues={selectedLinks}
              multiSelect
              onSave={(keys) => {
                setSelectedLinks(sanitizeIdArray(keys));
                setCurrentScreen("main");
              }}
              onEdit={(id) => {
                setEditingLinkId(id);
                setCurrentScreen("linkEditor");
              }}
              onAdd={() => {
                setEditingLinkId(generateId());
                setCurrentScreen("linkEditor");
              }}
              themeColors={themeColors}
            />
          )}

          {currentScreen === "linkEditor" && (
            <LinkEditor
              linkId={editingLinkId}
              localLinkData={localLinks.find((link) => link.id === editingLinkId) || {}}
              onSaveLocal={handleSaveLink}
              onBack={goBack}
              themeColors={themeColors}
            />
          )}
        </View>
      </BottomSheet>

      <CalendarSheet
        visible={lessonCalendarVisible}
        onClose={() => {
          setLessonCalendarVisible(false);
          setLessonCalendarPurpose(null);
        }}
        onSkip={lessonCalendarPurpose ? handleCalendarSkip : undefined}
        skipLabel={t("common.skip", lang)}
        currentDate={calendarCurrentDate}
        customSchedule={selectedOccurrenceSchedule || targetSchedule}
        onDateSelect={handleDateSelect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -8,
  },
  minimizedOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 88,
    zIndex: 999,
  },
  minimizedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    flex: 1,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  minimizedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  minimizedText: {
    flex: 1,
    paddingRight: 5,
  },
  minimizedTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  minimizedSubtitle: {
    fontSize: 11,
  },
  minimizedActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
    zIndex: 10,
  },
  minimizedActionBtn: {
    padding: 2,
  },
  headerRight: {
    minWidth: 60,
    alignItems: "flex-end",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  textAreaWrap: {
    minHeight: 132,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
  },
  textAreaIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  textArea: {
    flex: 1,
    minHeight: 108,
    fontSize: 16,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
  },
  lessonPickerContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
  },
  lessonSearchBox: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 12,
  },
  lessonSearchInput: {
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 0,
  },
  lessonActionsStack: {
    gap: 8,
    marginBottom: 18,
  },
  lessonActionRow: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  lessonActionText: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  lessonActionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  lessonActionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  catalogueSection: {
    marginTop: 4,
    marginBottom: 18,
  },
  catalogueSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    marginLeft: 4,
    marginBottom: 8,
  },
  catalogueSchedule: {
    marginBottom: 16,
  },
  catalogueScheduleHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    paddingHorizontal: 4,
  },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  catalogueScheduleTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "800",
  },
  lessonGroupRow: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  lessonGroupIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  lessonGroupBody: {
    flex: 1,
    minWidth: 0,
  },
  lessonGroupTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  lessonGroupSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  lessonPickerSection: {
    marginBottom: 18,
  },
  lessonPickerSectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    marginLeft: 4,
    marginBottom: 8,
  },
  dayGroup: {
    marginBottom: 12,
  },
  dayGroupTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 4,
    marginBottom: 8,
  },
  lessonOptionCard: {
    minHeight: 70,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  lessonOptionNumber: {
    width: 54,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  lessonOptionNumberText: {
    fontSize: 19,
    lineHeight: 21,
    fontWeight: "900",
  },
  lessonOptionNumberLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 1,
  },
  lessonOptionTimeRow: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  lessonOptionTimeTitle: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  lessonOptionMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 3,
  },
  lessonOptionBody: {
    flex: 1,
    minWidth: 0,
  },
  lessonPickerEmpty: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 42,
  },
  lessonPickerEmptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  lessonPickerEmptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});

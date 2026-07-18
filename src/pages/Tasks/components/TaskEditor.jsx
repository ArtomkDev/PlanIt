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
import tinycolor from "tinycolor2";

import CalendarSheet from "../../../components/CalendarSheet/CalendarSheet";
import AppBlur from "../../../components/ui/AppBlur";
import BottomSheet, { SheetScrollView } from "../../../components/ui/BottomSheet";
import GradientBackground from "../../../components/ui/GradientBackground";
import SettingsActionRow from "../../../components/ui/SettingsKit/SettingsActionRow";
import SettingsGroup from "../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../components/ui/SettingsKit/SettingsRow";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { getIconComponent } from "../../../config/subjectIcons";
import themes from "../../../config/themes";
import { generateId } from "../../../utils/idGenerator";
import { t } from "../../../utils/i18n";
import { resolveScheduleColor } from "../../../utils/scheduleColors";
import { addScheduleRecordToMap } from "../../../utils/scheduleRecordMerge";
import { triggerHaptic } from "../../../utils/haptics";
import {
  areLessonRefsSame,
  buildScheduleGroupedLessonCatalogue,
  buildScheduleLessonGroups,
  createTaskDraftFromOccurrence,
  findNextLessonGroupOccurrence,
  formatLessonRefLabel as formatTaskLessonRefLabel,
  formatOccurrenceDayLabel,
  formatOccurrenceTimeLabel,
  getLocalISODate,
  getTaskAutoLinkMode,
  listLessonGroupOccurrences,
  normalizeLessonRef,
  resolveLessonLinkIds,
  TASK_AUTO_LINK_MODES,
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

const colorWithAlpha = (color, alpha, fallback) => {
  const parsed = tinycolor(color);
  return parsed.isValid()
    ? parsed.setAlpha(alpha).toRgbString()
    : fallback;
};

const getGradientColors = (gradient) => (
  Array.isArray(gradient?.colors)
    ? gradient.colors
      .map((colorStop) => (typeof colorStop === "string" ? colorStop : colorStop?.color))
      .filter((color) => typeof color === "string" && tinycolor(color).isValid())
    : []
);

const getSubjectPalette = (subject, schedule, themeColors) => {
  const fallbackColor = themeColors.accentColor;
  const gradients = Array.isArray(schedule?.gradients) ? schedule.gradients : [];
  const gradient = subject?.typeColor === "gradient" && subject?.colorGradient
    ? gradients.find((item) => item?.id === subject.colorGradient) || null
    : null;
  const gradientColor = getGradientColors(gradient)[0];
  const rawSubjectColor = themes.accentColors[subject?.color] || subject?.color;
  const subjectColor = tinycolor(rawSubjectColor).isValid()
    ? tinycolor(rawSubjectColor).toHexString()
    : fallbackColor;
  const accentColor = gradientColor || subjectColor || fallbackColor;

  return {
    accentColor,
    gradient,
    panelBackground: colorWithAlpha(accentColor, 0.12, themeColors.backgroundColor2),
    panelBorder: colorWithAlpha(accentColor, 0.38, themeColors.borderColor),
    iconBackground: colorWithAlpha(accentColor, 0.18, themeColors.backgroundColor3),
    buttonBackground: colorWithAlpha(accentColor, 0.12, themeColors.backgroundColor2),
    buttonBorder: colorWithAlpha(accentColor, 0.24, themeColors.borderColor),
  };
};

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

const getInitialTaskEditorScreen = () => "main";

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

const getInitialTaskLessonRef = (task, fallbackScheduleId, fallbackSubjectId = null) => (
  normalizeLessonRef(task?.lessonRef, fallbackScheduleId)
  || buildDateOnlyLessonRef(fallbackScheduleId, new Date(), task?.subjectId || fallbackSubjectId)
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
  onDetachLessonOccurrence,
  themeColors,
  lang,
}) {
  const [query, setQuery] = useState("");
  const canDetachLessonOccurrence = selectedLessonRef?.lessonIndex !== undefined
    && selectedLessonRef?.lessonIndex !== null;
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
    const selected = String(selectedLessonRef?.scheduleId || "") === String(record.scheduleId || "")
      && String(selectedLessonRef?.subjectId || "") === String(lessonGroup.subjectId || "");
    const subtitle = getGroupSubtitle(lessonGroup);
    const lessonPalette = getSubjectPalette(lessonGroup.subject, record.schedule, themeColors);
    const LessonIcon = getIconComponent(lessonGroup.subject?.icon) || BookOpen;

    return (
      <TouchableOpacity
        key={lessonGroup.key}
        activeOpacity={0.76}
        onPress={() => {
          triggerHaptic(selected ? "selection" : "open");
          onOpenLessonGroup(record, lessonGroup);
        }}
        style={[
          styles.lessonGroupRow,
          {
            backgroundColor: selected ? lessonPalette.panelBackground : themeColors.backgroundColor2,
            borderColor: selected ? lessonPalette.accentColor : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.lessonGroupIcon, { backgroundColor: lessonPalette.iconBackground }]}>
          <LessonIcon size={18} color={lessonPalette.accentColor} weight="bold" />
        </View>
        <View style={styles.lessonGroupBody}>
          <Text style={[styles.lessonGroupTitle, { color: themeColors.textColor }]} numberOfLines={1}>
            {getGroupTitle(lessonGroup, lang)}
          </Text>
          <Text style={[styles.lessonGroupSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
            {[subtitle, formatOccurrenceCount(lessonGroup.occurrenceCount, lang)].filter(Boolean).join(" - ")}
          </Text>
        </View>
        {selected && <CheckCircle size={21} color={lessonPalette.accentColor} weight="fill" />}
      </TouchableOpacity>
    );
  };

  return (
    <SheetScrollView
      contentContainerStyle={styles.lessonPickerContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {canDetachLessonOccurrence && (
        <TouchableOpacity
          activeOpacity={0.76}
          onPress={() => {
            triggerHaptic("warning");
            onDetachLessonOccurrence();
          }}
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
              {t("tasks.editor.detach_lesson_occurrence", lang)}
            </Text>
            <Text style={[styles.lessonActionSubtitle, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {t("tasks.editor.detach_lesson_occurrence_hint", lang)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

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
  showQuickActions = true,
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
  const lessonGroupPalette = getSubjectPalette(lessonGroup?.subject, schedule, themeColors);

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
    const occurrencePalette = getSubjectPalette(occurrence.subject || lessonGroup?.subject, schedule, themeColors);

    return (
      <TouchableOpacity
        key={`${draft.lessonRef.date}:${draft.lessonRef.weekKey}:${draft.lessonRef.lessonIndex}`}
        activeOpacity={0.76}
        onPress={() => {
          triggerHaptic(selected ? "selection" : "success");
          onSelectOccurrence(schedule, occurrence);
        }}
        style={[
          styles.lessonOptionCard,
          {
            backgroundColor: selected ? occurrencePalette.panelBackground : themeColors.backgroundColor2,
            borderColor: selected ? occurrencePalette.accentColor : themeColors.borderColor,
          },
        ]}
      >
        <View style={[styles.lessonOptionNumber, { backgroundColor: occurrencePalette.iconBackground }]}>
          <Text style={[styles.lessonOptionNumberText, { color: occurrencePalette.accentColor }]}>
            {lessonNumber || "-"}
          </Text>
          <Text style={[styles.lessonOptionNumberLabel, { color: occurrencePalette.accentColor }]} numberOfLines={1}>
            {t("tasks.editor.lesson_number_short", lang)}
          </Text>
        </View>
        <View style={styles.lessonOptionBody}>
          <View style={styles.lessonOptionTimeRow}>
            <Clock size={17} color={occurrencePalette.accentColor} weight="bold" />
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
        {selected && <CheckCircle size={22} color={occurrencePalette.accentColor} weight="fill" />}
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
      {showQuickActions && (
        <View style={styles.lessonActionsStack}>
          <TouchableOpacity
            activeOpacity={0.76}
            disabled={!nextOccurrence}
            onPress={() => {
              if (!nextOccurrence) return;
              triggerHaptic("success");
              onSelectOccurrence(schedule, nextOccurrence);
            }}
            style={[
              styles.lessonActionRow,
              {
                backgroundColor: lessonGroupPalette.panelBackground,
                borderColor: lessonGroupPalette.panelBorder,
                opacity: nextOccurrence ? 1 : 0.5,
              },
            ]}
          >
            <CalendarDots size={20} color={lessonGroupPalette.accentColor} weight="bold" />
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
            onPress={() => {
              onChooseDate();
            }}
            style={[
              styles.lessonActionRow,
              {
                backgroundColor: themeColors.backgroundColor2,
                borderColor: themeColors.borderColor,
              },
            ]}
          >
            <CalendarDots size={20} color={lessonGroupPalette.accentColor} weight="bold" />
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
        </View>
      )}

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

  const initialSubjectId = getInitialTaskSubjectId(task, targetSchedule?.id);
  const [currentScreen, setCurrentScreen] = useState(() => getInitialTaskEditorScreen(task));
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => initialSubjectId);
  const [text, setText] = useState(task?.text || "");
  const [selectedLinks, setSelectedLinks] = useState(() => sanitizeIdArray(task?.links));
  const [selectedLessonRef, setSelectedLessonRef] = useState(() => (
    getInitialTaskLessonRef(task, targetSchedule?.id, initialSubjectId)
  ));
  const [localLinks, setLocalLinks] = useState(() => deepCloneArray(targetSchedule?.links));
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [selectedLessonGroup, setSelectedLessonGroup] = useState(null);
  const [lessonPickerMode, setLessonPickerMode] = useState("manual");
  const [lessonOccurrenceBackScreen, setLessonOccurrenceBackScreen] = useState("lessonPicker");
  const [lessonOccurrenceQuickActionsVisible, setLessonOccurrenceQuickActionsVisible] = useState(true);
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

  const handleExpand = (withHaptic = true) => {
    if (withHaptic) triggerHaptic("expand");
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setIsMinimized(false));
  };

  const handleCloseMinimized = () => {
    triggerHaptic("sheetClose");
    Animated.timing(minimizeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => onClose?.());
  };

  useEffect(() => {
    if (previousEditorSessionKeyRef.current === editorSessionKey) return;
    previousEditorSessionKeyRef.current = editorSessionKey;

    const normalizedTaskLessonRef = normalizeLessonRef(task?.lessonRef, sourceSchedule?.id);
    const nextScheduleId = normalizedTaskLessonRef?.scheduleId
      || sourceSchedule?.id
      || schedule?.id
      || allSchedules[0]?.id
      || null;
    const nextSchedule = scheduleById.get(nextScheduleId) || sourceSchedule || schedule || allSchedules[0] || null;
    const nextSubjectId = task?.subjectId || normalizedTaskLessonRef?.subjectId || null;
    const nextLessonRef = normalizedTaskLessonRef
      || buildDateOnlyLessonRef(nextSchedule?.id, new Date(), nextSubjectId);

    setCurrentScreen(getInitialTaskEditorScreen(task));
    setTargetScheduleId(nextSchedule?.id || null);
    setSelectedSubjectId(nextSubjectId);
    setText(task?.text || "");
    setSelectedLinks(sanitizeIdArray(task?.links));
    setSelectedLessonRef(nextLessonRef);
    setLocalLinks(deepCloneArray(nextSchedule?.links));
    setEditingLinkId(null);
    setSelectedLessonGroup(null);
    setLessonPickerMode("manual");
    setLessonOccurrenceBackScreen("lessonPicker");
    setLessonOccurrenceQuickActionsVisible(true);
    setLessonDateFilter(null);
    setLessonCalendarVisible(false);
    setLessonCalendarPurpose(null);

    if (isMinimized) {
      handleExpand(false);
    }
  }, [allSchedules, editorSessionKey, isMinimized, schedule, scheduleById, sourceSchedule, task]);

  useEffect(() => {
    if (!targetSchedule?.id || selectedLessonRef) return;
    setSelectedLessonRef(buildDateOnlyLessonRef(targetSchedule.id, new Date(), selectedSubjectId));
  }, [selectedLessonRef, selectedSubjectId, targetSchedule?.id]);

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
  const activeLessonRef = normalizeLessonRef(selectedLessonRef, targetSchedule.id)
    || buildDateOnlyLessonRef(targetSchedule.id, new Date(), selectedSubjectId);
  const isInitialLessonPicker = currentScreen === "lessonPicker"
    && !task?.id
    && !text.trim()
    && !selectedSubjectId
    && !activeLessonRef;
  const linkedLessonInfo = (() => {
    const ref = activeLessonRef;
    if (!ref) return null;

    const refSchedule = scheduleById.get(ref.scheduleId) || targetSchedule;
    const refSubjects = Array.isArray(refSchedule?.subjects) ? refSchedule.subjects : [];
    const refSubject = ref.subjectId
      ? refSubjects.find((subject) => String(subject.id) === String(ref.subjectId))
      : null;
    const subjectLabel = refSubject?.name
      || refSubject?.fullName
      || selectedSubject?.name
      || selectedSubject?.fullName
      || t("tasks.editor.no_subject", lang);
    const scheduleLabel = allSchedules.length > 1 ? getScheduleName(refSchedule, lang) : "";
    const lessonLabel = formatTaskLessonRefLabel(ref, lang);

    return {
      ref,
      schedule: refSchedule,
      scheduleId: ref.scheduleId || refSchedule?.id || targetSchedule.id,
      subject: refSubject || selectedSubject || null,
      subjectId: ref.subjectId || refSubject?.id || selectedSubject?.id || null,
      subjectLabel,
      scheduleLabel,
      lessonLabel,
      fullLabel: [scheduleLabel, subjectLabel, lessonLabel].filter(Boolean).join(" - "),
    };
  })();
  const linkedLessonLabel = linkedLessonInfo?.fullLabel || "";
  const hasLinkedLessonOccurrence = linkedLessonInfo?.ref?.lessonIndex !== undefined
    && linkedLessonInfo?.ref?.lessonIndex !== null;
  const linkedLessonGroupTarget = (() => {
    if (!linkedLessonInfo?.scheduleId || !linkedLessonInfo?.subjectId) return null;

    const refSchedule = scheduleById.get(linkedLessonInfo.scheduleId)
      || linkedLessonInfo.schedule
      || targetSchedule;
    const lessonGroup = buildScheduleLessonGroups(refSchedule)
      .find((group) => String(group.subjectId) === String(linkedLessonInfo.subjectId));

    return lessonGroup && refSchedule?.id
      ? { scheduleId: refSchedule.id, lessonGroup }
      : null;
  })();
  const linkedLessonPalette = getSubjectPalette(
    linkedLessonInfo?.subject,
    linkedLessonInfo?.schedule,
    themeColors,
  );

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
    triggerHaptic("navigateBack");
    if (currentScreen === "linkEditor") {
      setCurrentScreen("linkPicker");
      return;
    }
    if (currentScreen === "lessonOccurrence") {
      setLessonDateFilter(null);
      if (lessonOccurrenceBackScreen === "main") {
        setSelectedLessonGroup(null);
        setCurrentScreen("main");
        setLessonOccurrenceBackScreen("lessonPicker");
        setLessonOccurrenceQuickActionsVisible(true);
        return;
      }

      setLessonOccurrenceQuickActionsVisible(true);
      setCurrentScreen("lessonPicker");
      return;
    }
    setLessonPickerMode("manual");
    setCurrentScreen("main");
  };

  const closeSheet = () => {
    sheetRef.current?.close();
  };

  const handleCancel = () => {
    triggerHaptic("sheetClose");
    closeSheet();
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
    const lessonRef = normalizeLessonRef(activeLessonRef, targetSchedule.id)
      || buildDateOnlyLessonRef(targetSchedule.id, new Date(), resolvedSubjectId);
    const nextTask = {
      ...(task || {}),
      id: taskId,
      subjectId: resolvedSubjectId,
      text: trimmedText,
      links: sanitizeIdArray(selectedLinks),
      lessonRef,
      completed: task?.completed === true,
      createdAt: task?.createdAt || now,
      updatedAt: now,
    };

    onSave?.({
      scheduleId: targetSchedule.id,
      task: nextTask,
      links: localLinks,
    });

    triggerHaptic("success");
    dismissEditor();
  };

  const deleteTask = () => {
    if (!task?.id) return;

    triggerHaptic("success");
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
    triggerHaptic("success");
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
    setLessonPickerMode("manual");
    setCurrentScreen("main");
  };

  const findAutoLessonGroupOccurrence = (nextSchedule, lessonGroup) => {
    if (!nextSchedule?.id || !lessonGroup?.subjectId) return null;

    const autoLinkMode = getTaskAutoLinkMode(nextSchedule);
    if (autoLinkMode === TASK_AUTO_LINK_MODES.OFF) return null;

    const today = new Date();
    if (autoLinkMode === TASK_AUTO_LINK_MODES.SELECTED) {
      const todayOccurrences = listLessonGroupOccurrences(nextSchedule, lessonGroup, {
        date: today,
        maxOccurrences: Number.POSITIVE_INFINITY,
      });
      const nowTime = Date.now();
      const todayOccurrence = todayOccurrences.find((occurrence) => getOccurrenceEndTime(occurrence) >= nowTime)
        || todayOccurrences[0]
        || null;

      if (todayOccurrence) return todayOccurrence;
    }

    return findNextLessonGroupOccurrence(nextSchedule, lessonGroup, today);
  };

  const applyAutoLessonGroupDraft = (record, lessonGroup) => {
    const nextSchedule = scheduleById.get(record?.scheduleId) || record?.schedule || targetSchedule;
    if (!nextSchedule?.id || !lessonGroup?.subjectId) return;

    const occurrence = findAutoLessonGroupOccurrence(nextSchedule, lessonGroup);
    const draft = occurrence ? createTaskDraftFromOccurrence(nextSchedule, occurrence) : null;

    if (draft?.lessonRef) {
      applyLessonDraft(nextSchedule, draft);
    } else {
      const scheduleChanged = nextSchedule.id !== targetSchedule.id;
      const lessonDate = getLessonRefDate(activeLessonRef) || new Date();
      const lessonRef = buildDateOnlyLessonRef(nextSchedule.id, lessonDate, lessonGroup.subjectId);
      setTargetScheduleId(nextSchedule.id);
      setSelectedSubjectId(lessonGroup.subjectId);
      setSelectedLessonRef(lessonRef);
      mergeDraftLinks(nextSchedule, resolveLessonLinkIds(nextSchedule, {}, lessonGroup.subjectId), scheduleChanged);
    }

    setSelectedLessonGroup(null);
    setLessonDateFilter(null);
    setLessonCalendarPurpose(null);
    setLessonCalendarVisible(false);
    setLessonPickerMode("manual");
    setLessonOccurrenceBackScreen("lessonPicker");
    setCurrentScreen("main");
  };

  const openAutoLessonPicker = () => {
    triggerHaptic("open");
    setSelectedLessonGroup(null);
    setLessonDateFilter(null);
    setLessonCalendarPurpose(null);
    setLessonOccurrenceQuickActionsVisible(true);
    setLessonPickerMode("auto");
    setCurrentScreen("lessonPicker");
  };

  const detachLessonOccurrence = () => {
    const ref = normalizeLessonRef(activeLessonRef, targetSchedule.id);
    const nextSchedule = scheduleById.get(ref?.scheduleId) || targetSchedule;
    const lessonDate = getLessonRefDate(ref) || new Date();

    applyDateOnlyDraft(nextSchedule, lessonDate);
  };

  const openTaskDateCalendar = () => {
    triggerHaptic("open");
    setSelectedLessonGroup(null);
    setLessonDateFilter(null);
    setLessonCalendarPurpose("taskDate");
    setLessonOccurrenceBackScreen("main");
    setLessonOccurrenceQuickActionsVisible(true);
    setLessonPickerMode("manual");
    setLessonCalendarVisible(true);
  };

  const openLessonGroupDateCalendar = () => {
    triggerHaptic("open");
    setLessonCalendarPurpose("lessonGroupDate");
    setLessonCalendarVisible(true);
  };

  const openLinkedSubjectOccurrencePicker = () => {
    triggerHaptic("open");
    if (!linkedLessonGroupTarget?.lessonGroup) {
      setLessonPickerMode("manual");
      setLessonOccurrenceQuickActionsVisible(true);
      setCurrentScreen("lessonPicker");
      return;
    }

    setSelectedLessonGroup({
      scheduleId: linkedLessonGroupTarget.scheduleId,
      lessonGroup: linkedLessonGroupTarget.lessonGroup,
    });
    setLessonOccurrenceBackScreen("main");
    setLessonDateFilter(null);
    setLessonCalendarPurpose(null);
    setLessonCalendarVisible(false);
    setLessonOccurrenceQuickActionsVisible(false);
    setCurrentScreen("lessonOccurrence");
  };

  const openLinkedSubjectDateCalendar = () => {
    triggerHaptic("open");
    if (!linkedLessonGroupTarget?.lessonGroup) {
      setLessonPickerMode("manual");
      setLessonOccurrenceQuickActionsVisible(true);
      setCurrentScreen("lessonPicker");
      return;
    }

    setSelectedLessonGroup({
      scheduleId: linkedLessonGroupTarget.scheduleId,
      lessonGroup: linkedLessonGroupTarget.lessonGroup,
    });
    setLessonOccurrenceBackScreen("main");
    setLessonOccurrenceQuickActionsVisible(true);
    setLessonDateFilter(null);
    setLessonCalendarPurpose("lessonGroupDate");
    setLessonCalendarVisible(true);
  };

  const handleSelectLessonOccurrence = (occurrenceSchedule, occurrence) => {
    const draft = createTaskDraftFromOccurrence(occurrenceSchedule, occurrence);
    if (!draft?.lessonRef) return;

    applyLessonDraft(occurrenceSchedule, draft);
    setLessonDateFilter(null);
    setLessonCalendarPurpose(null);
    setLessonPickerMode("manual");
    setLessonOccurrenceQuickActionsVisible(true);
    setCurrentScreen("main");
  };

  const handleOpenLessonGroup = (record, lessonGroup) => {
    if (lessonPickerMode === "auto") {
      applyAutoLessonGroupDraft(record, lessonGroup);
      return;
    }

    setSelectedLessonGroup({
      scheduleId: record.scheduleId,
      lessonGroup,
    });
    setLessonOccurrenceBackScreen("lessonPicker");
    setLessonOccurrenceQuickActionsVisible(true);
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
        <TouchableOpacity onPress={handleCancel} hitSlop={15}>
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

  const renderLessonQuickButton = ({
    label,
    onPress,
    primary = false,
    icon: Icon = CalendarDots,
    style,
  }) => {
    const actionAccent = linkedLessonInfo ? linkedLessonPalette.accentColor : themeColors.accentColor;

    return (
      <TouchableOpacity
        activeOpacity={0.76}
        onPress={onPress}
        style={[
          styles.lessonQuickButton,
          primary && styles.lessonQuickButtonPrimary,
          style,
          {
            backgroundColor: primary
              ? actionAccent
              : linkedLessonInfo
                ? linkedLessonPalette.buttonBackground
                : themeColors.backgroundColor2,
            borderColor: primary
              ? actionAccent
              : linkedLessonInfo
                ? linkedLessonPalette.buttonBorder
                : themeColors.borderColor,
          },
        ]}
      >
        <Icon
          size={18}
          color={primary ? "#fff" : actionAccent}
          weight="bold"
        />
        <Text
          style={[
            styles.lessonQuickButtonText,
            { color: primary ? "#fff" : themeColors.textColor },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLessonLinkMeta = () => {
    if (!linkedLessonInfo) {
      return (
        <Text style={[styles.lessonLinkMeta, { color: themeColors.textColor2 }]} numberOfLines={2}>
          {t("tasks.editor.linked_lesson_hint", lang)}
        </Text>
      );
    }

    const scheduleColor = resolveScheduleColor(linkedLessonInfo.schedule, linkedLessonPalette.accentColor);

    return (
      <View style={styles.lessonLinkMetaRow}>
        {!!linkedLessonInfo.scheduleLabel && (
          <View
            style={[
              styles.lessonScheduleBadge,
              {
                backgroundColor: colorWithAlpha(scheduleColor, 0.14, themeColors.backgroundColor2),
                borderColor: colorWithAlpha(scheduleColor, 0.3, themeColors.borderColor),
              },
            ]}
          >
            <View style={[styles.lessonScheduleDot, { backgroundColor: scheduleColor }]} />
            <Text style={[styles.lessonScheduleBadgeText, { color: themeColors.textColor }]} numberOfLines={1}>
              {linkedLessonInfo.scheduleLabel}
            </Text>
          </View>
        )}

        {!!linkedLessonInfo.lessonLabel && (
          <Text style={[styles.lessonLinkMetaText, { color: themeColors.textColor2 }]} numberOfLines={1}>
            {linkedLessonInfo.lessonLabel}
          </Text>
        )}
      </View>
    );
  };

  const renderLessonLinkControl = () => {
    const LinkBlockIcon = linkedLessonInfo
      ? getIconComponent(linkedLessonInfo.subject?.icon) || BookOpen
      : CalendarDots;

    return (
      <View
        style={[
          styles.lessonLinkPanel,
          {
            backgroundColor: linkedLessonInfo ? linkedLessonPalette.panelBackground : themeColors.backgroundColor2,
            borderColor: linkedLessonInfo ? linkedLessonPalette.panelBorder : themeColors.borderColor,
          },
        ]}
      >
        {!!linkedLessonInfo && !!linkedLessonPalette.gradient && (
          <View pointerEvents="none" style={styles.lessonLinkGradientLayer}>
            <GradientBackground gradient={linkedLessonPalette.gradient} style={StyleSheet.absoluteFillObject} />
          </View>
        )}

        <View style={styles.lessonLinkHeader}>
          <View
            style={[
              styles.lessonLinkIcon,
              { backgroundColor: linkedLessonInfo ? linkedLessonPalette.iconBackground : themeColors.backgroundColor3 },
            ]}
          >
            <LinkBlockIcon
              size={22}
              color={linkedLessonInfo ? linkedLessonPalette.accentColor : themeColors.textColor2}
              weight={linkedLessonInfo ? "fill" : "bold"}
            />
          </View>

          <View style={styles.lessonLinkText}>
            <Text style={[styles.lessonLinkStatus, { color: linkedLessonInfo ? linkedLessonPalette.accentColor : themeColors.textColor2 }]}>
              {hasLinkedLessonOccurrence
                ? t("tasks.editor.linked_lesson_auto_ready", lang)
                : t("tasks.editor.linked_lesson_date_only", lang)}
            </Text>
            <Text style={[styles.lessonLinkTitle, { color: themeColors.textColor }]} numberOfLines={2}>
              {linkedLessonInfo?.subjectLabel || t("tasks.editor.linked_lesson", lang)}
            </Text>
            {renderLessonLinkMeta()}
          </View>
        </View>

        <View style={styles.lessonQuickActions}>
          {hasLinkedLessonOccurrence ? (
            <>
              {renderLessonQuickButton({
                label: t("tasks.editor.change_lesson_subject", lang),
                onPress: openAutoLessonPicker,
                icon: BookOpen,
                style: styles.lessonQuickButtonFull,
              })}

              {!!linkedLessonGroupTarget && (
                <View style={styles.lessonQuickSecondaryRow}>
                  {renderLessonQuickButton({
                    label: t("tasks.editor.choose_same_subject_lesson", lang),
                    onPress: openLinkedSubjectOccurrencePicker,
                    icon: Clock,
                    style: styles.lessonQuickButtonHalf,
                  })}

                  {renderLessonQuickButton({
                    label: t("tasks.editor.choose_same_subject_date", lang),
                    onPress: openLinkedSubjectDateCalendar,
                    icon: CalendarDots,
                    style: styles.lessonQuickButtonHalf,
                  })}
                </View>
              )}
            </>
          ) : (
            <>
              {renderLessonQuickButton({
                label: t("tasks.editor.choose_lesson_subject_date", lang),
                onPress: openAutoLessonPicker,
                primary: true,
                icon: BookOpen,
                style: styles.lessonQuickButtonFull,
              })}

              {renderLessonQuickButton({
                label: t("tasks.editor.choose_same_subject_date", lang),
                onPress: linkedLessonGroupTarget ? openLinkedSubjectDateCalendar : openTaskDateCalendar,
                icon: CalendarDots,
                style: styles.lessonQuickButtonFull,
              })}
            </>
          )}
        </View>
      </View>
    );
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
        <SettingsGroup
          themeColors={themeColors}
          title={t("tasks.editor.lesson", lang)}
          contentStyle={styles.lessonLinkGroupContent}
        >
          {renderLessonLinkControl()}
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
  const calendarCurrentDate = lessonDateFilter || getLessonRefDate(activeLessonRef) || new Date();

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
              onPress={() => handleExpand()}
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
              selectedLessonRef={activeLessonRef}
              onOpenLessonGroup={handleOpenLessonGroup}
              onDetachLessonOccurrence={detachLessonOccurrence}
              themeColors={themeColors}
              lang={lang}
            />
          )}

          {currentScreen === "lessonOccurrence" && (
            <LessonOccurrenceScreen
              schedule={selectedOccurrenceSchedule}
              lessonGroup={selectedLessonGroup?.lessonGroup}
              selectedLessonRef={activeLessonRef}
              dateFilter={lessonDateFilter}
              onSelectOccurrence={handleSelectLessonOccurrence}
              onChooseDate={openLessonGroupDateCalendar}
              showQuickActions={lessonOccurrenceQuickActionsVisible}
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
                triggerHaptic("success");
                setSelectedLinks(sanitizeIdArray(keys));
                setCurrentScreen("main");
              }}
              onEdit={(id) => {
                triggerHaptic("open");
                setEditingLinkId(id);
                setCurrentScreen("linkEditor");
              }}
              onAdd={() => {
                triggerHaptic("open");
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
  lessonLinkGroupContent: {
    backgroundColor: "transparent",
    borderRadius: 0,
    overflow: "visible",
  },
  lessonLinkPanel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 13,
    overflow: "hidden",
  },
  lessonLinkGradientLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  lessonLinkHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  lessonLinkIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  lessonLinkText: {
    flex: 1,
    minWidth: 0,
  },
  lessonLinkStatus: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  lessonLinkTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  lessonLinkMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 3,
  },
  lessonLinkMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  lessonScheduleBadge: {
    minHeight: 23,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lessonScheduleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  lessonScheduleBadgeText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800",
  },
  lessonLinkMetaText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  lessonQuickActions: {
    width: "100%",
    alignItems: "stretch",
    gap: 8,
    marginTop: 13,
  },
  lessonQuickSecondaryRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  lessonQuickButton: {
    minHeight: 40,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  lessonQuickButtonFull: {
    width: "100%",
  },
  lessonQuickButtonHalf: {
    flex: 1,
    minWidth: 0,
  },
  lessonQuickButtonPrimary: {
    ...Platform.select({
      web: { boxShadow: "0px 3px 10px rgba(0,0,0,0.12)" },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  lessonQuickButtonText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    marginLeft: 7,
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

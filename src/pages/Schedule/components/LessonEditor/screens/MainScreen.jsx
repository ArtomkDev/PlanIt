import TabSwitcher from "../../../../../components/ui/TabSwitcher";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, Platform, TouchableOpacity, TextInput, Alert, Modal } from "react-native";
import { SheetScrollView } from "../../../../../components/ui/BottomSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  BookOpen,
  Tag,
  Buildings,
  MapPin,
  User,
  Link as LinkIcon,
  Palette,
  Image as ImageIcon,
  Clock,
  Bell,
  Plus,
  CalendarDots
} from "phosphor-react-native";

import SettingsGroup from "../ui/Group";
import SettingsRow from "../ui/SettingRow";
import AttachmentManager from "../../../../../components/attachments/AttachmentManager";

import GradientBackground from "../../../../../components/ui/GradientBackground";
import themes from "../../../../../config/themes";
import { getIconComponent } from "../../../../../config/subjectIcons";
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t, formatText as interpolate } from "../../../../../utils/i18n";
import { triggerHaptic } from "../../../../../utils/haptics";
import {
  CUSTOM_REMINDER_FALLBACK_MINUTES,
  REMINDER_PRESET_MINUTES,
  clampReminderMinutes,
  getReminderSelectionId,
  normalizeScheduleReminder,
  normalizeSubjectReminder,
} from "../../../../../utils/reminderSettings";
import {
  NOTIFICATION_TYPES,
  ensureNotificationPushPermissionsForType,
} from "../../../../../services/notificationService";
import {
  getDurationMinutes,
  getScheduleWeekNumbers,
} from "../../../../../utils/scheduleTime";

export default function LessonEditorMainScreen({
  themeColors,
  scrollOffsetRef,
  selectedSubjectId,
  currentSubject,
  gradients,
  setActivePicker,
  onDirectEdit,
  onEditSubjectColor,
  getLabel,
  scopes,
  onScopeChange,
  getValueLabel,
  getArrayData,
  instanceData,
  defaultTime,
  onTimeChange,
  timeSlots = [],
  onSlotChange,
  slotConflict,
  onConflictResolution,
  onTimeModeChange,
  recurrenceSelection,
  onRecurrenceChange,
  scheduleRepeat,
  currentWeekNumber,
  onClearSubject,
  scheduleReminder,
  onSubjectReminderChange,
  attachments,
  onAttachmentsChange,
  onRemoveStoredAttachment,
  onUploadedAttachments,
  onAttachmentUploadStateChange,
  attachmentUploadState,
  attachmentOwnerAvailable,
  attachmentUserId,
  fileLibrary,
  getItemVisual,
  onFileLibraryChange,
  attachmentStorageLimitBytes
}) {
  const { global, lang } = useScheduleData();
  const insets = useSafeAreaInsets();
  const [expandedField, setExpandedField] = useState(null);
  const customTime = instanceData?.timeMode === "custom";
  const [customSubjectReminderMinutes, setCustomSubjectReminderMinutes] = useState(String(CUSTOM_REMINDER_FALLBACK_MINUTES));

  const safeGetLabel = getLabel || ((type, val) => t('schedule.main_screen.not_defined', lang));

  const isCustomStart = instanceData?.startTime !== undefined;
  const isCustomEnd = instanceData?.endTime !== undefined;

  const currentStart = isCustomStart ? instanceData.startTime : defaultTime?.start;
  const currentEnd = isCustomEnd ? instanceData.endTime : defaultTime?.end;

  const isTimeModified = currentStart !== defaultTime?.start || currentEnd !== defaultTime?.end;

  const duration = getDurationMinutes(currentStart, currentEnd);
  const repeatWeeks = getScheduleWeekNumbers(scheduleRepeat);
  const repeatCount = repeatWeeks.length;
  const selectedRepeatWeeks = recurrenceSelection?.mode === "all"
    ? repeatWeeks
    : (recurrenceSelection?.weeks || []).filter((week) => repeatWeeks.includes(Number(week)));
  const recurrenceValue = recurrenceSelection?.mode === "all"
    ? t('schedule.lesson_editor.repeat_every_week', lang)
    : selectedRepeatWeeks.length <= 4
      ? t('schedule.lesson_editor.repeat_selected_weeks_value', lang, { weeks: selectedRepeatWeeks.join(", ") })
      : t('schedule.lesson_editor.repeat_selected_count', lang, { count: String(selectedRepeatWeeks.length) });
  const scheduleDefaultReminder = normalizeScheduleReminder(scheduleReminder);
  const subjectReminder = normalizeSubjectReminder(currentSubject?.reminder);
  const reminderSelectionId = currentSubject?.reminder === undefined
    ? "default"
    : getReminderSelectionId(currentSubject.reminder);

  useEffect(() => {
    if (subjectReminder?.enabled && !REMINDER_PRESET_MINUTES.includes(subjectReminder.minutesBefore)) {
      setCustomSubjectReminderMinutes(String(subjectReminder.minutesBefore));
    }
  }, [currentSubject?.id, subjectReminder?.enabled, subjectReminder?.minutesBefore]);

  const toggleExpand = (field) => {
    const isClosing = expandedField === field;
    triggerHaptic(isClosing ? "sheetClose" : "expand");
    setExpandedField(isClosing ? null : field);
  };

  const updateRecurrenceMode = (mode) => {
    triggerHaptic("selection");
    const selectedWeek = repeatWeeks.includes(Number(currentWeekNumber))
      ? Number(currentWeekNumber)
      : repeatWeeks[0];
    onRecurrenceChange?.({
      ...recurrenceSelection,
      mode,
      weeks: mode === "all"
        ? repeatWeeks
        : recurrenceSelection?.mode === "selected" && selectedRepeatWeeks.length > 0
          ? selectedRepeatWeeks
          : [selectedWeek],
    });
  };

  const toggleRecurrenceWeek = (week) => {
    const selected = selectedRepeatWeeks.includes(week);
    if (selected && selectedRepeatWeeks.length === 1) {
      triggerHaptic("error");
      return;
    }
    triggerHaptic("selection");
    const weeks = selected
      ? selectedRepeatWeeks.filter((item) => item !== week)
      : [...selectedRepeatWeeks, week].sort((left, right) => left - right);
    const allWeeksSelected = weeks.length === repeatWeeks.length;
    onRecurrenceChange?.({
      ...recurrenceSelection,
      mode: allWeeksSelected ? "all" : "selected",
      weeks: allWeeksSelected ? repeatWeeks : weeks,
    });
  };

  const formatReminderValue = (reminder) => {
    const normalized = normalizeScheduleReminder(reminder);
    if (!normalized.enabled) return t('schedule.reminders.off', lang);
    return interpolate(t('schedule.reminders.before_minutes', lang), {
      minutes: normalized.minutesBefore,
    });
  };

  const formatSubjectReminderValue = () => {
    if (reminderSelectionId === "default") {
      return interpolate(t('schedule.reminders.default_with_value', lang), {
        value: formatReminderValue(scheduleDefaultReminder),
      });
    }

    if (reminderSelectionId === "off") return t('schedule.reminders.off', lang);

    return formatReminderValue(subjectReminder);
  };

  const ensureReminderPermission = async () => {
    const permission = await ensureNotificationPushPermissionsForType(
      NOTIFICATION_TYPES.LESSON_REMINDER,
      {
        request: true,
        notificationPreferences: global?.notificationPreferences,
      }
    );
    if (permission.disabledByPreference) return true;
    if (!permission.granted && permission.status !== "unsupported") {
      Alert.alert(t('common.warning', lang), t('schedule.reminders.permission_denied', lang));
      return false;
    }
    return true;
  };

  const handleSubjectReminderSelection = async (selection) => {
    if (!onSubjectReminderChange) return;

    if (selection === "default") {
      triggerHaptic("selection");
      onSubjectReminderChange(undefined);
      return;
    }

    if (selection === "off") {
      triggerHaptic("toggleOff");
      onSubjectReminderChange({ enabled: false });
      return;
    }

    const canEnable = await ensureReminderPermission();
    if (!canEnable) {
      triggerHaptic("warning");
      return;
    }

    if (selection === "custom") {
      triggerHaptic("open");
      const minutes = clampReminderMinutes(customSubjectReminderMinutes, CUSTOM_REMINDER_FALLBACK_MINUTES);
      setCustomSubjectReminderMinutes(String(minutes));
      onSubjectReminderChange({ enabled: true, minutesBefore: minutes });
      return;
    }

    triggerHaptic("toggleOn");
    onSubjectReminderChange({
      enabled: true,
      minutesBefore: clampReminderMinutes(selection),
    });
  };

  const handleSubjectCustomReminderChange = (text) => {
    if (!onSubjectReminderChange) return;

    const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
    const minutes = numericText === '' ? 0 : clampReminderMinutes(numericText, 0);
    const displayValue = numericText === '' ? '' : String(minutes);
    setCustomSubjectReminderMinutes(displayValue);
    onSubjectReminderChange({ enabled: true, minutesBefore: minutes });
  };

  const renderTimeValue = (val, isHighlight) => (
    <Text style={{
        fontSize: 16,
        color: isHighlight ? themeColors.textColor : themeColors.textColor2,
        fontWeight: isHighlight ? '600' : '400'
    }}>
        {val || "—"}
    </Text>
  );

  const renderTimePicker = (field, currentValue) => {
    const timeValue = currentValue || "08:00";
    const [hours, minutes] = timeValue.split(":").map(Number);
    const date = new Date();
    date.setHours(isNaN(hours) ? 8 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

    if (Platform.OS === 'android') {
        return (
            <DateTimePicker
                value={date}
                mode="time"
                is24Hour={true}
                design="material"
                positiveButton={{ textColor: themeColors.accentColor }}
                negativeButton={{ textColor: themeColors.textColor2 }}
                onChange={(event, selectedDate) => {
                    setExpandedField(null);
                    if (event.type === 'set' && selectedDate) {
                        const hh = String(selectedDate.getHours()).padStart(2, '0');
                        const mm = String(selectedDate.getMinutes()).padStart(2, '0');
                        onTimeChange(field, `${hh}:${mm}`);
                    }
                }}
            />
        );
    }

    return (
        <View style={[styles.timePickerContainer, { backgroundColor: themeColors.backgroundColor2, borderTopColor: themeColors.borderColor }]}>
            {Platform.OS !== 'web' ? (
                <DateTimePicker
                    value={date}
                    mode="time"
                    is24Hour={true}
                    display="spinner"
                    onChange={(event, selectedDate) => {
                        if (selectedDate) {
                            const hh = String(selectedDate.getHours()).padStart(2, '0');
                            const mm = String(selectedDate.getMinutes()).padStart(2, '0');
                            onTimeChange(field, `${hh}:${mm}`);
                        }
                    }}
                    textColor={themeColors.textColor}
                    style={{ height: 160, width: '100%' }}
                />
            ) : (
                <View style={{ padding: 20 }}>
                    {React.createElement('input', {
                        type: 'time',
                        'aria-label': t(field === 'startTime' ? 'schedule.main_screen.start_time' : 'schedule.main_screen.end_time', lang),
                        value: timeValue,
                        onChange: (e) => onTimeChange(field, e.target.value),
                        style: { fontSize: 18, padding: 8, borderRadius: 8, border: `1px solid ${themeColors.borderColor}`, backgroundColor: themeColors.backgroundColor, color: themeColors.textColor }
                    })}
                </View>
            )}
        </View>
    );
  };

  const renderIconValue = () => {
    if (!currentSubject.icon) {
      return <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>{t('schedule.main_screen.none', lang)}</Text>;
    }
    const IconCmp = getIconComponent(currentSubject.icon);
    return IconCmp ? (
      <IconCmp size={20} color={themeColors.textColor2} weight="regular" />
    ) : (
      <Text style={{ color: themeColors.textColor2, fontSize: 16 }}>{t('schedule.main_screen.none', lang)}</Text>
    );
  };

  const cardGradient = currentSubject?.typeColor === "gradient"
    ? gradients.find(item => item.id === currentSubject?.colorGradient) : null;
  const cardColor = themes.accentColors[currentSubject?.color] || currentSubject?.color || themes.accentColors.grey;

  if (!selectedSubjectId) {
    return (
      <SheetScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introduction}>
          <BookOpen size={36} color={themeColors.accentColor} />
          <Text style={[styles.introTitle, { color: themeColors.textColor }]}>{t('schedule.lesson_editor.start_with_subject', lang)}</Text>
          <Text style={[styles.introText, { color: themeColors.textColor2 }]}>{t('schedule.lesson_editor.start_with_subject_hint', lang)}</Text>
        </View>
        <SettingsGroup
          themeColors={themeColors}
          title={t('common.subject', lang)}
        >
          <SettingsRow
            label={t('common.subject_name', lang)}
            value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
            onPress={() => setActivePicker("subject")}
            themeColors={themeColors}
            icon={BookOpen}
          />
        </SettingsGroup>
      </SheetScrollView>
    );
  }

  const { array: teachersArr } = getArrayData("teachers", "people");
  const { array: linksArr } = getArrayData("links", "materials");

  return (
    <SheetScrollView
      style={styles.content}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      contentOffset={{ x: 0, y: scrollOffsetRef?.current || 0 }}
      onScroll={(event) => { if (scrollOffsetRef) scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={32}
    >

      <SettingsGroup
        themeColors={themeColors}
        title={t('common.subject', lang)}
        onReset={onClearSubject}
      >
        <SettingsRow
          label={t('common.subject_name', lang)}
          value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon={BookOpen}
        />
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.main_screen.time', lang)}
        onReset={isTimeModified ? () => {
            setExpandedField(null);
            onTimeModeChange("slot");
        } : null}
      >
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <TabSwitcher themeColors={themeColors} activeTab={customTime ? 'custom' : 'default'}
            tabs={[{ id: 'default', label: t('schedule.lesson_editor.time_default', lang) }, { id: 'custom', label: t('schedule.lesson_editor.time_custom', lang) }]}
            onTabPress={mode => {
              onTimeModeChange(mode === 'custom' ? 'custom' : 'slot');
              setExpandedField(null);
            }} />
        </View>
        {!!slotConflict && <Modal transparent visible onRequestClose={() => onConflictResolution('cancel')}>
          <View style={styles.conflictBackdrop}>
          <View accessibilityViewIsModal style={[styles.slotConflict, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
          <Text accessibilityRole="header" style={{ color: themeColors.textColor, fontWeight: '700' }}>{t('schedule.lesson_editor.slot_occupied_title', lang, { number: slotConflict.slotNumber })}</Text>
          <Text style={{ color: themeColors.textColor }}>{[...new Set((slotConflict.conflicts || []).map(item => safeGetLabel('subject', item.lesson.subjectId)))].filter(Boolean).join(', ')}</Text>
          <Text style={{ color: themeColors.textColor2 }}>{t('schedule.lesson_editor.slot_occupied_hint', lang)}</Text>
          {!slotConflict.canSwap && <Text style={{ color: themeColors.textColor2 }}>{t('schedule.lesson_editor.slot_swap_unavailable', lang)}</Text>}
          <View style={styles.slotActions}>
            {['replace', 'swap', 'cancel'].map(action => (
              <TouchableOpacity key={action} accessibilityRole="button"
                disabled={action === 'swap' && !slotConflict.canSwap}
                accessibilityState={{ disabled: action === 'swap' && !slotConflict.canSwap }}
                onPress={() => onConflictResolution(action)}
                style={[styles.slotAction, { borderColor: themeColors.borderColor, opacity: action === 'swap' && !slotConflict.canSwap ? 0.4 : 1 }]}>
                <Text style={{ color: themeColors.textColor, fontWeight: '600' }}>{t(`schedule.lesson_editor.slot_${action}`, lang)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          </View>
          </View>
        </Modal>}
        {customTime ? <View>
        <SettingsRow
          label={t('schedule.main_screen.start_time', lang)}
          rightContent={renderTimeValue(currentStart, isTimeModified)}
          onPress={() => toggleExpand("startTime")}
          themeColors={themeColors}
          icon={Clock}
        />
        {expandedField === "startTime" && renderTimePicker("startTime", currentStart)}

        <SettingsRow
          label={t('schedule.main_screen.end_time', lang)}
          rightContent={renderTimeValue(currentEnd, isTimeModified)}
          onPress={() => toggleExpand("endTime")}
          themeColors={themeColors}
          icon={Clock}
        />
        {expandedField === "endTime" && renderTimePicker("endTime", currentEnd)}

        <View style={styles.durationContainer}>
          <Text style={[styles.durationText, { color: themeColors.textColor }]}>
            {duration ? `${duration} ${t('schedule.main_screen.minutes', lang)}` : "—"}
          </Text>
        </View>
        </View> : <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
          <View style={styles.slotGrid}>
            {timeSlots.map((slot) => (
              <TouchableOpacity key={slot.number}
                accessibilityRole="button"
                accessibilityLabel={`${t('schedule.lesson_editor.slot_number', lang, { number: slot.number })}, ${slot.start} – ${slot.end}${slot.occupied ? ', ' + t('schedule.lesson_editor.slot_occupied', lang) : ''}`}
                accessibilityState={{ selected: instanceData.slotNumber === slot.number }}
                onPress={() => onSlotChange(slot.number)}
                style={[styles.slotOption, { borderColor: instanceData.slotNumber === slot.number ? themeColors.accentColor : themeColors.borderColor, backgroundColor: slot.occupied ? themeColors.borderColor : themeColors.backgroundColor2 }]}
              >
                <Text style={{ color: instanceData.slotNumber === slot.number ? themeColors.accentColor : themeColors.textColor, fontWeight: '600' }}>{t('schedule.lesson_editor.slot_number', lang, { number: slot.number })}</Text>
                <Text style={{ color: themeColors.textColor2, fontSize: 12 }}>{slot.start} – {slot.end}</Text>
                {slot.occupied && <Text style={{ color: themeColors.textColor2, fontSize: 12 }}>{t('schedule.lesson_editor.slot_occupied', lang)}</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: themeColors.textColor, fontSize: 15, fontWeight: '600' }}>{currentStart || '—'} – {currentEnd || '—'}{duration ? ' · ' + duration + ' ' + t('schedule.main_screen.minutes', lang) : ''}</Text>
          <Text style={{ color: themeColors.textColor2, fontSize: 12, lineHeight: 17 }}>{t('schedule.lesson_editor.time_default_hint', lang)}</Text>
        </View>}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.lesson_editor.repeat_group', lang)}
      >
        <SettingsRow
          label={t('schedule.lesson_editor.repeat_label', lang)}
          value={recurrenceValue}
          desc={t('schedule.lesson_editor.repeat_hint', lang)}
          onPress={repeatCount > 1 ? () => toggleExpand("recurrence") : undefined}
          themeColors={themeColors}
          icon={CalendarDots}
          showCaret={repeatCount > 1}
          accessibilityState={{ expanded: expandedField === "recurrence" }}
        />

        {repeatCount > 1 && expandedField === "recurrence" && (
          <View style={styles.reminderOptions}>
            <View style={styles.reminderChoiceGrid}>
              {[
                { id: "all", label: t('schedule.lesson_editor.repeat_every_week', lang) },
                { id: "selected", label: t('schedule.lesson_editor.repeat_selected_weeks', lang) },
              ].map((option) => {
                const selected = recurrenceSelection?.mode === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.reminderChoice,
                      {
                        backgroundColor: selected ? themeColors.accentColor : themeColors.backgroundColor,
                        borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
                      },
                    ]}
                    onPress={() => updateRecurrenceMode(option.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected, checked: selected }}
                  >
                    <Text style={[styles.reminderChoiceText, { color: selected ? "#fff" : themeColors.textColor }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {recurrenceSelection?.mode === "selected" && (
              <>
                <Text style={[styles.recurrenceHelp, { color: themeColors.textColor2 }]}>
                  {t('schedule.lesson_editor.repeat_choose_weeks', lang)}
                </Text>
                <View style={styles.reminderChoiceGrid}>
                  {repeatWeeks.map((week) => {
                    const selected = selectedRepeatWeeks.includes(week);
                    const label = interpolate(t('common.week', lang), { week });
                    return (
                      <TouchableOpacity
                        key={week}
                        style={[
                          styles.reminderChoice,
                          styles.recurrenceWeekChoice,
                          {
                            backgroundColor: selected ? themeColors.accentColor : themeColors.backgroundColor,
                            borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
                          },
                        ]}
                        onPress={() => toggleRecurrenceWeek(week)}
                        activeOpacity={0.75}
                        accessibilityRole="checkbox"
                        accessibilityLabel={label}
                        accessibilityState={{ checked: selected }}
                      >
                        <Text style={[styles.reminderChoiceText, { color: selected ? "#fff" : themeColors.textColor }]}>
                          {week}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={[styles.recurrenceHelp, { color: themeColors.textColor2 }]}>
              {t('schedule.lesson_editor.repeat_override_hint', lang)}
            </Text>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('common.class_type', lang)}
        showScopeToggle scope={scopes.type} onScopeChange={(scope) => onScopeChange('type', scope)}
      >
        <SettingsRow
          label={t('common.class_type', lang)}
          value={getValueLabel("type", "type", "type")}
          onPress={() => setActivePicker("type")}
          themeColors={themeColors}
          icon={Tag}
        />
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.main_screen.location', lang)}
        showScopeToggle scope={scopes.location} onScopeChange={(scope) => onScopeChange('location', scope)}
      >
        <SettingsRow
          label={t('common.building', lang)}
          value={getValueLabel("building", "text", "location")}
          onPress={() => setActivePicker("building")}
          themeColors={themeColors}
          icon={Buildings}
        />
        <SettingsRow
          label={t('common.room', lang)}
          value={getValueLabel("room", "text", "location")}
          onPress={() => setActivePicker("room")}
          themeColors={themeColors}
          icon={MapPin}
        />
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.main_screen.people', lang)}
        showScopeToggle scope={scopes.people} onScopeChange={(scope) => onScopeChange('people', scope)} onAdd={() => setActivePicker('teacher', teachersArr.length)}
      >
        {teachersArr.length === 0 ? (
           <TouchableOpacity
             style={styles.emptyContainer}
             onPress={() => {
               triggerHaptic("open");
               setActivePicker('teacher', teachersArr.length);
             }}
             activeOpacity={0.72}
             accessibilityRole="button"
             accessibilityLabel={t('schedule.lesson_editor.add_teacher', lang)}
           >
               <View style={[styles.emptyAddIcon, { backgroundColor: themeColors.accentColor + "15" }]}>
                   <Plus size={18} color={themeColors.accentColor} weight="bold" />
               </View>
               <Text style={[styles.emptyText, { color: themeColors.accentColor }]}>
                   {t('schedule.lesson_editor.add_teacher', lang)}
               </Text>
           </TouchableOpacity>
        ) : (
            teachersArr.map((id, index) => {
                const visual = getItemVisual?.("teacher", id);
                return (
                  <SettingsRow
                      key={`teacher-${id}`}
                      label={`${t('schedule.main_screen.teacher', lang)} ${index + 1}`}
                      value={safeGetLabel("teacher", id)}
                      onPress={() => setActivePicker("teacher", index)}
                      onEdit={() => onDirectEdit("teacher", id, index)}
                      themeColors={themeColors}
                      icon={visual?.icon || User}
                      iconColor={visual?.color || themeColors.accentColor}
                      iconBgColor={visual?.color ? visual.color + "15" : undefined}
                      iconWeight="bold"
                  />
                );
            })
        )}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.main_screen.materials', lang)}
        showScopeToggle scope={scopes.materials} onScopeChange={(scope) => onScopeChange('materials', scope)} onAdd={() => setActivePicker('link', linksArr.length)}
      >
        {linksArr.length === 0 ? (
           <TouchableOpacity
             style={styles.emptyContainer}
             onPress={() => {
               triggerHaptic("open");
               setActivePicker('link', linksArr.length);
             }}
             activeOpacity={0.72}
             accessibilityRole="button"
             accessibilityLabel={t('schedule.lesson_editor.add_link', lang)}
           >
               <View style={[styles.emptyAddIcon, { backgroundColor: themeColors.accentColor + "15" }]}>
                   <Plus size={18} color={themeColors.accentColor} weight="bold" />
               </View>
               <Text style={[styles.emptyText, { color: themeColors.accentColor }]}>
                   {t('schedule.lesson_editor.add_link', lang)}
               </Text>
           </TouchableOpacity>
        ) : (
            linksArr.map((id, index) => {
                const visual = getItemVisual?.("link", id);
                return (
                  <SettingsRow
                      key={`link-${id}`}
                      label={`${t('common.link', lang)} ${index + 1}`}
                      value={safeGetLabel("link", id)}
                      onPress={() => setActivePicker("link", index)}
                      onEdit={() => onDirectEdit("link", id, index)}
                      themeColors={themeColors}
                      icon={visual?.icon || LinkIcon}
                      iconColor={visual?.color || themeColors.accentColor}
                      iconBgColor={visual?.color ? visual.color + "15" : undefined}
                      iconWeight="bold"
                  />
                );
            })
        )}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('attachments.title', lang)}
        showScopeToggle scope={scopes.attachments} onScopeChange={(scope) => onScopeChange('attachments', scope)}
      >
        <AttachmentManager
          attachments={attachments}
          onChange={onAttachmentsChange}
          onRemoveStoredAttachment={onRemoveStoredAttachment}
          onUploadedAttachments={onUploadedAttachments}
          onUploadStateChange={onAttachmentUploadStateChange}
          userId={attachmentUserId}
          ownerAvailable={attachmentOwnerAvailable}
          disabled={attachmentUploadState?.uploading}
          uploadState={attachmentUploadState}
          fileLibrary={fileLibrary}
          onFileLibraryChange={onFileLibraryChange}
          storageLimitBytes={attachmentStorageLimitBytes}
          themeColors={themeColors}
          lang={lang}
        />
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.reminders.title', lang)}
      >
        <SettingsRow
          label={t('schedule.reminders.mode', lang)}
          value={formatSubjectReminderValue()}
          onPress={() => toggleExpand("reminder")}
          themeColors={themeColors}
          icon={Bell}
        />

        {expandedField === "reminder" && (
          <View style={styles.reminderOptions}>
            <View style={styles.reminderChoiceGrid}>
              {[
                { id: "default", label: t('schedule.reminders.default', lang) },
                { id: "off", label: t('schedule.reminders.off', lang) },
                ...REMINDER_PRESET_MINUTES.map((minutesBefore) => ({
                  id: String(minutesBefore),
                  label: `${minutesBefore} ${t('schedule.main_screen.minutes', lang)}`,
                })),
                { id: "custom", label: t('common.custom', lang) },
              ].map((option) => {
                const selected = reminderSelectionId === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.reminderChoice,
                      {
                        backgroundColor: selected ? themeColors.accentColor : themeColors.backgroundColor,
                        borderColor: selected ? themeColors.accentColor : themeColors.borderColor,
                      },
                    ]}
                    onPress={() => handleSubjectReminderSelection(option.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected, checked: selected }}
                  >
                    <Text style={[styles.reminderChoiceText, { color: selected ? "#fff" : themeColors.textColor }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {reminderSelectionId === "custom" && (
              <View style={[styles.reminderInputWrapper, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.accentColor }]}>
                <TextInput
                  style={[styles.reminderInput, { color: themeColors.textColor }]}
                  accessibilityLabel={t('schedule.reminders.custom_placeholder', lang)}
                  value={customSubjectReminderMinutes}
                  onChangeText={handleSubjectCustomReminderChange}
                  placeholder={t('schedule.reminders.custom_placeholder', lang)}
                  placeholderTextColor={themeColors.textColor2}
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="done"
                />
                <Text style={[styles.inputSuffix, { color: themeColors.textColor2 }]}>
                  {t('schedule.main_screen.minutes', lang)}
                </Text>
              </View>
            )}
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t("settings.sections.appearance", lang)}
      >
        <TouchableOpacity onPress={onEditSubjectColor} accessibilityRole="button" accessibilityLabel={t('common.card_color', lang)} activeOpacity={0.8} style={{ margin: 8, borderRadius: 12, overflow: 'hidden' }}>
          <GradientBackground gradient={cardGradient} fallbackColor={cardColor} style={{ minHeight: 48, padding: 12 }}>
            <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', alignSelf: 'flex-start', borderRadius: 8, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Palette size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t('common.card_color', lang)}</Text>
            </View>
          </GradientBackground>
        </TouchableOpacity>
        <SettingsRow
          label={t('schedule.main_screen.subject_icon', lang)}
          rightContent={renderIconValue()}
          onPress={() => setActivePicker("icon")}
          themeColors={themeColors}
          icon={ImageIcon}
        />
      </SettingsGroup>

    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  conflictBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  slotConflict: { width: '100%', maxWidth: 460, padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  slotActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotAction: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  slotOption: { minHeight: 52, minWidth: 112, padding: 10, borderWidth: 1, borderRadius: 12, gap: 4 },
  content: { flex: 1 },
  introduction: { alignItems: 'center', padding: 24, gap: 12, marginBottom: 16 },
  introTitle: { fontSize: 21, lineHeight: 28, fontWeight: '600', textAlign: 'center' },
  introText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  recurrenceHelp: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  recurrenceWeekChoice: {
    minWidth: 52,
  },
  timePickerContainer: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    paddingBottom: 16,
  },
  reminderOptions: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  reminderChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderChoice: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reminderChoiceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderInputWrapper: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  reminderInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  durationContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorPreview: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  emptyContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyAddIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
  }
});

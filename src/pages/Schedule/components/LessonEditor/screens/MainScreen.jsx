import React, { useEffect, useState, useRef } from "react";
import { ScrollView, StyleSheet, View, Text, Platform, LayoutAnimation, UIManager, TouchableOpacity, TextInput, Alert } from "react-native";
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
  ArrowsCounterClockwise
} from "phosphor-react-native";

import SettingsGroup from "../../../../../components/ui/SettingsKit/SettingsGroup";
import SettingsRow from "../../../../../components/ui/SettingsKit/SettingsRow";
import AttachmentManager from "../../../../../components/attachments/AttachmentManager";

import GradientBackground from "../../../../../components/ui/GradientBackground";
import themes from "../../../../../config/themes";
import { getIconComponent } from "../../../../../config/subjectIcons"; 
import { useScheduleData } from "../../../../../context/ScheduleProvider";
import { t } from "../../../../../utils/i18n";
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
import { getDurationMinutes } from "../../../../../utils/scheduleTime";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LessonEditorMainScreen({
  themeColors,
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
  onFileLibraryChange,
  attachmentStorageLimitBytes
}) {
  const { global, lang } = useScheduleData();
  const [expandedField, setExpandedField] = useState(null);
  const [customSubjectReminderMinutes, setCustomSubjectReminderMinutes] = useState(String(CUSTOM_REMINDER_FALLBACK_MINUTES));
  const scrollViewRef = useRef(null);

  const safeGetLabel = getLabel || ((type, val) => t('schedule.main_screen.not_defined', lang));

  const isCustomStart = instanceData?.startTime !== undefined;
  const isCustomEnd = instanceData?.endTime !== undefined;

  const currentStart = isCustomStart ? instanceData.startTime : defaultTime?.start;
  const currentEnd = isCustomEnd ? instanceData.endTime : defaultTime?.end;
  
  const isTimeModified = currentStart !== defaultTime?.start || currentEnd !== defaultTime?.end;

  const duration = getDurationMinutes(currentStart, currentEnd);
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
    triggerHaptic(expandedField === field ? "sheetClose" : "expand");
    if (Platform.OS === 'android') {
        setExpandedField(field);
    } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedField(prev => {
            const nextField = prev === field ? null : field;
            if (nextField) {
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 250);
            }
            return nextField;
        });
    }
  };

  const interpolate = (template, params) => (
    Object.entries(params).reduce(
      (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
      template
    )
  );

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
                display="default"
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

  const renderColorPreview = () => {
    if (currentSubject?.typeColor === "gradient" && currentSubject?.colorGradient) {
      const grad = gradients.find((g) => g.id === currentSubject.colorGradient);
      return grad ? <GradientBackground gradient={grad} style={styles.colorPreview} /> : null;
    }
    const color = themes.accentColors[currentSubject?.color] || currentSubject?.color || themes.accentColors.grey;
    return <View style={[styles.colorPreview, { backgroundColor: color }]} />;
  };

  const renderHeaderRight = (showScopeToggle, scope, onScopeChangeHandler, onAdd, onReset) => {
    const hasButtons = showScopeToggle || onAdd || onReset;
    if (!hasButtons) return null;

    return (
      <>
        {showScopeToggle && onScopeChangeHandler && (
          <TouchableOpacity
            style={[
              styles.headerActionButton,
              { 
                backgroundColor: scope === "local" ? themeColors.accentColor : themeColors.backgroundColor2, 
                paddingHorizontal: 10, 
                width: 'auto' 
              }
            ]}
            onPress={() => {
              triggerHaptic(scope === "local" ? "toggleOff" : "toggleOn");
              onScopeChangeHandler(scope === "local" ? "global" : "local");
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: scope === "local" ? "#fff" : themeColors.textColor }}>
              {scope === "local" ? t('schedule.lesson_editor.scope_local', lang) : t('schedule.lesson_editor.scope_global', lang)}
            </Text>
          </TouchableOpacity>
        )}

        {onAdd && (
          <TouchableOpacity
            style={[styles.headerActionButton, { backgroundColor: themeColors.backgroundColor2 }]}
            onPress={() => {
              triggerHaptic("open");
              onAdd();
            }}
            activeOpacity={0.7}
          >
            <Plus size={18} color={themeColors.textColor} weight="bold" />
          </TouchableOpacity>
        )}

        {onReset && (
          <TouchableOpacity
            style={[styles.headerActionButton, { backgroundColor: themeColors.backgroundColor2 }]}
            onPress={() => {
              triggerHaptic("warning");
              onReset();
            }}
            activeOpacity={0.7}
          >
            <ArrowsCounterClockwise size={18} color={themeColors.textColor} weight="bold" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  if (!selectedSubjectId) {
    return (
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup 
          themeColors={themeColors} 
          title={t('schedule.main_screen.subject', lang)}
        >
          <SettingsRow
            label={t('schedule.main_screen.subject_name', lang)}
            value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
            onPress={() => setActivePicker("subject")}
            themeColors={themeColors}
            icon={BookOpen}
          />
        </SettingsGroup>
      </ScrollView>
    );
  }

  const { array: teachersArr } = getArrayData("teachers", "people");
  const { array: linksArr } = getArrayData("links", "materials");

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.content}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
    >
      
      <SettingsGroup
        themeColors={themeColors}
        title={t('schedule.main_screen.subject', lang)} 
        headerRight={renderHeaderRight(false, null, null, null, onClearSubject)}
      >
        <SettingsRow
          label={t('schedule.main_screen.subject_name', lang)}
          value={safeGetLabel("subject", selectedSubjectId) || t('schedule.lesson_editor.not_selected', lang)}
          onPress={() => setActivePicker("subject")}
          themeColors={themeColors}
          icon={BookOpen}
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
                  label: String(minutesBefore),
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
        title={t('schedule.main_screen.lesson_type_group', lang)}
        headerRight={renderHeaderRight(true, scopes.type, (s) => onScopeChange('type', s), null, null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.lesson_type_label', lang)}
          value={getValueLabel("type", "type", "type")}
          onPress={() => setActivePicker("type")}
          themeColors={themeColors}
          icon={Tag}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.location', lang)}
        headerRight={renderHeaderRight(true, scopes.location, (s) => onScopeChange('location', s), null, null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.building', lang)}
          value={getValueLabel("building", "text", "location")}
          onPress={() => setActivePicker("building")}
          themeColors={themeColors}
          icon={Buildings}
        />
        <SettingsRow
          label={t('schedule.main_screen.room', lang)}
          value={getValueLabel("room", "text", "location")}
          onPress={() => setActivePicker("room")}
          themeColors={themeColors}
          icon={MapPin}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.people', lang)}
        headerRight={renderHeaderRight(true, scopes.people, (s) => onScopeChange('people', s), () => setActivePicker('teacher', teachersArr.length), null)}
      >
        {teachersArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   {t('schedule.main_screen.no_teachers', lang)}
               </Text>
           </View>
        ) : (
            teachersArr.map((id, index) => (
                <SettingsRow
                    key={`teacher-${id}`}
                    label={`${t('schedule.main_screen.teacher', lang)} ${index + 1}`}
                    value={safeGetLabel("teacher", id)}
                    onPress={() => setActivePicker("teacher", index)}
                    onLongPress={() => onDirectEdit("teacher", id, index)} 
                    themeColors={themeColors}
                    icon={User}
                />
            ))
        )}
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.materials', lang)}
        headerRight={renderHeaderRight(true, scopes.materials, (s) => onScopeChange('materials', s), () => setActivePicker('link', linksArr.length), null)}
      >
        {linksArr.length === 0 ? (
           <View style={styles.emptyContainer}>
               <Text style={[styles.emptyText, { color: themeColors.textColor2 }]}>
                   {t('schedule.main_screen.no_links', lang)}
               </Text>
           </View>
        ) : (
            linksArr.map((id, index) => (
                <SettingsRow
                    key={`link-${id}`}
                    label={`${t('schedule.main_screen.link', lang)} ${index + 1}`}
                    value={safeGetLabel("link", id)}
                    onPress={() => setActivePicker("link", index)}
                    onLongPress={() => onDirectEdit("link", id, index)} 
                    themeColors={themeColors}
                    icon={LinkIcon}
                />
            ))
        )}
      </SettingsGroup>

      <SettingsGroup
        themeColors={themeColors}
        title={t('attachments.title', lang)}
        headerRight={renderHeaderRight(true, scopes.attachments, (s) => onScopeChange('attachments', s), null, null)}
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
        title={t('schedule.main_screen.appearance', lang)}
      >
        <SettingsRow
          label={t('schedule.main_screen.card_color', lang)}
          rightContent={renderColorPreview()}
          onPress={onEditSubjectColor} 
          themeColors={themeColors}
          icon={Palette}
        />
        <SettingsRow
          label={t('schedule.main_screen.subject_icon', lang)}
          rightContent={renderIconValue()}
          onPress={() => setActivePicker("icon")}
          themeColors={themeColors}
          icon={ImageIcon}
        />
      </SettingsGroup>

      <SettingsGroup 
        themeColors={themeColors} 
        title={t('schedule.main_screen.time', lang) || "Час заняття"} 
        headerRight={renderHeaderRight(false, null, null, null, isTimeModified ? () => {
            onTimeChange("startTime", null);
            onTimeChange("endTime", null);
        } : null)}
      >
        <SettingsRow
          label={t('schedule.main_screen.start_time', lang) || "Початок"}
          rightContent={renderTimeValue(currentStart, isTimeModified)}
          onPress={() => toggleExpand("startTime")}
          themeColors={themeColors}
          icon={Clock}
        />
        {expandedField === "startTime" && renderTimePicker("startTime", currentStart)}

        <SettingsRow
          label={t('schedule.main_screen.end_time', lang) || "Кінець"}
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
      </SettingsGroup>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  headerActionButton: {
    width: 34,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
    height: 40,
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
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  emptyContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 15,
  }
});

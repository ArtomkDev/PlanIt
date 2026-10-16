import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Bell, CheckSquare } from 'phosphor-react-native';
import SettingsGroup from './ui/SettingsKit/SettingsGroup';
import SettingsRow from './ui/SettingsKit/SettingsRow';
import AppSwitch from './ui/AppSwitch';
import { t } from '../utils/i18n';
import { triggerHaptic } from '../utils/haptics';
import { CUSTOM_REMINDER_FALLBACK_MINUTES, REMINDER_PRESET_MINUTES, clampReminderMinutes, getScheduleReminderSelectionId, normalizeScheduleReminder } from '../utils/reminderSettings';
import { TASK_AUTO_LINK_MODES, getTaskAutoLinkMode } from '../utils/taskLessonLinking';
import { NOTIFICATION_TYPES, ensureNotificationPushPermissionsForType } from '../services/notificationService';

export default function SchedulePreferencesEditor({ value, onChange, themeColors, lang, notificationPreferences, active = true }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    if (!active) setPending(false);
    return () => { requestId.current += 1; };
  }, [active]);
  const reminder = normalizeScheduleReminder(value.reminder);
  const selection = getScheduleReminderSelectionId(reminder);
  const [customMinutes, setCustomMinutes] = useState(() => selection === 'custom'
    ? String(reminder.minutesBefore) : String(CUSTOM_REMINDER_FALLBACK_MINUTES));
  const nextLesson = getTaskAutoLinkMode(value) === TASK_AUTO_LINK_MODES.NEXT_SAME;
  const changeReminder = async (id) => {
    const request = ++requestId.current;
    if (id === 'off') {
      setPending(false);
      triggerHaptic('toggleOff');
      onChange(prev => ({ ...prev, reminder: { enabled: false } }));
      return;
    }
    setPending(true);
    try {
      const permission = await ensureNotificationPushPermissionsForType(NOTIFICATION_TYPES.LESSON_REMINDER, {
        request: true, notificationPreferences,
      });
      if (request !== requestId.current) return;
      if (!permission.disabledByPreference && !permission.granted && permission.status !== 'unsupported') {
        Alert.alert(t('common.warning', lang), t('schedule.reminders.permission_denied', lang));
        return;
      }
      const minutesBefore = clampReminderMinutes(id === 'custom' ? customMinutes : id, CUSTOM_REMINDER_FALLBACK_MINUTES);
      if (id === 'custom') setCustomMinutes(String(minutesBefore));
      triggerHaptic('toggleOn');
      onChange(prev => ({ ...prev, reminder: { enabled: true, minutesBefore } }));
    } catch (_error) {
      if (request === requestId.current) Alert.alert(t('common.error', lang), t('common.action_failed', lang));
    } finally {
      if (request === requestId.current) setPending(false);
    }
  };
  const changeAutoLink = (enabled) => {
    triggerHaptic(enabled ? 'toggleOn' : 'toggleOff');
    onChange(prev => ({ ...prev, taskAutoLinkMode: enabled ? TASK_AUTO_LINK_MODES.NEXT_SAME : TASK_AUTO_LINK_MODES.SELECTED }));
  };
  return (
    <SettingsGroup themeColors={themeColors}>
      <SettingsRow label={t('schedule.reminders.title', lang)}
        value={reminder.enabled ? t('schedule.reminders.before_minutes', lang, { minutes: reminder.minutesBefore }) : t('schedule.reminders.off', lang)}
        icon={Bell} themeColors={themeColors} onPress={() => setExpanded(!expanded)} accessibilityState={{ expanded }} />
      {expanded && <View style={styles.options}>
        <View style={styles.choices}>
          {[{ id: 'off', label: t('schedule.reminders.off', lang) },
            ...REMINDER_PRESET_MINUTES.map(minutes => ({ id: String(minutes), label: String(minutes) })),
            { id: 'custom', label: t('common.custom', lang) }].map(option => {
            const selected = selection === option.id;
            const disabled = pending && option.id !== 'off';
            return <TouchableOpacity key={option.id} accessibilityRole="radio" disabled={disabled}
              accessibilityState={{ checked: selected, disabled, busy: pending }}
              accessibilityLabel={option.id === 'off' || option.id === 'custom' ? option.label : t('schedule.reminders.before_minutes', lang, { minutes: option.label })}
              onPress={() => changeReminder(option.id)} activeOpacity={0.7}
              style={[styles.choice, { opacity: disabled ? 0.5 : 1, backgroundColor: selected ? themeColors.accentColor : themeColors.backgroundColor, borderColor: selected ? themeColors.accentColor : themeColors.borderColor }]}>
              <Text style={[styles.choiceText, { color: selected ? themeColors.textOnAccent : themeColors.textColor }]}>{option.label}</Text>
            </TouchableOpacity>;
          })}
        </View>
        {selection === 'custom' && <View style={[styles.customField, { backgroundColor: themeColors.backgroundColor, borderColor: themeColors.accentColor }]}>
          <TextInput accessibilityLabel={t('schedule.reminders.custom_placeholder', lang)} value={customMinutes}
            placeholder={t('schedule.reminders.custom_placeholder', lang)} placeholderTextColor={themeColors.textColor2}
            onChangeText={text => {
              const numeric = text.replace(/[^0-9]/g, '').slice(0, 4);
              const minutesBefore = clampReminderMinutes(numeric, 0);
              setCustomMinutes(numeric === '' ? '' : String(minutesBefore));
              onChange(prev => ({ ...prev, reminder: { enabled: true, minutesBefore } }));
            }} keyboardType="number-pad" inputMode="numeric" maxLength={4} returnKeyType="done"
            style={[styles.input, { color: themeColors.textColor }]} />
          <Text style={{ color: themeColors.textColor2 }}>{t('schedule.main_screen.minutes', lang)}</Text>
        </View>}
      </View>}
      <SettingsRow label={t('settings.schedule_editor.task_auto_link', lang)} desc={t('settings.schedule_editor.task_auto_link_hint', lang)}
        icon={CheckSquare} themeColors={themeColors} showCaret={false} skipHaptic accessibilityRole="switch"
        accessibilityState={{ checked: nextLesson }} rightContentPointerEvents="none" onPress={() => changeAutoLink(!nextLesson)}
        rightContent={<AppSwitch accessibilityLabel={t('settings.schedule_editor.task_auto_link', lang)} value={nextLesson}
          onValueChange={changeAutoLink} themeColors={themeColors} interactive={false} />} />
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  options: { padding: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 58, minHeight: 44, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 12, alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  customField: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginTop: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 12, fontSize: 16 },
});

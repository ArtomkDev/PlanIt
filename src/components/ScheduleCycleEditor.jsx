import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { CalendarBlank, Stack } from 'phosphor-react-native';
import SettingsGroup from './ui/SettingsKit/SettingsGroup';
import SettingsRow from './ui/SettingsKit/SettingsRow';
import TabSwitcher from './ui/TabSwitcher';
import CalendarSheet from './CalendarSheet/CalendarSheet';
import { MAX_SCHEDULE_WEEKS, normalizeScheduleRepeat } from '../utils/scheduleTime';
import { t } from '../utils/i18n';

export default function ScheduleCycleEditor({ value, onChange, themeColors, lang, active = true }) {
  const [calendarVisible, setCalendarVisible] = useState(false);
  useEffect(() => { if (!active) setCalendarVisible(false); }, [active]);
  const date = new Date(value.starting_week);
  const customRepeat = !['1', '2', '3', '4'].includes(String(value.repeat));
  const updateRepeat = (repeat) => onChange({ ...value, repeat });

  return (
    <SettingsGroup title={t('onboarding.step2_title', lang)} themeColors={themeColors}>
      <SettingsRow label={t('settings.menu.weeks.title', lang)} desc={t('onboarding.weeks_count_desc', lang)}
        icon={Stack} themeColors={themeColors} showCaret={false} />
      <View style={styles.options}>
        <TabSwitcher tabs={[1, 2, 3, 4].map(week => ({ id: String(week), label: String(week) }))}
          activeTab={String(value.repeat)} onTabPress={updateRepeat} themeColors={themeColors}
          containerBackgroundColor={themeColors.backgroundColor} containerBorderColor={themeColors.borderColor} />
        <Text style={[styles.label, { color: themeColors.textColor2 }]}>
          {t('settings.schedule_editor.cycle_range', lang, { count: MAX_SCHEDULE_WEEKS })}
        </Text>
        <TextInput accessibilityLabel={t('settings.week_manager.repeat_label', lang)}
          value={String(value.repeat)}
          onChangeText={text => updateRepeat(text.replace(/[^0-9]/g, '').slice(0, 2))}
          onBlur={() => updateRepeat(String(normalizeScheduleRepeat(value.repeat)))}
          placeholder={t('settings.week_manager.repeat_label', lang)} placeholderTextColor={themeColors.textColor2}
          keyboardType="number-pad" inputMode="numeric" returnKeyType="done" maxLength={2} selectTextOnFocus
          style={[styles.input, { backgroundColor: themeColors.backgroundColor, color: themeColors.textColor, borderColor: customRepeat ? themeColors.accentColor : themeColors.borderColor }]} />
      </View>
      <SettingsRow label={t('settings.menu.start_date.title', lang)}
        value={date.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })}
        desc={t('onboarding.starting_week_desc', lang)} valuePosition="below"
        icon={CalendarBlank} themeColors={themeColors} onPress={() => setCalendarVisible(true)} />
      <CalendarSheet visible={active && calendarVisible} onClose={() => setCalendarVisible(false)}
        currentDate={date} customSchedule={{ ...value, repeat: normalizeScheduleRepeat(value.repeat) }}
        onDateSelect={selected => { onChange({ ...value, starting_week: selected.toISOString() }); setCalendarVisible(false); }} />
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  options: { padding: 16, paddingTop: 4 },
  label: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});

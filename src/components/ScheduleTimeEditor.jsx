import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock, Hourglass, Plus, Minus, CaretDown } from 'phosphor-react-native';
import SettingsGroup from './ui/SettingsKit/SettingsGroup';
import SettingsRow from './ui/SettingsKit/SettingsRow';
import TabSwitcher from './ui/TabSwitcher';
import { t } from '../utils/i18n';
import { buildScheduleSlots, MAX_LESSON_SLOTS, updateScheduleSlotTime } from '../utils/scheduleTime';
import { triggerHaptic } from '../utils/haptics';

export default function ScheduleTimeEditor({ value, onChange, themeColors, lang, mode = 'light', title, minimumSlots = 1, active = true }) {
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [picker, setPicker] = useState(null);
  const [timeError, setTimeError] = useState(false);
  const slots = buildScheduleSlots(value.start_time, value.duration, value.breaks, value.slotDurations);
  const preview = slots;
  const count = value.slotDurations.length;
  const visibleCount = showAll ? count : Math.min(count, 6);
  const uniformDuration = value.slotDurations.every((duration) => Number(duration) === Number(value.slotDurations[0]));
  const copy = (key, params) => t(`settings.schedule_editor.timing.${key}`, lang, params);
  const minutes = t('schedule.main_screen.minutes', lang);
  const errorColor = mode === 'dark' || mode === 'oled' ? '#FF8A80' : '#B91C1C';
  const invalidNumber = (number, minimum) => String(number).trim() === '' || !Number.isInteger(Number(number)) || Number(number) < minimum || Number(number) > 600;

  useEffect(() => {
    if (!active) setPicker(null);
  }, [active]);

  const commit = (next) => {
    setTimeError(false);
    onChange(next);
  };
  const setDuration = (text, index) => {
    setPicker(null);
    const numeric = text.replace(/[^0-9]/g, '').slice(0, 3);
    commit(index === undefined
      ? { ...value, duration: numeric, slotDurations: value.slotDurations.map(() => numeric) }
      : { ...value, duration: index === 0 ? numeric : value.duration, slotDurations: value.slotDurations.map((duration, i) => i === index ? numeric : duration) });
  };
  const setBreak = (text, index) => {
    setPicker(null);
    const numeric = text.replace(/[^0-9]/g, '').slice(0, 3);
    commit({ ...value, breaks: value.breaks.map((gap, i) => index === undefined || i === index ? numeric : gap) });
  };
  const openPicker = (index, field, header = false) => {
    const isFirstStart = index === 0 && field === 'start';
    const time = isFirstStart ? value.start_time : preview[index]?.[field];
    if (!time || (!isFirstStart && !slots.length)) return;
    triggerHaptic('selection');
    setTimeError(false);
    setPicker({ index, field, time, header });
  };
  const commitTime = (time) => {
    const next = updateScheduleSlotTime(value, picker.index, picker.field, time);
    if (!next) {
      setTimeError({ ...picker });
      return false;
    }
    commit(next);
    return true;
  };
  const changeCount = (delta) => {
    const nextCount = count + delta;
    if (nextCount < minimumSlots || nextCount < 1 || nextCount > MAX_LESSON_SLOTS) return;
    const next = delta > 0 ? {
      ...value,
      slotDurations: [...value.slotDurations, value.slotDurations.at(-1)],
      breaks: [...value.breaks, value.breaks.at(-1) ?? 10],
    } : { ...value, slotDurations: value.slotDurations.slice(0, -1), breaks: value.breaks.slice(0, -1) };
    if (delta > 0 && !buildScheduleSlots(next.start_time, next.duration, next.breaks, next.slotDurations).length) {
      setTimeError({ count: true });
      return;
    }
    triggerHaptic('selection');
    setPicker(null);
    if (delta > 0) setShowAll(nextCount > 6);
    commit(next);
  };
  const numberInput = (label, number, onChangeText, minimum = 0) => (
    <View>
    <View style={[styles.numberField, { backgroundColor: themeColors.backgroundColor, borderColor: invalidNumber(number, minimum) ? errorColor : themeColors.borderColor }]}>
      <TextInput
        accessibilityLabel={label}
        style={[styles.numberInput, { color: themeColors.textColor }]}
        value={String(number ?? '')}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        maxLength={3}
        selectTextOnFocus
      />
      <Text style={[styles.unit, { color: themeColors.textColor2 }]}>{minutes}</Text>
    </View>
    {invalidNumber(number, minimum) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={[styles.fieldError, { color: errorColor }]}>{copy(minimum ? 'duration_range' : 'break_range')}</Text>}
    </View>
  );
  const renderPicker = (index, field, header = false) => {
    if (!active || picker?.index !== index || picker.field !== field || picker.header !== header) return null;
    const [hours, minute] = picker.time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minute, 0, 0);
    const formatDate = (selected) => `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
    if (Platform.OS === 'android') return (
      <DateTimePicker
        value={date} mode="time" is24Hour design="material"
        positiveButton={{ textColor: themeColors.accentColor }}
        negativeButton={{ textColor: themeColors.textColor2 }}
        onChange={(event, selected) => {
          if (event.type === 'set' && selected) commitTime(formatDate(selected));
          setPicker(null);
        }}
      />
    );
    if (Platform.OS === 'web') return (
      <View style={styles.picker}>
        <input type="time" aria-label={copy(field)} value={picker.time}
          onChange={(event) => { if (commitTime(event.target.value)) setPicker({ ...picker, time: event.target.value }); }}
          style={{ boxSizing: 'border-box', width: '100%', minHeight: 48, padding: 12, fontSize: 20, borderRadius: 12, border: `1px solid ${themeColors.borderColor}`, backgroundColor: themeColors.backgroundColor, color: themeColors.textColor }} />
        {renderPickerActions()}
      </View>
    );
    return (
      <View style={styles.picker}>
        <DateTimePicker value={date} mode="time" is24Hour display="spinner"
          themeVariant={mode === 'dark' || mode === 'oled' ? 'dark' : 'light'}
          textColor={themeColors.textColor} style={styles.iosPicker}
          onChange={(_, selected) => {
            if (selected && commitTime(formatDate(selected))) setPicker({ ...picker, time: formatDate(selected) });
          }} />
        {renderPickerActions()}
      </View>
    );
  };
  const renderPickerActions = () => (
    <View style={styles.pickerActions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('common.done', lang)}
        style={styles.textButton} onPress={() => { if (commitTime(picker.time)) setPicker(null); }}>
        <Text style={[styles.buttonText, { color: themeColors.accentTextColor }]}>{t('common.done', lang)}</Text>
      </TouchableOpacity>
    </View>
  );
  const renderTimeError = (index, header = false) => timeError?.index === index && timeError.header === header ? (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: errorColor }]}>{copy('invalid')}</Text>
  ) : null;

  return (
    <View style={styles.container}>
      <SettingsGroup title={title} themeColors={themeColors}>
        <SettingsRow label={t('settings.menu.start_time.title', lang)} value={value.start_time} icon={Clock}
          themeColors={themeColors} onPress={() => openPicker(0, 'start', true)} />
        {renderPicker(0, 'start', true)}
        {renderTimeError(0, true)}
        <SettingsRow label={t('settings.menu.duration.title', lang)}
          desc={copy('bulk_hint')} value={uniformDuration ? `${value.slotDurations[0]} ${minutes}` : copy('different')}
          valuePosition="below"
          icon={Hourglass} themeColors={themeColors} onPress={() => setBulkExpanded(!bulkExpanded)}
          accessibilityState={{ expanded: bulkExpanded }} />
        {bulkExpanded && (
          <View style={styles.bulk}>
            <Text style={[styles.label, { color: themeColors.textColor }]}>{copy('all_durations')}</Text>
            <TabSwitcher tabs={[45, 60, 80, 90].map((duration) => ({ id: String(duration), label: String(duration) }))}
              activeTab={uniformDuration ? String(value.slotDurations[0]) : ''}
              onTabPress={(duration) => setDuration(duration)} themeColors={themeColors}
              containerBackgroundColor={themeColors.backgroundColor} containerBorderColor={themeColors.borderColor} />
            <View style={styles.bulkInput}>
              {numberInput(t('schedule.main_screen.duration', lang), value.duration, (text) => setDuration(text), 1)}
            </View>
            {count > 1 && (
              <View style={styles.fieldRow}>
                <Text style={[styles.flexLabel, { color: themeColors.textColor }]}>{copy('all_breaks')}</Text>
                {numberInput(copy('all_breaks'), value.breaks[0], (text) => setBreak(text))}
              </View>
            )}
          </View>
        )}
      </SettingsGroup>

      <Text style={[styles.label, { color: themeColors.textColor2, marginTop: 12 }]}>{copy('slot_count', { count })}</Text>
      <View style={styles.countActions}>
        {[{ delta: -1, Icon: Minus, label: 'remove', disabled: count <= Math.max(1, minimumSlots) },
          { delta: 1, Icon: Plus, label: 'add', disabled: count >= MAX_LESSON_SLOTS }].map(({ delta, Icon, label, disabled }) => (
          <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={copy(label)}
            accessibilityState={{ disabled }} disabled={disabled} onPress={() => changeCount(delta)}
            style={[styles.countButton, { borderColor: themeColors.borderColor, opacity: disabled ? 0.45 : 1 }]}>
            <Icon size={20} color={themeColors.accentTextColor} />
            <Text style={[styles.countLabel, { color: themeColors.accentTextColor }]}>{copy(label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!slots.length && <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={[styles.error, { color: errorColor }]}>{copy('invalid')}</Text>}
      <Text style={[styles.hint, { color: themeColors.textColor2 }]}>{copy('hint')}</Text>
      {value.slotDurations.slice(0, visibleCount).map((duration, index) => (
        <View key={index}>
          <View style={[styles.slot, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
            <View style={styles.slotHeading}>
              <Text style={[styles.slotTitle, { color: themeColors.textColor }]}>{copy('lesson', { number: index + 1 })}</Text>
              {numberInput(copy('lesson_duration', { number: index + 1 }), duration, (text) => setDuration(text, index), 1)}
            </View>
            <View style={styles.timeRow}>
              {['start', 'end'].map((field) => (
                <TouchableOpacity key={field} accessibilityRole="button"
                  accessibilityLabel={copy('lesson_time', { number: index + 1, field: copy(field), time: preview[index]?.[field] || '—' })}
                  disabled={!slots.length} accessibilityState={{ disabled: !slots.length }}
                  style={[styles.timeButton, { borderColor: themeColors.borderColor, backgroundColor: themeColors.backgroundColor, opacity: slots.length ? 1 : 0.5 }]}
                  onPress={() => openPicker(index, field)} activeOpacity={0.7}>
                  <Text style={[styles.timeLabel, { color: themeColors.textColor2 }]}>{copy(field)}</Text>
                  <Text style={[styles.time, { color: themeColors.textColor }]}>{preview[index]?.[field] || '—'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {renderPicker(index, 'start')}
            {renderPicker(index, 'end')}
            {renderTimeError(index)}
          </View>
          {index < count - 1 && (
            <View style={styles.breakRow}>
              <View style={styles.breakLabel}>
                <Text style={[styles.label, { color: themeColors.textColor2 }]}>{copy('break_after', { number: index + 1 })}</Text>
                <Text style={[styles.timeLabel, { color: themeColors.textColor2 }]}>{preview[index]?.end || '—'} → {preview[index + 1]?.start || '—'}</Text>
              </View>
              {numberInput(`${t('schedule.day_schedule.break', lang)} ${index + 1}`, value.breaks[index], (text) => setBreak(text, index))}
            </View>
          )}
        </View>
      ))}
      {count > 6 && (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={copy(showAll ? 'show_less' : 'show_all', { count })}
          accessibilityState={{ expanded: showAll }} style={styles.showMore} onPress={() => setShowAll(!showAll)}>
          <Text style={[styles.buttonText, { color: themeColors.accentTextColor }]}>{copy(showAll ? 'show_less' : 'show_all', { count })}</Text>
          <CaretDown size={18} color={themeColors.accentTextColor} />
        </TouchableOpacity>
      )}
      {minimumSlots > 1 && <Text style={[styles.hint, { color: themeColors.textColor2 }]}>{copy('used_slots', { count: minimumSlots })}</Text>}
      {timeError?.count && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: errorColor }]}>{copy('invalid')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  bulk: { padding: 16, gap: 10 },
  bulkInput: { alignItems: 'flex-end' },
  label: { fontSize: 14, fontWeight: '600' },
  flexLabel: { flex: 1, fontSize: 14, marginRight: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  slot: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 12, marginBottom: 4 },
  slotHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  slotTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeButton: { flex: 1, minHeight: 64, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  timeLabel: { fontSize: 12, lineHeight: 17 },
  time: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 2 },
  numberField: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10 },
  numberInput: { width: 48, fontSize: 16, fontWeight: '600', textAlign: 'center', paddingVertical: 10 },
  unit: { fontSize: 13, marginLeft: 4 },
  breakRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  breakLabel: { flexShrink: 1, gap: 2 },
  showMore: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  countActions: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 12 },
  countButton: { flex: 1, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 6 },
  countLabel: { flexShrink: 1, fontSize: 14, fontWeight: '600' },
  picker: { padding: 8 },
  iosPicker: { height: 160, width: '100%' },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
  textButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  fieldError: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});

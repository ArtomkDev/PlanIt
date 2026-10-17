import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flask } from 'phosphor-react-native';
import { useScheduleActions, useScheduleData } from '../../context/ScheduleProvider';
import { createCollegeTestSchedule } from '../../config/development/collegeSchedule';
import SettingsRow from '../ui/SettingsKit/SettingsRow';

const copy = {
  uk: {
    title: 'Створити тестовий розклад',
    description: 'Коледж «Освіта» · 2 тижні · заняття, викладачі та Zoom',
    note: 'Дати-винятки з Word збережено в нотатках занять. Відлік тижнів — від поточного понеділка.',
    created: 'Тестовий розклад створено',
  },
  en: {
    title: 'Create test timetable',
    description: 'Osvita College · 2 weeks · classes, teachers and Zoom',
    note: 'Date exceptions from Word are kept in lesson notes. The cycle starts this Monday.',
    created: 'Test timetable created',
  },
};

export default function CreateTestScheduleButton({ themeColors, onCreated }) {
  const { lang } = useScheduleData();
  const { addSchedule, setGlobalDraft } = useScheduleActions();
  const createdRef = useRef(false);
  const [created, setCreated] = useState(false);
  const text = copy[lang] || copy.en;

  const handleCreate = () => {
    if (createdRef.current) return;
    createdRef.current = true;
    const schedule = createCollegeTestSchedule();
    addSchedule(schedule);
    setGlobalDraft(previous => ({ ...previous, currentScheduleId: schedule.id }));
    setCreated(true);
    onCreated?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
      <Text style={[styles.badge, { color: themeColors.accentTextColor }]}>DEV</Text>
      <SettingsRow
        icon={Flask}
        label={created ? text.created : text.title}
        desc={text.description}
        onPress={handleCreate}
        disabled={created}
        showCaret={false}
        themeColors={themeColors}
      />
      <Text style={[styles.note, { color: themeColors.textColor2 }]}>{text.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, letterSpacing: 1 },
  note: { fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 14 },
});

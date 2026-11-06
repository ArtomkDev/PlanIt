import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, Flask } from 'phosphor-react-native';
import { useScheduleActions, useScheduleData } from '../../context/ScheduleProvider';
import { createCollegeTestSchedule } from '../../config/development/collegeSchedule';
import { createUniversityContentSchedule } from '../../config/development/universityContentSchedule';
import SettingsRow from '../ui/SettingsKit/SettingsRow';

const copy = {
  uk: {
    college: {
      title: 'Створити тестовий розклад',
      description: 'Коледж «Освіта» · 2 тижні · заняття, викладачі та Zoom',
      note: 'Дати-винятки з Word збережено в нотатках занять. Відлік тижнів — від поточного понеділка.',
      created: 'Тестовий розклад створено',
    },
    content: {
      title: 'Створити розклад для контенту',
      description: 'Навчання · Група А · 7 предметів · 16 завдань',
      note: 'Два тижні загальних предметів, контрастні градієнти, іконки й аудиторії. Завдання прив’язані до найближчих занять.',
      created: 'Розклад для контенту створено',
    },
    contentEn: {
      title: 'Створити англомовний розклад',
      description: 'School · Year 10 · 7 subjects · 16 tasks',
      note: 'Британський шкільний приклад: місцеві імена, назви предметів, кабінети та домашні завдання. Два тижні з іконками й градієнтами.',
      created: 'Англомовний розклад створено',
    },
  },
  en: {
    college: {
      title: 'Create test timetable',
      description: 'Osvita College · 2 weeks · classes, teachers and Zoom',
      note: 'Date exceptions from Word are kept in lesson notes. The cycle starts this Monday.',
      created: 'Test timetable created',
    },
    content: {
      title: 'Create content timetable',
      description: 'Studies · Group A · 7 subjects · 16 tasks',
      note: 'Two weeks of general subjects, readable gradients, icons and rooms. Tasks are linked to nearby classes. Sample content is in Ukrainian.',
      created: 'Content timetable created',
    },
    contentEn: {
      title: 'Create English school timetable',
      description: 'School · Year 10 · 7 subjects · 16 tasks',
      note: 'A British school example with local teacher names, classrooms and homework. Two weeks with subject icons and gradients.',
      created: 'English content timetable created',
    },
  },
};

const presets = [
  { key: 'college', icon: Flask, createSchedule: createCollegeTestSchedule },
  { key: 'content', icon: Camera, createSchedule: createUniversityContentSchedule },
  { key: 'contentEn', icon: Camera, createSchedule: () => createUniversityContentSchedule(new Date(), 'en') },
];

export default function CreateTestScheduleButton({ themeColors, onCreated }) {
  const { lang } = useScheduleData();
  const { addSchedule, setGlobalDraft } = useScheduleActions();
  const createdRef = useRef(new Set());
  const [created, setCreated] = useState([]);
  const text = copy[lang] || copy.en;

  const handleCreate = ({ key, createSchedule }) => {
    if (createdRef.current.has(key)) return;
    const schedule = createSchedule();
    createdRef.current.add(key);
    addSchedule(schedule);
    setGlobalDraft(previous => ({ ...previous, currentScheduleId: schedule.id }));
    setCreated(previous => [...previous, key]);
    onCreated?.();
  };

  return (
    <>
      {presets.map(preset => {
        const labels = text[preset.key];
        const isCreated = created.includes(preset.key);
        return (
          <View key={preset.key} style={[styles.container, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
            <Text style={[styles.badge, { color: themeColors.accentTextColor }]}>DEV</Text>
            <SettingsRow
              icon={preset.icon}
              label={isCreated ? labels.created : labels.title}
              desc={labels.description}
              onPress={() => handleCreate(preset)}
              disabled={isCreated}
              showCaret={false}
              themeColors={themeColors}
            />
            <Text style={[styles.note, { color: themeColors.textColor2 }]}>{labels.note}</Text>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, letterSpacing: 1 },
  note: { fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 14 },
});

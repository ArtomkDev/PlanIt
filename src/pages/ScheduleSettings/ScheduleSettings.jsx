// src/pages/ScheduleSettings/ScheduleSettings.jsx
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SectionList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';

export default function ScheduleSettings() {
  const navigation = useNavigation();
  const { user, global, schedule } = useSchedule();

  // Тема з контексту
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  // Дані для коротких “статусів” праворуч
  const autoSaveEnabled = !!schedule?.autoSave?.enabled;
  const autoSaveInterval = schedule?.autoSave?.interval ?? null;

  const weeksCount =
    Array.isArray(schedule?.weeks) ? schedule.weeks.length :
    (typeof schedule?.weeksCount === 'number' ? schedule.weeksCount : undefined);

  const breaksCount = Array.isArray(schedule?.breaks) ? schedule.breaks.length : undefined;
  const subjectsCount = Array.isArray(schedule?.subjects) ? schedule.subjects.length : undefined;
  const teachersCount = Array.isArray(schedule?.teachers) ? schedule.teachers.length : undefined;

  // Секції меню
  const sections = useMemo(() => ([
    {
      title: 'Структура розкладу',
      data: [
        { label: 'Кількість тижнів', screen: 'Weeks', icon: 'layers-outline', meta: weeksCount ? String(weeksCount) : undefined, desc: 'Непарні/парні або цикл тижнів' },
        { label: 'Початкова дата', screen: 'StartWeek', icon: 'calendar-outline', desc: 'Звідси рахується № тижня' },
        { label: 'Кількість перерв', screen: 'Breaks', icon: 'timer-outline', meta: breaksCount ? String(breaksCount) : undefined, desc: 'Довжина та кількість перерв' },
        { label: 'Розклад', screen: 'Schedule', icon: 'grid-outline', desc: 'Редактор занять по днях' },
        { label: 'Глобальний розклад', screen: 'ScheduleSwitcher', icon: 'grid-outline', desc: 'Змінити глобальний розклад' },
      ],
    },
    {
      title: 'Дані',
      data: [
        { label: 'Пари', screen: 'Subjects', icon: 'book-outline', meta: subjectsCount ? String(subjectsCount) : undefined, desc: 'Список предметів / аудиторій' },
        { label: 'Викладачі', screen: 'Teachers', icon: 'people-outline', meta: teachersCount ? String(teachersCount) : undefined, desc: 'Контакти та скорочення' },
      ],
    },
    {
      title: 'Оформлення',
      data: [
        { label: 'Теми', screen: 'Theme', icon: 'color-palette-outline', desc: 'Світла/темна, акцент' },
      ],
    },
    {
      title: 'Автоматизація',
      data: [
        { label: 'Авто збереження', screen: 'AutoSave', icon: 'save-outline',
          meta: autoSaveEnabled ? (autoSaveInterval ? `кожні ${autoSaveInterval} хв` : 'увімкнено') : 'вимкнено',
          desc: 'Фонове збереження змін' },
      ],
    },
    {
      title: 'Акаунт',
      data: !user ? [
        { label: 'Увійти', screen: 'SignIn', icon: 'log-in-outline', desc: 'Увійти в існуючий акаунт' },
        { label: 'Створити акаунт', screen: 'SignUp', icon: 'person-add-outline', desc: 'Перенести локальні дані в хмару' },
      ] : [],
    },

    {
      title: 'Небезпечна зона',
      danger: true,
      data: [
        { label: 'Скинути БД', screen: 'ResetDB', icon: 'trash-outline', desc: 'Повне очищення даних' },
      ],
    },
  ]), [weeksCount, breaksCount, subjectsCount, teachersCount, autoSaveEnabled, autoSaveInterval]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(item.screen, { scheduleId: schedule?.id })}
      style={[
        styles.row,
        { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor },
      ]}
    >
      <View style={styles.left}>
        <Icon name={item.icon} size={20} color={themeColors.textColor2} style={{ marginRight: 10 }} />
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.title, { color: themeColors.textColor }]}>{item.label}</Text>
          {!!item.desc && (
            <Text style={[styles.desc, { color: themeColors.textColor2 }]} numberOfLines={1}>
              {item.desc}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
        {!!item.meta && <Text style={[styles.meta, { color: themeColors.textColor2 }]}>{item.meta}</Text>}
        <Icon name="chevron-forward" size={18} color={themeColors.textColor2} />
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }) => (
    <Text
      style={[
        styles.sectionHeader,
        { color: section.danger ? '#ff453a' : themeColors.textColor2, backgroundColor: themeColors.backgroundColor },
      ]}
    >
      {section.title}
    </Text>
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => `${item.screen}-${index}`}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled
      style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}
      contentContainerStyle={[styles.container]}
      SectionSeparatorComponent={() => <View style={{ height: 12 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 100,   // під прозорий header
    paddingBottom: 80,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 12, marginRight: 6 },
});

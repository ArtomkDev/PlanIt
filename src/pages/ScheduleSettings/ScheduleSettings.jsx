import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth'; // 1. Імпорт функції виходу

import { auth } from '../../../firebase';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import SettingsHeader from '../../components/SettingsHeader';

export default function ScheduleSettings({ guest, onExitGuest }) {
  const navigation = useNavigation();
  const { user, global, schedule } = useSchedule();
  const insets = useSafeAreaInsets();

  const headerHeight = 50 + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  const autoSaveVal = global?.auto_save; 
  const autoSaveEnabled = typeof autoSaveVal === 'number' && autoSaveVal > 0;
  
  const weeksCount = Array.isArray(schedule?.weeks) ? schedule.weeks.length : (typeof schedule?.weeksCount === 'number' ? schedule.weeksCount : undefined);
  const breaksCount = Array.isArray(schedule?.breaks) ? schedule.breaks.length : undefined;
  const subjectsCount = Array.isArray(schedule?.subjects) ? schedule.subjects.length : undefined;
  const teachersCount = Array.isArray(schedule?.teachers) ? schedule.teachers.length : undefined;

  // Дія для Гостя (повернутись на екран входу)
  const handleAuthAction = () => {
    if (guest && onExitGuest) {
      onExitGuest();
    }
  };

  // 3. Функція виходу з акаунта
  const handleSignOut = async () => {
    Alert.alert(
      "Вихід",
      "Ви впевнені, що хочете вийти з акаунту?",
      [
        { text: "Скасувати", style: "cancel" },
        { 
          text: "Вийти", 
          style: "destructive", 
          onPress: async () => {
            try {
              await signOut(auth);
              // App.js автоматично перекине на WelcomeScreen через onAuthStateChanged
            } catch (error) {
              console.error("Помилка виходу:", error);
              Alert.alert("Помилка", "Не вдалося вийти з акаунту");
            }
          } 
        }
      ]
    );
  };

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
        { 
          label: 'Авто збереження', 
          screen: 'AutoSave', 
          icon: 'save-outline',
          meta: autoSaveEnabled ? `кожні ${autoSaveVal} сек` : 'вимкнено',
          desc: 'Фонове збереження змін' 
        },
      ],
    },
    {
      title: 'Акаунт',
      // 4. Логіка відображення кнопок
      data: !user ? [
        { label: 'Увійти або Створити акаунт', action: handleAuthAction, icon: 'log-in-outline', desc: 'Синхронізуйте дані в хмарі' },
      ] : [
        { label: 'Пристрої', screen: 'DeviceService', icon: 'layers-outline', desc: 'Налаштування авторизованих пристроїв' },
        // 🔥 Додана кнопка виходу
        { label: 'Вийти з акаунту', action: handleSignOut, icon: 'log-out-outline', desc: 'Завершити сесію', danger: true },
      ],
    },
    {
      title: 'Небезпечна зона',
      danger: true,
      data: [
        { label: 'Скинути БД', screen: 'ResetDB', icon: 'trash-outline', desc: 'Повне очищення даних' },
      ],
    },
  ]), [weeksCount, breaksCount, subjectsCount, teachersCount, autoSaveEnabled, autoSaveVal, guest, user]);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const sectionPositions = useRef([]);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const checkPoint = value + headerHeight + 20; 
      let newActiveIndex = 0;

      for (let i = 0; i < sections.length; i++) {
        const sectionY = sectionPositions.current[i];
        if (typeof sectionY === 'number' && checkPoint >= sectionY) {
          newActiveIndex = i;
        } else {
          break;
        }
      }

      setActiveSectionIndex(prev => (prev !== newActiveIndex ? newActiveIndex : prev));
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [headerHeight, sections]);


  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => item.action ? item.action() : navigation.navigate(item.screen, { scheduleId: schedule?.id })}
      style={[
        styles.row,
        { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor },
      ]}
    >
      <View style={styles.left}>
        {/* Фарбуємо іконку в червоний, якщо це небезпечна дія (danger: true) */}
        <Icon 
          name={item.icon} 
          size={20} 
          color={item.danger ? '#ff453a' : themeColors.textColor2} 
          style={{ marginRight: 10 }} 
        />
        <View style={{ flexShrink: 1 }}>
          <Text style={[
            styles.title, 
            { color: item.danger ? '#ff453a' : themeColors.textColor }
          ]}>
            {item.label}
          </Text>
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

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      
      <SettingsHeader 
        title="Налаштування" 
        subTitle={sections[activeSectionIndex]?.title || ""} 
        subTitleIndex={activeSectionIndex}
        scrollY={scrollY} 
        showBackButton={false} 
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingTop: headerHeight + 20 } 
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {sections.map((section, sectionIndex) => (
          <View 
            key={`section-${sectionIndex}`}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              sectionPositions.current[sectionIndex] = layout.y;
            }}
          >
            <Text
              style={[
                styles.sectionHeader,
                { color: section.danger ? '#ff453a' : themeColors.textColor2, backgroundColor: themeColors.backgroundColor },
              ]}
            >
              {section.title}
            </Text>

            {section.data.map((item, itemIndex) => (
              <View key={`item-${sectionIndex}-${itemIndex}`}>
                {renderItem({ item })}
                {itemIndex < section.data.length - 1 && <View style={{ height: 10 }} />}
              </View>
            ))}

            <View style={{ height: 12 }} />
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
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
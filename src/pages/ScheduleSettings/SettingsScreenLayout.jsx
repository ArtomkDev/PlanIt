import React, { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native'; // Щоб отримати назву екрану
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import SettingsHeader from '../../components/SettingsHeader';

export default function SettingsScreenLayout({ children, contentContainerStyle }) {
  const { global } = useSchedule();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);

  // Визначаємо заголовок
  // Спочатку шукаємо в options, якщо нема - беремо назву роута
  // (В React Navigation 6 options доступні трохи інакше, тому тут проста евристика)
  // Найкраще передавати title пропом, але щоб не міняти всі файли, візьмемо назву з мапи
  const routeTitles = {
    'Breaks': 'Перерви',
    'Weeks': 'Тижні',
    'StartWeek': 'Початок семестру',
    'Subjects': 'Предмети',
    'Teachers': 'Викладачі',
    'Schedule': 'Редактор розкладу',
    'ScheduleSwitcher': 'Мої розклади',
    'AutoSave': 'Автозбереження',
    'Theme': 'Тема',
    'ResetDB': 'Скидання',
    'DeviceService': 'Пристрої',
  };
  
  const title = routeTitles[route.name] || route.name;

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 50 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      
      {/* Наш кастомний хедер */}
      <SettingsHeader title={title} scrollY={scrollY} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingTop: headerHeight + 20 } // Відступ для контенту
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 80,
  },
});
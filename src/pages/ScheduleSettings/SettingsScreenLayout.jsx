import React, { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import AppBlur from '../../components/AppBlur';

export default function SettingsScreenLayout({ children, contentContainerStyle }) {
  const { global } = useSchedule();
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  // Отримуємо висоту хедера, щоб знати, якого розміру робити підкладку
  const headerHeight = useHeaderHeight();
  
  // Анімоване значення скролу
  const scrollY = useRef(new Animated.Value(0)).current;

  // Інтерполяція: від 0 (прозорий) до 1 (повний блюр) при скролі на 50 пікселів
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      
      {/* 🔥 Динамічний Блюр Хедера */}
      <Animated.View
        style={[
          styles.headerBlurContainer,
          {
            height: headerHeight,
            opacity: headerOpacity, // Керуємо прозорістю
          },
        ]}
      >
        <AppBlur style={StyleSheet.absoluteFill} />
        {/* Тонка лінія знизу для розділення, коли хедер активний */}
        <View style={[styles.borderBottom, { backgroundColor: themeColors.borderColor }]} />
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingTop: headerHeight + 20 } // Відступ контенту від верху
        ]}
        keyboardShouldPersistTaps="handled"
        // Прив'язуємо подію скролу до нашої анімації
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true } // false для web, true для native (але opacity працює з true)
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
  headerBlurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100, // Поверх скролу
    overflow: 'hidden', // Важливо для AppBlur
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.3,
  },
});
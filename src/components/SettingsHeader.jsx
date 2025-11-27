import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBlur from './AppBlur';
import themes from '../config/themes';
import { useSchedule } from '../context/ScheduleProvider';

export default function SettingsHeader({ title, subTitle, subTitleIndex, scrollY, showBackButton = true }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { global } = useSchedule();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);

  const CONTENT_HEIGHT = 60;
  const HEADER_HEIGHT = CONTENT_HEIGHT + insets.top;

  // === Анімації Скролу (Прозорість фону та підзаголовка) ===
  const bgOpacity = scrollY ? scrollY.interpolate({
    inputRange: [0, 25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }) : 0;

  const subTitleScrollOpacity = scrollY ? scrollY.interpolate({
    inputRange: [30, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  }) : 0;

  const subTitleScrollTranslateY = scrollY ? scrollY.interpolate({
    inputRange: [30, 60],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  }) : 0;


  // === Анімації зміни тексту "Барабан" (МИТТЄВА) ===
  const [displayedSubTitle, setDisplayedSubTitle] = useState(subTitle || "");
  const prevIndexRef = useRef(subTitleIndex);
  
  const textFade = useRef(new Animated.Value(1)).current;
  const textTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Запускаємо анімацію миттєво при зміні subTitle
    if (subTitle !== displayedSubTitle) {
      
      // Визначаємо напрямок
      const isScrollingDown = subTitleIndex > prevIndexRef.current;
      const exitTo = isScrollingDown ? -15 : 15;
      const enterFrom = isScrollingDown ? 15 : -15;

      // Зупиняємо попередню анімацію (якщо вона ще йде)
      textFade.stopAnimation();
      textTranslate.stopAnimation();

      // 1. Вихід старого тексту
      Animated.parallel([
        Animated.timing(textFade, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: exitTo, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        // 2. Зміна тексту
        setDisplayedSubTitle(subTitle || "");
        
        // 3. Підготовка до входу
        textTranslate.setValue(enterFrom); 

        // 4. Вхід нового тексту
        Animated.parallel([
          Animated.timing(textFade, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(textTranslate, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      });

      prevIndexRef.current = subTitleIndex;
    }
  }, [subTitle, subTitleIndex]); 


  // === Комбінування анімацій ===
  const combinedOpacity = Animated.multiply(subTitleScrollOpacity, textFade);
  const combinedTranslateY = Animated.add(subTitleScrollTranslateY, textTranslate);

  const canGoBack = navigation.canGoBack();
  const shouldShowBack = canGoBack && showBackButton;

  return (
    <View style={[styles.container, { height: HEADER_HEIGHT, paddingTop: insets.top }]}>
      
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <AppBlur style={StyleSheet.absoluteFill} />
        <View style={[styles.border, { backgroundColor: themeColors.textColor, opacity: 0.1 }]} />
      </Animated.View>

      <View style={[styles.content, { height: CONTENT_HEIGHT }]}>
        <View style={styles.leftContainer}>
          {shouldShowBack && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={themeColors.accentColor} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.titleContainer}>
          <Text style={[styles.mainTitle, { color: themeColors.textColor }]} numberOfLines={1}>
            {title}
          </Text>

          <Animated.Text 
            style={[
              styles.subTitle,
              { 
                color: themeColors.accentColor,
                opacity: combinedOpacity,
                transform: [{ translateY: combinedTranslateY }]
              }
            ]} 
            numberOfLines={1}
          >
            {displayedSubTitle}
          </Animated.Text>
        </View>

        <View style={styles.rightContainer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'flex-start',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  leftContainer: { width: 40, alignItems: 'flex-start', zIndex: 2 },
  rightContainer: { width: 40 },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column', 
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2, 
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: { padding: 8 },
  border: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  }
});
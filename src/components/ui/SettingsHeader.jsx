import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBlur from './AppBlur';
import themes from '../../config/themes';
import { useSchedule } from '../../context/ScheduleProvider';

export default function SettingsHeader({ title, subTitle, subTitleIndex, scrollY, showBackButton = true, rightButton }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { global } = useSchedule();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);

  const CONTENT_HEIGHT = 60;
  const HEADER_HEIGHT = CONTENT_HEIGHT + insets.top;

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

  const [displayedSubTitle, setDisplayedSubTitle] = useState(subTitle || "");
  const prevIndexRef = useRef(subTitleIndex);
  
  const textFade = useRef(new Animated.Value(1)).current;
  const textTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (subTitle && subTitle !== displayedSubTitle) {
      const isScrollingDown = subTitleIndex > prevIndexRef.current;
      const exitTo = isScrollingDown ? -15 : 15;
      const enterFrom = isScrollingDown ? 15 : -15;

      textFade.stopAnimation();
      textTranslate.stopAnimation();

      Animated.parallel([
        Animated.timing(textFade, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: exitTo, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        setDisplayedSubTitle(subTitle || "");
        textTranslate.setValue(enterFrom); 
        Animated.parallel([
          Animated.timing(textFade, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(textTranslate, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      });

      prevIndexRef.current = subTitleIndex;
    }
  }, [subTitle, subTitleIndex]); 

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

        <View style={[styles.titleContainer, !subTitle && { paddingBottom: 0, paddingTop: 0 }]}>
          <Text style={[styles.mainTitle, { color: themeColors.textColor, marginBottom: subTitle ? 2 : 0 }]} numberOfLines={1}>
            {title}
          </Text>

          {!!subTitle && (
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
          )}
        </View>

        <View style={styles.rightContainer}>
          {rightButton}
        </View>
        
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
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  leftContainer: { 
    position: 'absolute',
    left: 8,
    height: '100%',
    justifyContent: 'center',
    zIndex: 2 
  },
  rightContainer: { 
    position: 'absolute',
    right: 8,
    height: '100%',
    justifyContent: 'center',
    zIndex: 2 
  },
  titleContainer: {
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column', 
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
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
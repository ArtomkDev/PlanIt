import React, { useMemo, useRef, useLayoutEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, Easing, PanResponder } from 'react-native';
import themes from '../../../config/themes';
import { useSchedule } from '../../../context/ScheduleProvider';
import { t } from '../../../utils/i18n';

const WeekStrip = React.memo(({ currentDate, onSelectDate }) => {
  const { global, lang } = useSchedule();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const DAYS = useMemo(() => {
    const locale = t('locale', lang);
    const days = [];
    const baseDate = new Date(2023, 0, 1); 
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      const dayStr = date.toLocaleDateString(locale, { weekday: 'short' });
      days.push(dayStr.charAt(0).toUpperCase() + dayStr.slice(1));
    }
    return days;
  }, [lang]);

  const startDayOfWeek = useMemo(() => {
    if (global?.starting_week) {
      const d = new Date(global.starting_week);
      if (!isNaN(d.getTime())) return d.getDay();
    }
    return 1;
  }, [global?.starting_week]);

  const orderedDayNames = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => DAYS[(startDayOfWeek + i) % 7]);
  }, [startDayOfWeek, DAYS]);

  const getWeekStart = useCallback((date) => {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0); 
    const diff = (d.getDay() - startDayOfWeek + 7) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  }, [startDayOfWeek]);

  const getDayIndex = useCallback((date) => {
    const d = new Date(date);
    return (d.getDay() - startDayOfWeek + 7) % 7;
  }, [startDayOfWeek]);

  const todayString = useMemo(() => new Date().toDateString(), []);

  const [displayWeekStart, setDisplayWeekStart] = useState(() => getWeekStart(currentDate));
  const displayWeekStartRef = useRef(displayWeekStart);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(displayWeekStart);
    d.setDate(displayWeekStart.getDate() + i);
    return d;
  }), [displayWeekStart]);

  const currentRef = useRef(currentDate);
  currentRef.current = currentDate;

  const animatedIndex = useRef(new Animated.Value(getDayIndex(currentDate))).current;
  const weekOpacity = useRef(new Animated.Value(1)).current;
  const weekTranslateX = useRef(new Animated.Value(0)).current;

  const changeWeek = useCallback((offset) => {
    const newDate = new Date(currentRef.current);
    newDate.setDate(currentRef.current.getDate() + offset * 7);
    onSelectDate(newDate);
  }, [onSelectDate]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 40) changeWeek(-1);
        else if (gestureState.dx < -40) changeWeek(1);
      },
    })
  ).current;

  useLayoutEffect(() => {
    const targetWeekTime = getWeekStart(currentDate).getTime();
    const currentDisplayWeekTime = displayWeekStartRef.current.getTime();
    const targetIndex = getDayIndex(currentDate);

    if (currentDisplayWeekTime === targetWeekTime) {
      Animated.parallel([
        Animated.spring(animatedIndex, { toValue: targetIndex, stiffness: 500, damping: 35, mass: 1, useNativeDriver: true }),
        Animated.spring(weekOpacity, { toValue: 1, stiffness: 400, damping: 30, useNativeDriver: true }),
        Animated.spring(weekTranslateX, { toValue: 0, stiffness: 400, damping: 30, useNativeDriver: true })
      ]).start();

    } else {
      weekOpacity.stopAnimation();
      weekTranslateX.stopAnimation();

      const direction = targetWeekTime > currentDisplayWeekTime ? 1 : -1;

      Animated.parallel([
        Animated.timing(weekOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(weekTranslateX, { toValue: direction * -30, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true })
      ]).start(({ finished }) => {
        if (!finished) return;

        const latestDate = currentRef.current;
        const freshTargetWeek = getWeekStart(latestDate);
        const freshTargetIndex = getDayIndex(latestDate);

        setDisplayWeekStart(freshTargetWeek);
        displayWeekStartRef.current = freshTargetWeek;

        weekTranslateX.setValue(direction * 30);
        animatedIndex.setValue(freshTargetIndex);

        Animated.parallel([
          Animated.timing(weekOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(weekTranslateX, { toValue: 0, stiffness: 450, damping: 30, useNativeDriver: true })
        ]).start();
      });
    }
  }, [currentDate.getTime(), getWeekStart, getDayIndex, animatedIndex, weekOpacity, weekTranslateX]);

  const handleDayPress = useCallback((date) => {
    const targetDate = new Date(date);
    targetDate.setHours(currentRef.current.getHours(), currentRef.current.getMinutes());
    onSelectDate(targetDate);
  }, [onSelectDate]);

  const gap = (SCREEN_WIDTH - 32 - 7 * 40) / 6;
  const circleTranslateX = animatedIndex.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5, 6],
    outputRange: [0, 1, 2, 3, 4, 5, 6].map(i => i * (40 + gap))
  });

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={[styles.weekContainer, { width: SCREEN_WIDTH }]}>
        
        <Animated.View style={[
          styles.daysWrapper,
          {
            opacity: weekOpacity,
            transform: [{ translateX: weekTranslateX }]
          }
        ]}>
          
          <Animated.View style={[
            styles.selectionIndicator,
            { 
              backgroundColor: themeColors.accentColor,
              transform: [{ translateX: circleTranslateX }]
            }
          ]} />

          {weekDates.map((date, index) => {
            const isCurrentlySelected = date.toDateString() === currentDate.toDateString();
            const isToday = date.toDateString() === todayString;
            
            return (
              <TouchableOpacity
                key={index}
                style={styles.dayContainer}
                onPress={() => handleDayPress(date)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayName, 
                  { color: isCurrentlySelected ? themeColors.accentColor : themeColors.textColor2 }
                ]}>
                  {orderedDayNames[index]}
                </Text>
                <View style={[
                  styles.dateCircle,
                  !isCurrentlySelected && isToday && { borderWidth: 1, borderColor: themeColors.accentColor }
                ]}>
                  <Text style={[
                    styles.dayNumber, 
                    { color: isCurrentlySelected ? '#fff' : themeColors.textColor }
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

      </View>
    </View>
  );
});

export default WeekStrip;

const styles = StyleSheet.create({
  container: {},
  weekContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden', 
    justifyContent: 'center',
  },
  daysWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative', 
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: 0, 
    left: 2,   
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  dayName: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
  }
});
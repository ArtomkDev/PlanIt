import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import themes from "../../../config/themes";
import { useScheduleData } from "../../../context/ScheduleProvider";
import { triggerLightHaptic } from "../../../utils/haptics";
import { t } from "../../../utils/i18n";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const DayButton = React.memo(({
  date,
  dayName,
  isSelected,
  isToday,
  locale,
  themeColors,
  onPress,
}) => {
  const selectedProgress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    selectedProgress.stopAnimation();
    const animation = Animated.timing(selectedProgress, {
      toValue: isSelected ? 1 : 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [isSelected, selectedProgress]);

  const animatePress = (toValue) => {
    pressScale.stopAnimation();
    Animated.timing(pressScale, {
      toValue,
      duration: toValue < 1 ? 55 : 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const selectedOpacity = selectedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <AnimatedTouchable
      accessibilityRole="button"
      accessibilityLabel={date.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
      accessibilityState={{ selected: isSelected }}
      activeOpacity={1}
      style={[
        styles.dayContainer,
        !isSelected && isToday && { backgroundColor: themeColors.accentColorLight },
        { transform: [{ scale: pressScale }] },
      ]}
      onPress={onPress}
      onPressIn={() => animatePress(0.92)}
      onPressOut={() => animatePress(1)}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.selectedBackground,
          {
            backgroundColor: themeColors.accentColor,
            opacity: selectedOpacity,
          },
        ]}
      />
      <View style={styles.dayContent}>
        <Text
          style={[
            styles.dayName,
            {
              color: isToday
                ? themeColors.accentColor
                : themeColors.textColor2,
            },
          ]}
        >
          {dayName.replace(".", "")}
        </Text>
        <Text
          style={[
            styles.dayNumber,
            {
              color: isToday
                ? themeColors.accentColor
                : themeColors.textColor,
            },
          ]}
        >
          {date.getDate()}
        </Text>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.dayContent, { opacity: selectedOpacity }]}
        >
          <Text style={[styles.dayName, { color: themeColors.textOnAccent }]}>
            {dayName.replace(".", "")}
          </Text>
          <Text style={[styles.dayNumber, { color: themeColors.textOnAccent }]}>
            {date.getDate()}
          </Text>
        </Animated.View>
      </View>
      {isToday && (
        <View
          style={[
            styles.todayDot,
            {
              backgroundColor: isSelected
                ? themeColors.textOnAccent
                : themeColors.accentColor,
            },
          ]}
        />
      )}
    </AnimatedTouchable>
  );
});

const WeekStrip = React.memo(({ currentDate, onSelectDate }) => {
  const { global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const locale = t("locale", lang);

  const DAYS = useMemo(() => {
    const days = [];
    const baseDate = new Date(2023, 0, 1);
    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      const dayStr = date.toLocaleDateString(locale, { weekday: "short" });
      days.push(dayStr.charAt(0).toUpperCase() + dayStr.slice(1));
    }
    return days;
  }, [locale]);

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

  const todayString = new Date().toDateString();

  const [displayWeekStart, setDisplayWeekStart] = useState(() => getWeekStart(currentDate));
  const displayWeekStartRef = useRef(displayWeekStart);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(displayWeekStart);
    d.setDate(displayWeekStart.getDate() + i);
    return d;
  }), [displayWeekStart]);

  const currentRef = useRef(currentDate);
  currentRef.current = currentDate;

  const weekOpacity = useRef(new Animated.Value(1)).current;
  const weekTranslateX = useRef(new Animated.Value(0)).current;
  const weekTransitionId = useRef(0);
  const pendingSelectionDate = useRef(null);
  const pendingSelectionTimeout = useRef(null);

  useEffect(() => () => {
    if (pendingSelectionTimeout.current) {
      clearTimeout(pendingSelectionTimeout.current);
    }
  }, []);

  const changeWeek = useCallback((offset) => {
    triggerLightHaptic();
    const newDate = new Date(currentRef.current);
    newDate.setDate(currentRef.current.getDate() + offset * 7);
    onSelectDate(newDate);
  }, [onSelectDate]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 40) changeWeek(-1);
        else if (gestureState.dx < -40) changeWeek(1);
      },
    }),
    [changeWeek]
  );

  useLayoutEffect(() => {
    const transitionId = ++weekTransitionId.current;
    const targetWeekTime = getWeekStart(currentDate).getTime();
    const currentDisplayWeekTime = displayWeekStartRef.current.getTime();

    weekOpacity.stopAnimation();
    weekTranslateX.stopAnimation();

    if (currentDisplayWeekTime === targetWeekTime) {
      weekOpacity.setValue(1);
      weekTranslateX.setValue(0);

    } else {
      const direction = targetWeekTime > currentDisplayWeekTime ? 1 : -1;

      Animated.parallel([
        Animated.timing(weekOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(weekTranslateX, { toValue: direction * -30, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true })
      ]).start(({ finished }) => {
        if (!finished || weekTransitionId.current !== transitionId) return;

        const latestDate = currentRef.current;
        const freshTargetWeek = getWeekStart(latestDate);

        setDisplayWeekStart(freshTargetWeek);
        displayWeekStartRef.current = freshTargetWeek;

        weekTranslateX.setValue(direction * 30);

        Animated.parallel([
          Animated.timing(weekOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(weekTranslateX, { toValue: 0, stiffness: 450, damping: 30, useNativeDriver: true })
        ]).start();
      });
    }

    return () => {
      if (weekTransitionId.current !== transitionId) return;
      weekOpacity.stopAnimation();
      weekTranslateX.stopAnimation();
    };
  }, [currentDate.getTime(), getWeekStart, weekOpacity, weekTranslateX]);

  const handleDayPress = useCallback((date) => {
    if (date.toDateString() === currentRef.current.toDateString()) return;
    triggerLightHaptic();
    const targetDate = new Date(date);
    targetDate.setHours(currentRef.current.getHours(), currentRef.current.getMinutes());
    pendingSelectionDate.current = targetDate;

    if (pendingSelectionTimeout.current) {
      clearTimeout(pendingSelectionTimeout.current);
    }
    pendingSelectionTimeout.current = setTimeout(() => {
      const nextDate = pendingSelectionDate.current;
      pendingSelectionDate.current = null;
      pendingSelectionTimeout.current = null;
      if (nextDate) onSelectDate(nextDate);
    }, 45);
  }, [onSelectDate]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.weekSurface,
          {
            backgroundColor: themeColors.backgroundColor2,
            borderColor: themeColors.borderColor,
          },
        ]}
      >
        <Animated.View style={[
          styles.daysWrapper,
          {
            opacity: weekOpacity,
            transform: [{ translateX: weekTranslateX }]
          }
        ]}>
          {weekDates.map((date, index) => {
            const isCurrentlySelected = date.toDateString() === currentDate.toDateString();
            const isToday = date.toDateString() === todayString;
            
            return (
              <DayButton
                key={date.toISOString()}
                date={date}
                dayName={orderedDayNames[index]}
                isSelected={isCurrentlySelected}
                isToday={isToday}
                locale={locale}
                themeColors={themeColors}
                onPress={() => handleDayPress(date)}
              />
            );
          })}
        </Animated.View>
      </Animated.View>
    </View>
  );
});

export default WeekStrip;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 4,
  },
  weekSurface: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 2,
    overflow: "hidden",
  },
  daysWrapper: {
    flexDirection: "row",
    gap: 2,
    width: "100%",
  },
  dayContainer: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBackground: {
    borderRadius: 12,
  },
  dayContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: {
    fontSize: 8,
    lineHeight: 10,
    marginBottom: 1,
    fontWeight: "800",
    letterSpacing: 0.25,
    textTransform: "uppercase",
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
  },
  todayDot: {
    position: "absolute",
    bottom: 2,
    width: 3,
    height: 3,
    borderRadius: 2,
  },
});

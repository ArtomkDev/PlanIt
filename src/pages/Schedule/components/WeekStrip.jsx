import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, useWindowDimensions, Platform, Animated, Easing } from 'react-native';
import themes from '../../../config/themes';
import { useSchedule } from '../../../context/ScheduleProvider';

const WEEKS_HALF_SIZE = 50; 
const TOTAL_WEEKS = WEEKS_HALF_SIZE * 2 + 1;
const WEEKS_INDICES = Array.from({ length: TOTAL_WEEKS }, (_, i) => i - WEEKS_HALF_SIZE);

const WeekPage = React.memo(({ 
  offsetWeeks, baseWeekStart, currentDateString, handleDayPress, 
  orderedDayNames, SCREEN_WIDTH, themeColors, jumpDirection
}) => {
  const weekStart = new Date(baseWeekStart);
  weekStart.setDate(baseWeekStart.getDate() + offsetWeeks * 7);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  }), [weekStart]);

  const selectedIndex = weekDates.findIndex(d => d.toDateString() === currentDateString);
  const isSelected = selectedIndex !== -1;
  const prevSelectedIndex = useRef(selectedIndex);
  
  const animatedIndex = useRef(new Animated.Value(
    isSelected ? selectedIndex : (jumpDirection === 1 ? -1 : 7)
  )).current;

  useEffect(() => {
    animatedIndex.stopAnimation();
    if (isSelected) {
      if (prevSelectedIndex.current === -1) {
        animatedIndex.setValue(jumpDirection === 1 ? -1 : 7);
      }
      Animated.spring(animatedIndex, {
        toValue: selectedIndex,
        stiffness: 450,    
        damping: 30,    
        mass: 1,
        useNativeDriver: true,
      }).start();
      prevSelectedIndex.current = selectedIndex;
    } else {
      if (prevSelectedIndex.current !== -1) {
        Animated.timing(animatedIndex, {
          toValue: jumpDirection === 1 ? 7 : -1,
          duration: 150, 
          useNativeDriver: true,
          easing: Easing.out(Easing.quad)
        }).start();
        prevSelectedIndex.current = -1;
      }
    }
  }, [selectedIndex, isSelected, jumpDirection]); 

  const gap = (SCREEN_WIDTH - 32 - 7 * 40) / 6;
  const translateX = animatedIndex.interpolate({
    inputRange: [-1, 0, 1, 2, 3, 4, 5, 6, 7],
    outputRange: [-1, 0, 1, 2, 3, 4, 5, 6, 7].map(i => i * (40 + gap) + 2)
  });

  return (
    <View style={[styles.weekContainer, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[
        styles.selectionIndicator,
        { 
          backgroundColor: themeColors.accentColor,
          transform: [{ translateX }]
        }
      ]} />
      {weekDates.map((date, index) => {
        const isCurrentlySelected = date.toDateString() === currentDateString;
        const isToday = date.toDateString() === new Date().toDateString();
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
    </View>
  );
});

const WeekStrip = React.memo(({ currentDate, onSelectDate }) => {
  const { global , lang} = useSchedule();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const { width: SCREEN_WIDTH } = useWindowDimensions();


  const DAYS = useMemo(() => {
    const localeMap = { uk: 'uk-UA', en: 'en-US', pl: 'pl-PL', de: 'de-DE' };
    const locale = localeMap[lang] || 'uk-UA';
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

  const flatListRef = useRef(null);
  const isUserInteraction = useRef(false);
  const [baseWeekStart, setBaseWeekStart] = useState(() => getWeekStart(currentDate));
  const prevDateRef = useRef(currentDate);
  const [jumpDirection, setJumpDirection] = useState(1);

  useEffect(() => {
    if (currentDate.getTime() !== prevDateRef.current.getTime()) {
      setJumpDirection(currentDate.getTime() > prevDateRef.current.getTime() ? 1 : -1);
      prevDateRef.current = currentDate;
    }

    const newWeekStart = getWeekStart(currentDate);
    const weekDiff = Math.round((newWeekStart.getTime() - baseWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

    if (Math.abs(weekDiff) > WEEKS_HALF_SIZE - 2) {
      setBaseWeekStart(newWeekStart);
    } else if (!isUserInteraction.current) {
      flatListRef.current?.scrollToIndex({ 
        index: WEEKS_HALF_SIZE + weekDiff, 
        animated: true 
      });
    }
  }, [currentDate, baseWeekStart, getWeekStart]);

  const getItemLayout = useCallback((data, index) => ({
    length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index,
  }), [SCREEN_WIDTH]);

  const handleDayPress = useCallback((date) => {
    const targetDate = new Date(date);
    targetDate.setHours(currentDate.getHours(), currentDate.getMinutes());
    onSelectDate(targetDate);
  }, [currentDate, onSelectDate]);

  const renderItem = useCallback(({ item: offsetWeeks }) => (
    <WeekPage 
      offsetWeeks={offsetWeeks}
      baseWeekStart={baseWeekStart}
      currentDateString={currentDate.toDateString()} 
      handleDayPress={handleDayPress}
      orderedDayNames={orderedDayNames}
      SCREEN_WIDTH={SCREEN_WIDTH}
      themeColors={themeColors}
      jumpDirection={jumpDirection}
    />
  ), [baseWeekStart, currentDate.toDateString(), handleDayPress, orderedDayNames, SCREEN_WIDTH, themeColors, jumpDirection]);

  return (
    <View style={styles.container}>
      <FlatList
        key={`weeks-${baseWeekStart.getFullYear()}-${baseWeekStart.getMonth()}`}
        ref={flatListRef}
        data={WEEKS_INDICES}
        renderItem={renderItem}
        keyExtractor={(item) => item.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={WEEKS_HALF_SIZE}
        getItemLayout={getItemLayout}
        onScrollBeginDrag={() => { isUserInteraction.current = true; }}
        onMomentumScrollEnd={() => { isUserInteraction.current = false; }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
    </View>
  );
});

export default WeekStrip;

const styles = StyleSheet.create({
  container: {},
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: 'hidden', 
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    zIndex: 2, 
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
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: 12, 
    left: 16,   
    width: 36,
    height: 36,
    borderRadius: 18,
    zIndex: 1,  
  }
});
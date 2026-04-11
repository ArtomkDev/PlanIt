import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, Platform } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useSchedule } from "../../../context/ScheduleProvider";
import LessonCard from "./LessonCard";
import BreakCard from "./BreakCard";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 140;

function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  let totalMinutes = hours * 60 + minutes + (minsToAdd || 0);
  totalMinutes = (totalMinutes + 24 * 60) % (24 * 60); 

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const getBreakDuration = (breaksArray, index) => {
  if (!Array.isArray(breaksArray) || breaksArray.length === 0) return 0;
  return Number(breaksArray[index % breaksArray.length]) || 0;
};

function buildLessonTimes(startTime, duration, breaks, daySchedule) {
  if (!startTime || !duration || !Array.isArray(daySchedule)) return [];
  let times = [];
  let currentStart = startTime;

  for (let i = 0; i < daySchedule.length; i++) {
    const item = daySchedule[i];
    const isInstance = typeof item === 'object' && item !== null;

    const customStart = isInstance ? item.startTime : null;
    const customEnd = isInstance ? item.endTime : null;

    const actualStart = customStart ? customStart : currentStart;
    const actualEnd = customEnd ? customEnd : addMinutes(actualStart, duration);

    times.push({ start: actualStart, end: actualEnd });

    const currentBreak = getBreakDuration(breaks, i);
    currentStart = addMinutes(actualEnd, currentBreak);
  }

  return times;
}

export default function DaySchedule({ 
  targetDate, 
  onLessonPress, 
  onLessonLongPress, 
  onEmptyPress,
  scrollY
}) {
  const { getDaySchedule } = useDaySchedule();
  const { schedule, global, lang, tabBarHeight } = useSchedule();
  const insets = useSafeAreaInsets();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const BOTTOM_SPACER_HEIGHT = safeTabBarHeight + 65; 

  const { start_time = "08:30", duration = 45, breaks = [] } = schedule || {};
  
  const scheduleForDay = getDaySchedule && targetDate ? getDaySchedule(targetDate) : [];

  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay);
  }, [start_time, duration, breaks, scheduleForDay]);

  return (
    <Animated.ScrollView 
      contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 50 }]}
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: Platform.OS !== 'web' }
      )}
      scrollEventThrottle={16}
    >
      <TouchableOpacity 
        activeOpacity={1} 
        style={{ minHeight: SCREEN_HEIGHT * 0.6 }} 
        onLongPress={onEmptyPress}
        delayLongPress={500}
      >
        {scheduleForDay.length > 0 ? (
          scheduleForDay.map((item, index) => {
            if (!item) return null; 

            const isInstance = typeof item === 'object' && item !== null;
            const subjectId = isInstance ? item.subjectId : item;
            const lessonData = isInstance ? item : {};
            const timeInfo = lessonTimes?.[index] || {};
            const nextTimeInfo = lessonTimes?.[index + 1];

            const uniqueKey = `lesson-${index}-${subjectId}`;

            const subject = schedule?.subjects?.find(s => s.id === subjectId) || {};
            let subjectColor = themes.accentColors[subject?.color] || subject?.color || themeColors.accentColor;
            let activeGrad = null;

            if (subject?.typeColor === "gradient" && subject?.colorGradient) {
              activeGrad = schedule?.gradients?.find(g => g.id === subject.colorGradient);
              if (activeGrad && activeGrad.colors && activeGrad.colors.length > 0) {
                subjectColor = activeGrad.colors[0]; 
              }
            }

            return (
              <View key={uniqueKey}>
                <LessonCard
                  lesson={{ subjectId, index, timeInfo, data: lessonData }}
                  onPress={onLessonPress}
                  onLongPress={onLessonLongPress}
                />
                
                {index < scheduleForDay.length - 1 && nextTimeInfo && (
                   <BreakCard
                     lessonStart={timeInfo.start}
                     breakStart={timeInfo.end}
                     breakEnd={nextTimeInfo.start}
                     targetDate={targetDate} 
                     themeColors={themeColors}
                     lang={lang}
                     subjectColor={subjectColor}
                     activeGrad={activeGrad}
                   />
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.noData, {color: themeColors.textColor2}]}>
              {t('schedule.day_schedule.no_classes', lang)}
            </Text>
            <Text style={[styles.hint, {color: themeColors.textColor3}]}>
              {t('schedule.day_schedule.add_hint', lang)}
            </Text>
          </View>
        )}
        
        <View style={{ height: BOTTOM_SPACER_HEIGHT }} />
      </TouchableOpacity>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { 
    padding: 16,
  },
  emptyContainer: {
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  noData: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
  }
});
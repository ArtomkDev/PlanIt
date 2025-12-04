import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated } from "react-native"; // Animated замість ScrollView
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useSchedule } from "../../../context/ScheduleProvider";
import LessonCard from "./LessonCard";
import themes from "../../../config/themes";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 140; // Приблизна висота шапки (Header + WeekStrip)

function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minsToAdd);
  return date.toTimeString().slice(0, 5);
}

function buildLessonTimes(startTime, duration, breaks, lessonsCount) {
  if (!startTime || !duration) return [];
  let times = [];
  let currentStart = startTime;

  for (let i = 0; i < lessonsCount; i++) {
    const end = addMinutes(currentStart, duration);
    times.push({ start: currentStart, end });
    currentStart = addMinutes(end, breaks?.[i] ?? 0);
  }
  return times;
}

export default function DaySchedule({ 
  onLessonPress, 
  onLessonLongPress, 
  onEmptyPress,
  scrollY // 🔥 Отримуємо анімоване значення
}) {
  const { currentDate, getDaySchedule } = useDaySchedule();
  const { schedule, global } = useSchedule();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const { start_time = "08:30", duration = 45, breaks = [] } = schedule || {};
  const scheduleForDay = getDaySchedule ? getDaySchedule(currentDate) : [];

  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay.length);
  }, [start_time, duration, breaks, scheduleForDay?.length]);

  return (
    <Animated.ScrollView 
      contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 50 }]} // 🔥 Відступ під шапку
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
      // 🔥 Прив'язуємо подію скролу до scrollY
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false } // useNativeDriver: false для Web, true для Native (якщо не Web)
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
          scheduleForDay.map((subjectId, index) => {
            const timeInfo = lessonTimes?.[index] || {};
            if (!subjectId) return null; 

            return (
              <LessonCard
                key={index}
                lesson={{ subjectId, index, timeInfo }}
                onPress={onLessonPress}
                onLongPress={onLessonLongPress}
              />
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.noData, {color: themeColors.textColor2}]}>
                Пар немає 🎉
            </Text>
            <Text style={[styles.hint, {color: themeColors.textColor3}]}>
                Затисніть екран, щоб додати
            </Text>
          </View>
        )}
        
        <View style={{height: 120}} />
      </TouchableOpacity>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { 
    padding: 16,
    // paddingTop задається динамічно
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
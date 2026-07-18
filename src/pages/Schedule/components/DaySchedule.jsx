import React, { useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, Platform } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDaySchedule } from "../../../context/DayScheduleProvider";
import { useScheduleData, useScheduleLayout } from "../../../context/ScheduleProvider";
import LessonCard from "./LessonCard";
import BreakCard from "./BreakCard";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";
import { buildLessonTimes } from "../../../utils/scheduleTime";
import { APP_HEADER_CONTENT_GAP, getAppHeaderHeight } from "../../../config/layoutMetrics";
import { triggerHaptic } from "../../../utils/haptics";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DaySchedule({ 
  targetDate, 
  onLessonPress, 
  onLessonLongPress, 
  onEmptyPress,
  scrollY,
  headerHeight,
}) {
  const { getDaySchedule } = useDaySchedule();
  const { schedule, global, lang } = useScheduleData();
  const { tabBarHeight } = useScheduleLayout();
  const insets = useSafeAreaInsets();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const BOTTOM_SPACER_HEIGHT = safeTabBarHeight + 65; 
  const resolvedHeaderHeight = headerHeight ?? getAppHeaderHeight(insets.top);

  const { start_time = "08:30", duration = 45, breaks = [] } = schedule || {};
  
  const scheduleForDay = getDaySchedule && targetDate ? getDaySchedule(targetDate) : [];

  const lessonTimes = useMemo(() => {
    return buildLessonTimes(start_time, duration, breaks, scheduleForDay);
  }, [start_time, duration, breaks, scheduleForDay]);

  const handleEmptyLongPress = () => {
    triggerHaptic("longPress");
    onEmptyPress?.();
  };

  return (
    <Animated.ScrollView 
      contentContainerStyle={[styles.scrollContent, { paddingTop: resolvedHeaderHeight + APP_HEADER_CONTENT_GAP }]}
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
        onLongPress={handleEmptyLongPress}
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

import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useScheduleData, useScheduleLayout } from "../../../context/ScheduleProvider";
import LessonCard from "./LessonCard";
import BreakCard from "./BreakCard";
import { buildDayTimeline, createDateAtTime } from "../../../utils/scheduleTime";
import { useNowTick } from "../../../hooks/useNowTick";
import useReducedMotionPreference from "../../../hooks/useReducedMotionPreference";
import { isLowEndDevice } from "../../../utils/devicePerformance";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";
import { APP_HEADER_CONTENT_GAP, getScheduleHeaderHeight } from "../../../config/layoutMetrics";
import { triggerHaptic } from "../../../utils/haptics";

const timelineTransition = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
const gapEnter = FadeIn.duration(180);
const gapExit = FadeOut.duration(140);
// Low-end devices never animate the timeline, so they skip the Reanimated wrapper cost per row.
const TimelineRow = isLowEndDevice ? View : Animated.View;

export default function DaySchedule({ 
  targetDate, 
  dayData,
  decorationsReady,
  moving,
  onLessonPress, 
  onLessonLongPress, 
  onEmptyPress,
  headerHeight,
}) {
  const { schedule, global, lang } = useScheduleData();
  const { tabBarHeight } = useScheduleLayout();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const BOTTOM_SPACER_HEIGHT = safeTabBarHeight + 65; 
  const resolvedHeaderHeight = headerHeight ?? getScheduleHeaderHeight(insets.top);

  const timeline = dayData.timeline || buildDayTimeline(schedule, dayData.lessons || []);
  const now = useNowTick(targetDate, timeline.some((entry) => entry.type !== "lesson"), 60000);
  const reduceMotion = useReducedMotionPreference() || isLowEndDevice;
  const nowTime = now?.getTime() ?? Date.now();
  const visibleGapIndex = timeline.findIndex((entry) => entry.type !== "lesson"
    && createDateAtTime(targetDate, entry.end)?.getTime() > nowTime);

  const handleEmptyLongPress = () => {
    triggerHaptic("longPress");
    onEmptyPress?.();
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: resolvedHeaderHeight + APP_HEADER_CONTENT_GAP }]}
      showsVerticalScrollIndicator={false}
      overScrollMode="always"
    >
      <TouchableOpacity
        accessible={false}
        activeOpacity={1}
        style={{ minHeight: screenHeight * 0.6 }}
        onLongPress={handleEmptyLongPress}
        delayLongPress={500}
      >
        {timeline.length > 0 ? (
          timeline.map((entry, index) => entry.type === "lesson" ? (
            <TimelineRow key={'lesson-' + entry.lesson.index} layout={reduceMotion ? undefined : timelineTransition}>
              <LessonCard
                lesson={entry.lesson}
                decorationsReady={decorationsReady}
                moving={moving}
                onPress={onLessonPress}
                onLongPress={onLessonLongPress}
              />
            </TimelineRow>
          ) : index === visibleGapIndex ? (
            <TimelineRow key={'gap-' + index} collapsable={false}
              layout={reduceMotion ? undefined : timelineTransition}
              entering={reduceMotion ? undefined : gapEnter} exiting={reduceMotion ? undefined : gapExit}>
              <BreakCard interval={entry} previousLesson={timeline[index - 1]?.lesson} schedule={schedule}
                targetDate={targetDate} themeColors={themeColors} lang={lang} blurEnabled={global?.blur ?? true} />
            </TimelineRow>
          ) : null)
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.noData, {color: themeColors.textColor2}]}>
              {t('schedule.day_schedule.no_classes', lang)}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('schedule.lesson_editor.new_lesson', lang)} onPress={handleEmptyLongPress}
              style={[styles.addButton, { backgroundColor: themeColors.accentColor }]}>
              <Text style={[styles.hint, { color: themeColors.textOnAccent }]}>{t('schedule.lesson_editor.new_lesson', lang)}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: BOTTOM_SPACER_HEIGHT }} />
      </TouchableOpacity>
    </ScrollView>
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
    textAlign: 'center',
  },
  addButton: { minHeight: 44, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
});

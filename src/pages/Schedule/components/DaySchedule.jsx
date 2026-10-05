import React from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScheduleData, useScheduleLayout } from "../../../context/ScheduleProvider";
import LessonCard from "./LessonCard";
import BreakCard from "./BreakCard";
import { buildDayTimeline } from "../../../utils/scheduleTime";
import themes from "../../../config/themes";
import { t } from "../../../utils/i18n";
import { APP_HEADER_CONTENT_GAP, getScheduleHeaderHeight } from "../../../config/layoutMetrics";
import { triggerHaptic } from "../../../utils/haptics";

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
        activeOpacity={1} 
        style={{ minHeight: screenHeight * 0.6 }}
        onLongPress={handleEmptyLongPress}
        delayLongPress={500}
      >
        {timeline.length > 0 ? (
          timeline.map((entry, index) => entry.type === "lesson" ? (
            <LessonCard
              key={'lesson-' + entry.lesson.index}
              lesson={entry.lesson}
              decorationsReady={decorationsReady}
              moving={moving}
              onPress={onLessonPress}
              onLongPress={onLessonLongPress}
            />
          ) : (
            <BreakCard key={'gap-' + index} interval={entry} previousLesson={timeline[index - 1]?.lesson} schedule={schedule} targetDate={targetDate} themeColors={themeColors} lang={lang} />
          ))
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
  }
});

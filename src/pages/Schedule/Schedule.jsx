import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from "react";
import {
  AppState,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, { interpolateColor, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Plus } from "phosphor-react-native"; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Header from "./components/Header";
import WeekStrip from "./components/WeekStrip";
import DayPager from "./components/DayPager";
import DaySchedule from "./components/DaySchedule";
import LessonEditor from "./components/LessonEditor";
import LessonViewer from "./components/LessonViewer";
import CalendarSheet from "../../components/CalendarSheet/CalendarSheet";
import AppBlur from "../../components/ui/AppBlur";

import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useNotificationDrawer } from "../../context/NotificationDrawerContext";
import { useScheduleActions, useScheduleData, useScheduleLayout } from "../../context/ScheduleProvider";
import { NowTickProvider } from "../../hooks/useNowTick";
import themes from "../../config/themes";
import {
  buildLessonTimes,
  calculateScheduleWeek,
  getScheduleDayIndex,
  getScheduleDayLessons,
  prepareScheduleDays,
} from "../../utils/scheduleTime";
import {
  createTaskDraftFromLesson,
  createTaskDraftFromLessonContext,
  normalizeLessonRef,
  resolveOccurrenceFromLessonRef,
} from "../../utils/taskLessonLinking";
import { getScheduleHeaderHeight } from "../../config/layoutMetrics";
import { triggerHaptic } from "../../utils/haptics";
import { getCalendarDayKey, getCalendarDayNumber, normalizeCalendarDate } from "./dayNavigation";

const getLocalISODate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const DayPage = memo(({
    date,
    dayData,
    decorationsReady,
    moving,
    headerHeight,
    openViewer,
    openEditor,
    handleAddLesson,
}) => {
    return (
        <View style={styles.dayPage}>
            <DayScheduleProvider date={date}>
               <DaySchedule
                  targetDate={date}
                  dayData={dayData}
                  decorationsReady={decorationsReady}
                  moving={moving}
                  onLessonPress={openViewer}
                  onLessonLongPress={openEditor}
                  onEmptyPress={handleAddLesson}
                  headerHeight={headerHeight}
               />
            </DayScheduleProvider>
        </View>
    );
}, (previous, next) => (
    getCalendarDayKey(previous.date) === getCalendarDayKey(next.date)
    && previous.dayData === next.dayData
    && previous.decorationsReady === next.decorationsReady
    && previous.moving === next.moving
    && previous.headerHeight === next.headerHeight
    && previous.openViewer === next.openViewer
    && previous.openEditor === next.openEditor
    && previous.handleAddLesson === next.handleAddLesson
));

export default function Schedule({ route, navigation }) {
  const { global: globalSettings, schedule, schedules } = useScheduleData();
  const { drawerProgress } = useNotificationDrawer();
  const { setGlobalDraft } = useScheduleActions();
  const { tabBarHeight } = useScheduleLayout();
  const insets = useSafeAreaInsets();
  
  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const dynamicBottomOffset = safeTabBarHeight + 16;
  
  const [currentDate, setCurrentDate] = useState(() => (
    normalizeCalendarDate(new Date())
  ));
  
  const dayPagerRef = useRef(null);
  const dayProgress = useSharedValue(getCalendarDayNumber(currentDate));
  const weekTransition = useSharedValue({ id: 0, active: false, origin: 0, finished: false });
  const weekProgress = useSharedValue(0);
  useEffect(() => {
    if (!schedule) dayProgress.value = getCalendarDayNumber(currentDate);
  }, [currentDate, dayProgress, schedule]);
  const handledLessonViewIntentRef = useRef(null);
  const requestedLessonScheduleSwitchRef = useRef(null);
  const [pendingLessonViewIntent, setPendingLessonViewIntent] = useState(null);
  const lessonViewIntent = route?.params?.lessonViewIntent;

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const headerHeight = getScheduleHeaderHeight(insets.top);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editorInitialTarget, setEditorInitialTarget] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);

  const [mode, accent] = globalSettings?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);
  const screenColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      drawerProgress?.value ?? 0,
      [0, 1],
      [themeColors.backgroundColor, themeColors.backgroundColor2]
    ),
  }), [themeColors.backgroundColor, themeColors.backgroundColor2]);

  const handleDateChange = useCallback((dateInput) => {
    const nextDate = normalizeCalendarDate(dateInput);
    if (!nextDate) return;

    setCurrentDate((previousDate) => (
      getCalendarDayKey(previousDate) === getCalendarDayKey(nextDate)
        ? previousDate
        : nextDate
    ));
  }, []);

  const goToDate = useCallback((targetDateInput, animated = true) => {
    const targetDate = normalizeCalendarDate(targetDateInput);
    if (!targetDate) return;

    if (dayPagerRef.current) {
      dayPagerRef.current.navigateToDate(targetDate, { animated });
      return;
    }

    handleDateChange(targetDate);
  }, [handleDateChange]);

  const goToToday = useCallback(() => {
    goToDate(new Date(), true);
  }, [goToDate]);

  const openViewer = useCallback((lesson) => { setViewingLesson(lesson); setViewerVisible(true); }, []);
  const openEditor = useCallback((lesson, initialTarget = null) => {
    setViewerVisible(false);
    setTimeout(() => {
      setEditingLesson(lesson);
      setEditorInitialTarget(initialTarget);
      setEditorVisible(true);
    }, 100);
  }, []);

  const openNewLessonEditor = useCallback(() => {
    setEditingLesson({ index: null, subjectId: null });
    setEditorInitialTarget({ type: "subject" });
    setEditorVisible(true);
  }, []);

  const buildSelectedLessonTaskContext = useCallback((lesson) => {
    if (!schedule?.id || !lesson) return null;

    const draft = createTaskDraftFromLesson(schedule, lesson, currentDate);
    if (!draft?.lessonRef) return null;

    return {
      scheduleId: schedule.id,
      subjectId: draft.subjectId,
      lessonRef: draft.lessonRef,
      linkIds: draft.linkIds,
    };
  }, [currentDate, schedule]);

  const buildLessonTaskContext = useCallback((lesson) => {
    if (!schedule?.id || !lesson) return null;

    const draft = createTaskDraftFromLessonContext(schedule, lesson, currentDate);
    if (!draft) return null;

    return {
      scheduleId: schedule.id,
      subjectId: draft.subjectId,
      lessonRef: draft.lessonRef,
      linkIds: draft.linkIds,
    };
  }, [currentDate, schedule]);

  const handleAddTaskFromLesson = useCallback((lesson) => {
    const context = buildLessonTaskContext(lesson);
    if (!context) return;

    setViewerVisible(false);
    navigation?.navigate("TasksTab", {
      createTaskIntent: {
        requestId: Date.now(),
        scheduleId: context.scheduleId,
        subjectId: context.subjectId,
        lessonRef: context.lessonRef,
        linkIds: context.linkIds,
      },
    });
  }, [buildLessonTaskContext, navigation]);

  const openLessonViewerFromRef = useCallback((lessonRefInput) => {
    const lessonRef = normalizeLessonRef(lessonRefInput, schedule?.id);
    if (!schedule?.id || !lessonRef?.date) return false;

    const targetDate = new Date(`${lessonRef.date}T00:00:00`);
    if (Number.isNaN(targetDate.getTime())) return false;

    const occurrence = resolveOccurrenceFromLessonRef(schedule, lessonRef);
    if (!occurrence) return false;

    setViewerVisible(false);
    goToDate(targetDate, false);

    setTimeout(() => {
      setViewingLesson({
        subjectId: occurrence.subjectId,
        index: occurrence.lessonIndex,
        timeInfo: occurrence.timeInfo,
        data: occurrence.lessonData,
        lesson: occurrence.lesson,
      });
      setViewerVisible(true);
    }, 120);

    return true;
  }, [goToDate, schedule]);

  useEffect(() => {
    const requestId = lessonViewIntent?.requestId;
    if (!requestId || handledLessonViewIntentRef.current === requestId) return;

    setPendingLessonViewIntent((previous) => (
      previous?.requestId === requestId ? previous : lessonViewIntent
    ));
    navigation?.setParams?.({ lessonViewIntent: undefined });
  }, [lessonViewIntent, navigation]);

  useEffect(() => {
    const requestId = pendingLessonViewIntent?.requestId;
    if (!requestId || handledLessonViewIntentRef.current === requestId) return;
    if (!schedule?.id) return;

    const targetScheduleId = pendingLessonViewIntent.scheduleId || pendingLessonViewIntent.lessonRef?.scheduleId;
    if (targetScheduleId && targetScheduleId !== schedule.id) {
      const targetScheduleExists = !Array.isArray(schedules)
        || schedules.some((item) => item?.id === targetScheduleId);

      if (!targetScheduleExists) {
        handledLessonViewIntentRef.current = requestId;
        requestedLessonScheduleSwitchRef.current = null;
        setPendingLessonViewIntent(null);
        return;
      }

      const switchKey = `${requestId}:${targetScheduleId}`;
      if (requestedLessonScheduleSwitchRef.current !== switchKey) {
        requestedLessonScheduleSwitchRef.current = switchKey;
        setGlobalDraft((previous) => (
          previous?.currentScheduleId === targetScheduleId
            ? previous
            : { ...previous, currentScheduleId: targetScheduleId }
        ));
      }
      return;
    }

    handledLessonViewIntentRef.current = requestId;
    requestedLessonScheduleSwitchRef.current = null;
    setPendingLessonViewIntent(null);
    openLessonViewerFromRef(pendingLessonViewIntent.lessonRef);
  }, [openLessonViewerFromRef, pendingLessonViewIntent, schedule?.id, schedules, setGlobalDraft]);

  const liveViewingLesson = useMemo(() => {
    if (!viewingLesson || !schedule) return viewingLesson;

    const lessonIndex = Number(viewingLesson.index);
    if (!Number.isInteger(lessonIndex)) return viewingLesson;

    const dayLessons = getScheduleDayLessons(schedule, currentDate);
    const lessonItem = dayLessons?.[lessonIndex];
    if (!lessonItem) return viewingLesson;

    const isInstance = typeof lessonItem === "object" && lessonItem !== null;
    const subjectId = isInstance ? lessonItem.subjectId : lessonItem;
    const lessonData = isInstance ? lessonItem : {};
    const lessonTimes = buildLessonTimes(
      schedule.start_time || "08:30",
      Number(schedule.duration) || 45,
      schedule.breaks || [],
      dayLessons || []
    );

    return {
      ...viewingLesson,
      subjectId,
      index: lessonIndex,
      timeInfo: lessonTimes?.[lessonIndex] || viewingLesson.timeInfo,
      data: lessonData,
      lesson: lessonItem,
    };
  }, [currentDate, schedule, viewingLesson]);

  const relatedTasks = useMemo(() => {
    const context = buildSelectedLessonTaskContext(liveViewingLesson);
    const lessonRef = context?.lessonRef;
    if (!lessonRef || !Array.isArray(schedule?.tasks)) return [];
    if (lessonRef.lessonIndex === undefined || lessonRef.lessonIndex === null) return [];

    return schedule.tasks
      .filter((task) => {
        const taskRef = task?.lessonRef;
        if (!taskRef || typeof taskRef !== "object") return false;
        if (taskRef.scheduleId && taskRef.scheduleId !== lessonRef.scheduleId) return false;
        if (taskRef.date && taskRef.date !== lessonRef.date) return false;
        if (taskRef.weekKey && taskRef.weekKey !== lessonRef.weekKey) return false;
        return Number(taskRef.lessonIndex) === Number(lessonRef.lessonIndex);
      })
      .slice(0, 3);
  }, [buildSelectedLessonTaskContext, liveViewingLesson, schedule?.tasks]);

  const findLessonById = useCallback((id) => {
    if (!schedule || !schedule.schedule) return null;
    for (let d = 0; d < schedule.schedule.length; d++) {
        const day = schedule.schedule[d];
        for (const weekKey of Object.keys(day)) {
            const lessons = day[weekKey];
            if (Array.isArray(lessons)) {
                let found = lessons.find(l => l && l.id === id);
                if (!found) found = lessons.find(l => l && (l.subject === id || l.subjectId === id));
                if (found) return found;
            }
        }
    }
    return { id, subject: id, subjectId: id }; 
  }, [schedule]);

  useEffect(() => {
    if (!schedule) return;

    const processLessonId = (id) => {
      if (!id) return;
      const lesson = findLessonById(id);
      if (lesson) {
          setTimeout(() => { openViewer(lesson); }, 300);
      }
    };

    const handleUrl = ({ url }) => {
      if (url && url.includes('lesson-view/')) {
         const id = url.split('lesson-view/')[1];
         const cleanId = id.split('?')[0].replace(/\//g, '');
         processLessonId(cleanId);
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);

    const checkWidgetIntent = async () => {
        try {
            const intentStr = await AsyncStorage.getItem('widget_intent');
            if (intentStr) {
                const intent = JSON.parse(intentStr);
                
                if (intent.action === 'OPEN_LESSON' && Date.now() - intent.timestamp < 5000) {
                    await AsyncStorage.removeItem('widget_intent');
                    const { targetDateStr, lessonIndex } = intent.data;

                    const targetDate = new Date(targetDateStr);
                    targetDate.setHours(0, 0, 0, 0); 

                    setTimeout(() => {
                        goToDate(targetDate, false);
                    }, 100);

                    if (schedule && schedule.schedule) {
                        const dayIndex = getScheduleDayIndex(targetDate);
                        
                        const dayObj = schedule.schedule[dayIndex];
                        if (dayObj) {
                            const weekKey = `week${calculateScheduleWeek(schedule, targetDate)}`;
                            const rawLessons = Array.isArray(dayObj[weekKey]) ? dayObj[weekKey] : [];
                            const item = rawLessons[lessonIndex];
                            
                            if (item) {
                                const isInstance = typeof item === 'object' && item !== null;
                                const subjectId = isInstance ? (item.subjectId || item.subject || item.id) : item;
                                const lessonData = isInstance ? item : {};
                                
                                const { start_time = "08:30", duration = 45, breaks = [] } = schedule || {};
                                const lessonTimes = buildLessonTimes(start_time, duration, breaks, rawLessons);
                                const timeInfo = lessonTimes[lessonIndex] || {};

                                setTimeout(() => {
                                    openViewer({
                                        subjectId,
                                        index: lessonIndex,
                                        timeInfo,
                                        data: lessonData
                                    });
                                }, 300); 
                            }
                        }
                    }
                }
            }
        } catch(e) {
            console.error(e);
        }
    };

    checkWidgetIntent();
    
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') checkWidgetIntent();
    });

    return () => {
        sub.remove();
        appStateSub.remove();
    };
  }, [schedule, findLessonById, openViewer, goToDate]);

  const getPreparedDay = useMemo(() => prepareScheduleDays(schedule), [schedule]);
  const renderDay = useCallback((date, decorationsReady, moving) => (
      <DayPage
         date={date}
         dayData={getPreparedDay(date)}
         decorationsReady={decorationsReady}
         moving={moving}
         headerHeight={headerHeight}
         openViewer={openViewer} openEditor={openEditor}
         handleAddLesson={openNewLessonEditor}
      />
  ), [getPreparedDay, headerHeight, openViewer, openEditor, openNewLessonEditor]);

  return (
    <NowTickProvider activeDate={currentDate}>
    <Reanimated.View style={[styles.container, screenColorStyle]}>
      <View style={[styles.headerContainer, { height: headerHeight }]}>
        <View style={StyleSheet.absoluteFill}>
          <AppBlur
            style={StyleSheet.absoluteFill}
            intensity={50}
            backgroundColor={themeColors.backgroundColor2}
            backgroundColorTo={themeColors.backgroundColor}
            overlayColor={themeColors.backgroundColor}
            overlayColorTo={themeColors.backgroundColor2}
            colorProgress={drawerProgress}
          />
        </View>
        <Header 
            currentDate={currentDate} 
            onTodayPress={goToToday}
            onTitlePress={() => setCalendarVisible(true)}
        />
        <WeekStrip
          currentDate={currentDate}
          dayProgress={dayProgress}
          weekTransition={schedule ? weekTransition : undefined}
          weekProgress={schedule ? weekProgress : undefined}
          onSelectDate={goToDate}
        />
        <View style={{ height: 1, backgroundColor: themeColors.borderColor, width: '100%' }} />
      </View>

      {schedule && (
        <DayPager
          ref={dayPagerRef}
          weekTransition={weekTransition}
          weekProgress={weekProgress}
          dayProgress={dayProgress}
          date={currentDate}
          onDateChange={handleDateChange}
          renderDay={renderDay}
        />
      )}

      {schedule && (
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: themeColors.accentColor, bottom: dynamicBottomOffset }]}
          onPress={() => {
            triggerHaptic("open");
            openNewLessonEditor();
          }}
          activeOpacity={0.8}
        >
          <Plus size={32} color="#fff" weight="bold" />
        </TouchableOpacity>
      )}
      
      {editorVisible && schedule && (
        <View 
          style={[StyleSheet.absoluteFill, { bottom: safeTabBarHeight }]}
          pointerEvents="box-none"
        >
          <DayScheduleProvider date={currentDate}>
            <LessonEditor
              lesson={editingLesson}
              initialEditTarget={editorInitialTarget}
              onClose={() => {
                setEditorVisible(false);
                setEditorInitialTarget(null);
              }}
            />
          </DayScheduleProvider>
        </View>
      )}
      
      <DayScheduleProvider date={currentDate}>
        <LessonViewer
          visible={viewerVisible}
          lesson={liveViewingLesson}
          relatedTasks={relatedTasks}
          onClose={() => setViewerVisible(false)}
          onEdit={openEditor}
          onAddTask={handleAddTaskFromLesson}
        />
      </DayScheduleProvider>
      
      <CalendarSheet visible={calendarVisible} currentDate={currentDate} onClose={() => setCalendarVisible(false)} onDateSelect={date => goToDate(date, true)} />

    </Reanimated.View>
    </NowTickProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dayPage: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fab: { position: 'absolute', right: 17, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 50 }
});

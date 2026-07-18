import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from "react";
import {
  AppState,
  Animated,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Plus } from "phosphor-react-native"; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Header from "./components/Header";
import WeekStrip from "./components/WeekStrip";
import DaySchedule from "./components/DaySchedule";
import LessonEditor from "./components/LessonEditor";
import LessonViewer from "./components/LessonViewer";
import CalendarSheet from "../../components/CalendarSheet/CalendarSheet";
import AppBlur from "../../components/ui/AppBlur";

import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useScheduleActions, useScheduleData, useScheduleLayout } from "../../context/ScheduleProvider";
import { NowTickProvider } from "../../hooks/useNowTick";
import themes from "../../config/themes";
import {
  buildLessonTimes,
} from "../../utils/scheduleTime";
import {
  createTaskDraftFromLesson,
  createTaskDraftFromLessonContext,
  normalizeLessonRef,
  resolveOccurrenceFromLessonRef,
} from "../../utils/taskLessonLinking";
import { getAppHeaderHeight } from "../../config/layoutMetrics";
import { triggerHaptic } from "../../utils/haptics";

const HALF_SIZE = 300; 
const TOTAL_SIZE = HALF_SIZE * 2 + 1;
const DAYS_INDICES = Array.from({ length: TOTAL_SIZE }, (_, i) => i - HALF_SIZE);

const getLocalISODate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

const DayPage = memo(({
    offset,
    anchorDate,
    width,
    headerHeight,
    openViewer,
    openEditor,
    handleAddLesson,
    scrollY,
}) => {
    const targetDate = useMemo(() => {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + offset);
        return d;
    }, [offset, anchorDate]);

    return (
        <View style={{ width, flex: 1 }}>
            <DayScheduleProvider date={targetDate}>
               <DaySchedule 
                  targetDate={targetDate} 
                  onLessonPress={openViewer}
                  onLessonLongPress={openEditor}
                  onEmptyPress={handleAddLesson}
                  scrollY={scrollY}
                  headerHeight={headerHeight}
               />
            </DayScheduleProvider>
        </View>
    );
});

export default function Schedule({ route, navigation }) {
  const { global, schedule } = useScheduleData();
  const { setGlobalDraft } = useScheduleActions();
  const { tabBarHeight } = useScheduleLayout();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const dynamicBottomOffset = safeTabBarHeight + 16;
  
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date(getLocalISODate());
    d.setHours(0,0,0,0);
    return d;
  });
  const [currentDate, setCurrentDate] = useState(new Date(getLocalISODate()));
  
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isUserInteraction = useRef(false);
  const isJumping = useRef(false);
  const jumpResetTimeout = useRef(null);
  const handledLessonViewIntentRef = useRef(null);
  const lessonViewIntent = route?.params?.lessonViewIntent;

  useEffect(() => () => {
    if (jumpResetTimeout.current) clearTimeout(jumpResetTimeout.current);
  }, []);

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const headerHeight = getAppHeaderHeight(insets.top);
  const [editingLesson, setEditingLesson] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = useMemo(() => themes.getColors(mode, accent), [mode, accent]);

  const handleScroll = useCallback((event) => {
    if (isJumping.current || !isUserInteraction.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const offset = index - HALF_SIZE;

    const newDate = new Date(anchorDate);
    newDate.setDate(anchorDate.getDate() + offset);

    if (newDate.toDateString() !== currentDate.toDateString()) {
        setCurrentDate(newDate);
    }
  }, [SCREEN_WIDTH, anchorDate, currentDate]);

  const goToDate = useCallback((targetDateInput, animated = true) => {
    let targetDate = new Date(targetDateInput);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / (1000 * 3600 * 24));
    
    if (Math.abs(diffDays) < HALF_SIZE - 10) {
        const shouldAnimate = animated && !isJumping.current;
        isJumping.current = true;
        setCurrentDate(new Date(targetDate));
        flatListRef.current?.scrollToIndex({
          index: HALF_SIZE + diffDays,
          animated: shouldAnimate,
        });
        if (jumpResetTimeout.current) clearTimeout(jumpResetTimeout.current);
        jumpResetTimeout.current = setTimeout(() => {
          isJumping.current = false;
          jumpResetTimeout.current = null;
        }, shouldAnimate ? 500 : 50);
    } else {
        const newAnchor = new Date(targetDate);
        setAnchorDate(newAnchor);
        setCurrentDate(new Date(targetDate));
    }
  }, [anchorDate]);

  const goToToday = () => {
    goToDate(new Date(getLocalISODate()), true);
  };

  const openViewer = useCallback((lesson) => { setViewingLesson(lesson); setViewerVisible(true); }, []);
  const openEditor = useCallback((lesson) => { 
    setViewerVisible(false);
    setTimeout(() => { setEditingLesson(lesson); setEditorVisible(true); }, 100);
  }, []);

  const openNewLessonEditor = useCallback(() => {
    setEditingLesson({ index: null, subjectId: null });
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
    if (!schedule?.id) return;

    const targetScheduleId = lessonViewIntent.scheduleId || lessonViewIntent.lessonRef?.scheduleId;
    if (targetScheduleId && targetScheduleId !== schedule.id) {
      setGlobalDraft((previous) => ({ ...previous, currentScheduleId: targetScheduleId }));
      return;
    }

    handledLessonViewIntentRef.current = requestId;
    openLessonViewerFromRef(lessonViewIntent.lessonRef);
    navigation?.setParams?.({ lessonViewIntent: undefined });
  }, [lessonViewIntent, navigation, openLessonViewerFromRef, schedule?.id, setGlobalDraft]);

  const relatedTasks = useMemo(() => {
    const context = buildSelectedLessonTaskContext(viewingLesson);
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
  }, [buildSelectedLessonTaskContext, schedule?.tasks, viewingLesson]);

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
                        let dayIndex = targetDate.getDay() - 1;
                        if (dayIndex < 0) dayIndex = 6;
                        
                        const dayObj = schedule.schedule[dayIndex];
                        if (dayObj) {
                            let totalWeeks = schedule.repeat || 1;
                            let currentWeekNum = 1;
                            
                            if (schedule.starting_week && totalWeeks > 1) {
                                const start = new Date(schedule.starting_week);
                                start.setHours(0,0,0,0);
                                const t = new Date(targetDate);
                                const weeksPassed = Math.floor((t.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
                                let mod = weeksPassed % totalWeeks;
                                if (mod < 0) mod += totalWeeks;
                                currentWeekNum = mod + 1;
                            }
                            
                            const weekKey = `week${currentWeekNum}`;
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

  const renderItem = useCallback(({ item: offset }) => (
      <DayPage 
         offset={offset} anchorDate={anchorDate} width={SCREEN_WIDTH}
         headerHeight={headerHeight}
         openViewer={openViewer} openEditor={openEditor}
         handleAddLesson={openNewLessonEditor}
         scrollY={scrollY}
      />
  ), [anchorDate, SCREEN_WIDTH, headerHeight, openViewer, openEditor, openNewLessonEditor, scrollY]);

  return (
    <NowTickProvider activeDate={currentDate}>
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <View style={[styles.headerContainer, { height: headerHeight }]}>
        <View style={StyleSheet.absoluteFill}><AppBlur style={StyleSheet.absoluteFill} intensity={50} /></View>
        <Header 
            currentDate={currentDate} 
            onTodayPress={goToToday}
            onTitlePress={() => setCalendarVisible(true)}
        />
        <WeekStrip
          currentDate={currentDate}
          onSelectDate={(d) => goToDate(d, true)}
        />
        <Animated.View style={{ height: 1, backgroundColor: themeColors.borderColor, width: '100%' }} />
      </View>

      {schedule && (
        <FlatList
          key={`list-${anchorDate.toISOString()}`}
          ref={flatListRef}
          data={DAYS_INDICES}
          renderItem={renderItem}
          keyExtractor={item => item.toString()}
          horizontal
          pagingEnabled
          initialScrollIndex={HALF_SIZE}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onScrollBeginDrag={() => { isUserInteraction.current = true; }} 
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={() => { isUserInteraction.current = false; }}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
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
            <LessonEditor lesson={editingLesson} onClose={() => setEditorVisible(false)} />
          </DayScheduleProvider>
        </View>
      )}
      
      <DayScheduleProvider date={currentDate}>
        <LessonViewer
          visible={viewerVisible}
          lesson={viewingLesson}
          relatedTasks={relatedTasks}
          onClose={() => setViewerVisible(false)}
          onEdit={openEditor}
          onAddTask={handleAddTaskFromLesson}
        />
      </DayScheduleProvider>
      
      <CalendarSheet visible={calendarVisible} currentDate={currentDate} onClose={() => setCalendarVisible(false)} onDateSelect={date => goToDate(date, true)} />

    </View>
    </NowTickProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fab: { position: 'absolute', right: 17, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 50 }
});

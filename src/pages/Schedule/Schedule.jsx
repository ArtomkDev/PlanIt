import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from "react";
import { StyleSheet, View, FlatList, Platform, useWindowDimensions, Animated, TouchableOpacity, AppState } from "react-native";
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
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

const HALF_SIZE = 300; 
const TOTAL_SIZE = HALF_SIZE * 2 + 1;
const DAYS_INDICES = Array.from({ length: TOTAL_SIZE }, (_, i) => i - HALF_SIZE);

const getLocalISODate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

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

const DayPage = memo(({ offset, anchorDate, width, openViewer, openEditor, handleAddLesson, scrollY }) => {
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
               />
            </DayScheduleProvider>
        </View>
    );
});

export default function Schedule() {
  const { global, schedule, lang, tabBarHeight } = useSchedule();
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

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
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
        isJumping.current = true;
        setCurrentDate(new Date(targetDate));
        flatListRef.current?.scrollToIndex({ index: HALF_SIZE + diffDays, animated });
        setTimeout(() => { isJumping.current = false; }, animated ? 500 : 50);
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
         openViewer={openViewer} openEditor={openEditor}
         handleAddLesson={() => { setEditingLesson({ index: null, subjectId: null }); setEditorVisible(true); }} 
         scrollY={scrollY}
      />
  ), [anchorDate, SCREEN_WIDTH, openViewer, openEditor, scrollY]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <View style={styles.headerContainer}>
        <View style={StyleSheet.absoluteFill}><AppBlur style={StyleSheet.absoluteFill} intensity={50} /></View>
        <Header 
            currentDate={currentDate} 
            onDateChange={(d) => goToDate(d, false)} 
            onTodayPress={goToToday} 
            onTitlePress={() => setCalendarVisible(true)} 
        />
        <WeekStrip currentDate={currentDate} onSelectDate={(d) => goToDate(d, true)} />
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
          onPress={() => { setEditingLesson({ index: null, subjectId: null }); setEditorVisible(true); }}
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
        <LessonViewer visible={viewerVisible} lesson={viewingLesson} onClose={() => setViewerVisible(false)} onEdit={openEditor} />
      </DayScheduleProvider>
      
      <CalendarSheet visible={calendarVisible} currentDate={currentDate} onClose={() => setCalendarVisible(false)} onDateSelect={date => goToDate(date, true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fab: { position: 'absolute', right: 17, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 50 }
});
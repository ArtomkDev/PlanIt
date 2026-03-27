import React, { useState, useRef, useCallback, useMemo, memo } from "react";
import { StyleSheet, View, Text, FlatList, Platform, useWindowDimensions, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons"; 

import Header from "./components/Header";
import WeekStrip from "./components/WeekStrip";
import DaySchedule from "./components/DaySchedule";
import LessonEditor from "./components/LessonEditor";
import LessonViewer from "./components/LessonViewer";
import CalendarSheet from "./components/CalendarSheet/CalendarSheet";
import AppBlur from "../../components/AppBlur";

import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";
import { t } from "../../utils/i18n";

const HALF_SIZE = 300; 
const TOTAL_SIZE = HALF_SIZE * 2 + 1;
const DAYS_INDICES = Array.from({ length: TOTAL_SIZE }, (_, i) => i - HALF_SIZE);

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
  const { global, schedule } = useSchedule();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isUserInteraction = useRef(false);
  const isJumping = useRef(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [viewingLesson, setViewingLesson] = useState(null);

  const lang = global?.language || 'uk';

  if (!schedule) return <View style={styles.loading}><Text>{t('schedule.loading', lang)}</Text></View>;

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

  const goToDate = useCallback((targetDate, animated = true) => {
    const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / (1000 * 3600 * 24));
    
    if (Math.abs(diffDays) < HALF_SIZE - 10) {
        isJumping.current = true;
        setCurrentDate(new Date(targetDate));
        flatListRef.current?.scrollToIndex({ index: HALF_SIZE + diffDays, animated });
        setTimeout(() => { isJumping.current = false; }, animated ? 500 : 0);
    } else {
        const newAnchor = new Date(targetDate);
        newAnchor.setHours(0,0,0,0);
        setAnchorDate(newAnchor);
        setCurrentDate(new Date(targetDate));
    }
  }, [anchorDate]);

  const openViewer = useCallback((lesson) => { setViewingLesson(lesson); setViewerVisible(true); }, []);
  const openEditor = useCallback((lesson) => { 
    setViewerVisible(false);
    setTimeout(() => { setEditingLesson(lesson); setEditorVisible(true); }, 100);
  }, []);

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
            onTodayPress={() => goToDate(new Date(), true)} 
            onTitlePress={() => setCalendarVisible(true)} 
        />
        <WeekStrip currentDate={currentDate} onSelectDate={(d) => goToDate(d, true)} />
        <Animated.View style={{ height: 1, backgroundColor: themeColors.borderColor, width: '100%' }} />
      </View>

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

      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: themeColors.accentColor }]}
        onPress={() => { setEditingLesson({ index: null, subjectId: null }); setEditorVisible(true); }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {editorVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
           <DayScheduleProvider date={currentDate}>
              <LessonEditor lesson={editingLesson} onClose={() => setEditorVisible(false)} />
           </DayScheduleProvider>
        </View>
      )}
      <LessonViewer visible={viewerVisible} lesson={viewingLesson} onClose={() => setViewerVisible(false)} onEdit={openEditor} />
      <CalendarSheet visible={calendarVisible} currentDate={currentDate} onClose={() => setCalendarVisible(false)} onDateSelect={date => goToDate(date, true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  fab: { position: 'absolute', bottom: 90, right: 17, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, zIndex: 50 }
});
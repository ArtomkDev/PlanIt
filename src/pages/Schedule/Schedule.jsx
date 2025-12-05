import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, Modal, TouchableOpacity, Text, FlatList, Dimensions, Platform, useWindowDimensions, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Header from "./components/Header";
import WeekStrip from "./components/WeekStrip";
import DaySchedule from "./components/DaySchedule";
import LessonEditor from "./components/LessonEditor";
import AppBlur from "../../components/AppBlur";

import { DayScheduleProvider } from "../../context/DayScheduleProvider";
import { useSchedule } from "../../context/ScheduleProvider";
import themes from "../../config/themes";

const HALF_SIZE = 1000;
const TOTAL_SIZE = HALF_SIZE * 2 + 1;
const DAYS_INDICES = Array.from({ length: TOTAL_SIZE }, (_, i) => i - HALF_SIZE);

export default function Schedule() {
  const { global, schedule } = useSchedule();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  
  const [anchorDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());

  // Анімація скролу (залишаємо для borderOpacity, але не для фону)
  const scrollY = useRef(new Animated.Value(0)).current;

  const [editorVisible, setEditorVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);

  const flatListRef = useRef(null);

  if (!schedule) return <View style={styles.loading}><Text>Завантаження...</Text></View>;

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  // ВИДАЛЕНО: const headerOpacity = ... (більше не потрібна)

  // Анімація прозорості розділювача (залишаємо)
  const borderOpacity = scrollY.interpolate({
    inputRange: [0, 20],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const getDateByOffset = useCallback((offset) => {
    const d = new Date(anchorDate);
    d.setDate(anchorDate.getDate() + offset);
    return d;
  }, [anchorDate]);

  // ... (методи goToDate, handleDateChange, handleToday, onScroll, renderItem, getItemLayout без змін) ...
  const goToDate = (targetDate, animated = true) => {
    const diffTime = targetDate.getTime() - anchorDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    const index = diffDays + HALF_SIZE;
    if (index >= 0 && index < TOTAL_SIZE) {
      flatListRef.current?.scrollToIndex({ index, animated });
      setCurrentDate(targetDate);
    }
  };

  const handleDateChange = (newDate) => goToDate(newDate, false);
  const handleToday = () => goToDate(new Date(), true);

  const onScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    const offset = index - HALF_SIZE;
    const newDate = getDateByOffset(offset);

    if (newDate.toDateString() !== currentDate.toDateString()) {
        setCurrentDate(newDate);
    }
  }, [SCREEN_WIDTH, currentDate, getDateByOffset]);

  const renderItem = useCallback(({ item: offset }) => {
    const dateForPage = getDateByOffset(offset);
    return (
      <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
        <DayScheduleProvider date={dateForPage}>
           <DaySchedule 
              onLessonPress={openViewer}
              onLessonLongPress={openEditor}
              onEmptyPress={handleAddLesson}
              scrollY={scrollY}
           />
        </DayScheduleProvider>
      </View>
    );
  }, [getDateByOffset, SCREEN_WIDTH]);

  const getItemLayout = useCallback((data, index) => ({
    length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index,
  }), [SCREEN_WIDTH]);

  const openViewer = (lesson) => { setSelectedLesson(lesson); setViewerVisible(true); };
  const openEditor = (lesson) => { setSelectedLesson(lesson); setEditorVisible(true); };
  const handleAddLesson = () => { setSelectedLesson({ index: null, subjectId: null }); setEditorVisible(true); };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      
      {/* 🔥 ПЛАВАЮЧА ШАПКА */}
      <View style={styles.headerContainer}>
        {/* Фон з блюром (СТАТИЧНИЙ, без анімації появи) */}
        <View style={StyleSheet.absoluteFill}>
             <AppBlur style={StyleSheet.absoluteFill} intensity={50} />
        </View>

        <Header 
            currentDate={currentDate} 
            onDateChange={handleDateChange} 
            onTodayPress={handleToday}
        />
        <WeekStrip 
            currentDate={currentDate} 
            onSelectDate={handleDateChange} 
        />
        
        {/* Розділювач (Border) - залишаємо анімацію лише для смужки */}
        <Animated.View 
            style={{ 
                height: 1, 
                backgroundColor: themeColors.borderColor, 
                opacity: borderOpacity, 
                width: '100%' 
            }} 
        />
      </View>

      <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={DAYS_INDICES}
            renderItem={renderItem}
            keyExtractor={(item) => item.toString()}
            horizontal
            pagingEnabled
            initialScrollIndex={HALF_SIZE}
            getItemLayout={getItemLayout}
            windowSize={5}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            removeClippedSubviews={Platform.OS !== 'web'}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={() => {
                if (Platform.OS === 'web') {
                     flatListRef.current?.scrollToIndex({ index: HALF_SIZE, animated: false });
                }
            }}
          />

          <TouchableOpacity 
            style={[styles.fab, { backgroundColor: themeColors.accentColor }]}
            onPress={handleAddLesson}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
      </View>

      {/* MODALS */}
      <Modal visible={editorVisible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'} transparent={Platform.OS !== 'ios'} onRequestClose={() => setEditorVisible(false)}>
         <DayScheduleProvider date={currentDate}>
             <LessonEditor lesson={selectedLesson} onClose={() => setEditorVisible(false)} />
         </DayScheduleProvider>
      </Modal>

      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <TouchableOpacity style={styles.viewerOverlay} activeOpacity={1} onPress={() => setViewerVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.viewerContent, { backgroundColor: themeColors.backgroundColor2 }]}>
                <Text style={{color: themeColors.textColor, fontSize: 22, fontWeight: 'bold', marginBottom: 8}}>{selectedLesson?.subject?.name || "Без назви"}</Text>
                <Text style={{color: themeColors.textColor2, fontSize: 16, marginBottom: 4}}>👨‍🏫 {selectedLesson?.teacher?.name || "Викладач не вказаний"}</Text>
                {selectedLesson?.timeInfo && <Text style={{color: themeColors.textColor2, fontSize: 16, marginBottom: 20}}>⏰ {selectedLesson.timeInfo.start} - {selectedLesson.timeInfo.end}</Text>}
                <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 20}}>
                    <TouchableOpacity onPress={() => { setViewerVisible(false); openEditor(selectedLesson); }}><Text style={{color: themeColors.accentColor, fontSize: 17, fontWeight: '600'}}>Редагувати</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => setViewerVisible(false)}><Text style={{color: themeColors.textColor, fontSize: 17}}>Закрити</Text></TouchableOpacity>
                </View>
            </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Абсолютна позиція шапки поверх списку
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  viewerContent: { 
      padding: 24, borderRadius: 20, minHeight: 150, justifyContent: 'center',
      ...Platform.select({ web: { boxShadow: '0px 4px 12px rgba(0,0,0,0.2)' }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 } })
  },
  fab: { 
      position: 'absolute', bottom: 90, right: 17, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', zIndex: 50,
      ...Platform.select({ web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.3)' }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 } })
  }
});
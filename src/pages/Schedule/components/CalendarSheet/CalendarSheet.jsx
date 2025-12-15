import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, Modal, StyleSheet, TouchableOpacity, 
  Animated, Dimensions, TouchableWithoutFeedback, FlatList 
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import AppBlur from '../../../../components/AppBlur';
import { useSchedule } from '../../../../context/ScheduleProvider';
import themes from '../../../../config/themes';
import { useCalendarLogic } from './useCalendarLogic';
import CalendarGrid from './CalendarGrid';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTENT_HEIGHT = 380; 

export default function CalendarSheet({ visible, onClose, onDateSelect, currentDate }) {
  const { global, schedule } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [isPickerMode, setIsPickerMode] = useState(false);
  
  const yearsListRef = useRef(null);

  const { 
    viewDate, calendarDays, weekDayNames, 
    nextMonth, prevMonth, getWeekNumber,
    setMonth, setYear 
  } = useCalendarLogic(currentDate, schedule);

  useEffect(() => {
    if (visible) {
      setIsPickerMode(false);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 90 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  // 🔥 ВИПРАВЛЕННЯ: Миттєве центрування року
  useEffect(() => {
    if (isPickerMode && yearsListRef.current) {
        // Використовуємо setTimeout 0, щоб дати списку змонтуватися
        setTimeout(() => {
            yearsListRef.current?.scrollToIndex({ 
                index: 5, 
                animated: false, // 👈 Головне: вимикаємо анімацію, щоб не було "їзди"
                viewPosition: 0.5 // 👈 Центруємо елемент (0.5 = центр)
            });
        }, 0);
    }
  }, [isPickerMode]);

  if (!visible) return null;

  const monthNames = [
    "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
    "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
  ];

  // Масив років: завжди 11 елементів, де поточний рік по центру (індекс 5)
  const years = Array.from({ length: 11 }, (_, i) => viewDate.getFullYear() - 5 + i);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], backgroundColor: themeColors.backgroundColor }]}>
            <View style={StyleSheet.absoluteFill}>
                 <AppBlur style={StyleSheet.absoluteFill} intensity={80} tint={mode === 'dark' ? 'dark' : 'light'} />
            </View>

            {/* --- HEADER --- */}
            <View style={styles.header}>
                <View style={styles.navButtonContainer}>
                    {!isPickerMode && (
                        <TouchableOpacity onPress={prevMonth} style={styles.arrowBtn} hitSlop={10}>
                            <Ionicons name="chevron-back" size={24} color={themeColors.textColor} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Центральна кнопка-перемикач */}
                <TouchableOpacity 
                  style={[
                    styles.titleButton, 
                    isPickerMode && { backgroundColor: themeColors.borderColor } 
                  ]}
                  onPress={() => setIsPickerMode(!isPickerMode)}
                  activeOpacity={0.6}
                >
                    <Text style={[styles.title, { color: themeColors.textColor }]}>
                        {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                    </Text>
                    <Ionicons 
                      name={isPickerMode ? "chevron-up" : "chevron-down"} 
                      size={18} 
                      color={themeColors.accentColor} 
                      style={{ marginLeft: 6, marginTop: 2 }}
                    />
                </TouchableOpacity>

                <View style={styles.navButtonContainer}>
                    {!isPickerMode && (
                        <TouchableOpacity onPress={nextMonth} style={styles.arrowBtn} hitSlop={10}>
                            <Ionicons name="chevron-forward" size={24} color={themeColors.textColor} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* --- BODY --- */}
            <View style={{ height: CONTENT_HEIGHT }}>
              {isPickerMode ? (
                // --- PICKER MODE ---
                <View style={styles.pickerContainer}>
                  
                  <View style={styles.yearsWrapper}>
                    <FlatList
                        ref={yearsListRef}
                        data={years}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.toString()}
                        getItemLayout={(data, index) => (
                            { length: 80, offset: 80 * index, index }
                        )}
                        // initialScrollIndex={5} // Можна прибрати, бо useEffect зробить це точніше
                        renderItem={({ item: y }) => {
                            const isSelected = y === viewDate.getFullYear();
                            return (
                                <TouchableOpacity 
                                    style={[
                                    styles.yearChip, 
                                    isSelected && { backgroundColor: themeColors.accentColor }
                                    ]}
                                    onPress={() => setYear(y)}
                                >
                                    <Text style={[
                                    styles.yearText, 
                                    { color: isSelected ? '#fff' : themeColors.textColor }
                                    ]}>{y}</Text>
                                </TouchableOpacity>
                            );
                        }}
                    />
                  </View>

                  <View style={styles.monthsGrid}>
                    {monthNames.map((m, index) => {
                      const isSelected = index === viewDate.getMonth();
                      return (
                        <TouchableOpacity 
                          key={index} 
                          style={[
                            styles.monthItem, 
                            isSelected && { borderColor: themeColors.accentColor, borderWidth: 1.5, backgroundColor: themeColors.borderColor }
                          ]}
                          onPress={() => {
                            setMonth(index);
                            setIsPickerMode(false);
                          }}
                        >
                          <Text style={[
                            styles.monthText, 
                            { color: isSelected ? themeColors.accentColor : themeColors.textColor }
                          ]}>{m}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              ) : (
                // --- CALENDAR GRID ---
                <CalendarGrid 
                    days={calendarDays}
                    weekDayNames={weekDayNames}
                    getWeekNumber={getWeekNumber}
                    currentSelectedDate={currentDate}
                    onSelectDate={(date) => {
                        onDateSelect(date);
                        onClose(); 
                    }}
                />
              )}
            </View>
            
            <View style={{ height: 40 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    overflow: 'hidden',
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
    height: 50,
  },
  navButtonContainer: {
      width: 44,
      alignItems: 'center'
  },
  arrowBtn: { padding: 10 },

  titleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  title: { fontSize: 18, fontWeight: 'bold' },

  pickerContainer: { flex: 1, paddingHorizontal: 15 },
  yearsWrapper: { height: 50, marginBottom: 15 },
  
  yearChip: {
    width: 72, 
    height: 36,
    marginRight: 8,
    borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 7, 
  },
  yearText: { fontWeight: 'bold', fontSize: 15 },
  
  monthsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  monthItem: {
    width: '31%', 
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(120,120,120,0.1)'
  },
  monthText: { fontWeight: '600' }
});
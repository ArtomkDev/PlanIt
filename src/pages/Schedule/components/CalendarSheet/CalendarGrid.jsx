import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import themes from '../../../../config/themes';
import { useSchedule } from '../../../../context/ScheduleProvider';

const CELL_SIZE = 40; // Розмір клітинки дати
const GAP = 8; // Відступ між клітинками

export default function CalendarGrid({ 
  days, 
  onSelectDate, 
  currentSelectedDate, 
  getWeekNumber, 
  weekDayNames 
}) {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const todayStr = new Date().toDateString();

  // Групуємо дні по тижнях (по 7 днів)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      {/* Шапка днів тижня */}
      <View style={styles.row}>
        {/* Пусте місце над колонкою номерів тижнів (якщо вона є) */}
        {getWeekNumber(new Date()) !== null && <View style={styles.weekNumPlaceholder} />}
        
        {weekDayNames.map((name, index) => (
            <View key={index} style={styles.cell}>
                <Text style={[styles.dayName, { color: themeColors.textColor2 }]}>{name}</Text>
            </View>
        ))}
      </View>

      {/* Сітка */}
      {weeks.map((week, wIndex) => {
        // Беремо перший день тижня для розрахунку його номера
        const weekNum = getWeekNumber(week[0].date); 

        return (
          <View key={wIndex} style={styles.row}>
            {/* Колонка з номером тижня (Тільки якщо weekNum існує) */}
            {weekNum !== null && (
              <View style={styles.weekNumContainer}>
                <Text style={[styles.weekNumText, { color: themeColors.accentColor }]}>
                  {weekNum}
                </Text>
              </View>
            )}

            {/* Дні тижня */}
            {week.map((dayObj, dIndex) => {
              const isToday = dayObj.date.toDateString() === todayStr;
              const isSelected = currentSelectedDate.toDateString() === dayObj.date.toDateString();
              
              // Стилі
              let bg = 'transparent';
              let textColor = dayObj.isCurrentMonth ? themeColors.textColor : themeColors.textColor2;
              let borderWidth = 0;

              if (isToday) {
                bg = themeColors.accentColor; // Сьогодні - залитий кружечок
                textColor = '#fff';
              } else if (isSelected) {
                borderWidth = 1.5; // Обраний - обводка
              }

              return (
                <TouchableOpacity
                  key={dIndex}
                  style={[
                    styles.cell, 
                    { backgroundColor: bg, borderColor: themeColors.accentColor, borderWidth }
                  ]}
                  onPress={() => onSelectDate(dayObj.date)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, { color: textColor, fontWeight: isToday ? 'bold' : 'normal' }]}>
                    {dayObj.date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 10 },
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: GAP, alignItems: 'center' },
  
  // Клітинка дати
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: CELL_SIZE / 2,
    marginHorizontal: 2,
  },
  
  // Тексти
  dayName: { fontSize: 12, textTransform: 'uppercase', marginBottom: 5 },
  dayText: { fontSize: 16 },

  // Колонка номера тижня
  weekNumPlaceholder: { width: 30, marginRight: 5 },
  weekNumContainer: { width: 30, marginRight: 5, justifyContent: 'center', alignItems: 'center' },
  weekNumText: { fontSize: 12, fontWeight: 'bold', opacity: 0.8 },
});
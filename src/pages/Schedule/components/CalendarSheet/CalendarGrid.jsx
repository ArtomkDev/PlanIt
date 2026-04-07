import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import themes from '../../../../config/themes';
import { useSchedule } from '../../../../context/ScheduleProvider';

const CELL_SIZE = 40;
const GAP = 8;

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

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {getWeekNumber(new Date()) !== null && <View style={styles.weekNumPlaceholder} />}
        
        {weekDayNames.map((name, index) => (
          <View key={index} style={styles.cell}>
            <Text style={[styles.dayName, { color: themeColors.textColor2 }]}>{name}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wIndex) => {
        const weekNum = getWeekNumber(week[0].date); 

        return (
          <View key={wIndex} style={styles.row}>
            {weekNum !== null && (
              <View style={styles.weekNumContainer}>
                <Text style={[styles.weekNumText, { color: themeColors.accentColor }]}>
                  {weekNum}
                </Text>
              </View>
            )}

            {week.map((dayObj, dIndex) => {
              const isToday = dayObj.date.toDateString() === todayStr;
              const isSelected = currentSelectedDate.toDateString() === dayObj.date.toDateString();
              
              let bg = 'transparent';
              let textColor = dayObj.isCurrentMonth ? themeColors.textColor : themeColors.textColor2;
              let borderWidth = 0;

              if (isSelected) {
                bg = themeColors.accentColor;
                textColor = '#fff';
              }
              else if (isToday) {
                borderWidth = 1.5;
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
                  <Text style={[styles.dayText, { color: textColor, fontWeight: (isToday || isSelected) ? 'bold' : 'normal' }]}>
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
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: CELL_SIZE / 2,
    marginHorizontal: 2,
  },
  dayName: { fontSize: 12, textTransform: 'uppercase', marginBottom: 5 },
  dayText: { fontSize: 16 },
  weekNumPlaceholder: { width: 30, marginRight: 5 },
  weekNumContainer: { width: 30, marginRight: 5, justifyContent: 'center', alignItems: 'center' },
  weekNumText: { fontSize: 12, fontWeight: 'bold', opacity: 0.8 },
});
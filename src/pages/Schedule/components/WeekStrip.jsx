import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import themes from '../../../config/themes';
import { useSchedule } from '../../../context/ScheduleProvider';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const WeekStrip = React.memo(({ currentDate, onSelectDate }) => {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);

  const weekDates = useMemo(() => {
    const dates = [];
    const current = new Date(currentDate); 
    const dayOfWeek = current.getDay(); 
    const currentDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    
    current.setDate(current.getDate() - currentDayIndex);

    for (let i = 0; i < 7; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [currentDate]);

  return (
    <View style={styles.container}>
      {weekDates.map((date, index) => {
        // Порівнюємо тільки день, місяць і рік
        const isSelected = date.toDateString() === currentDate.toDateString();
        const isToday = date.toDateString() === new Date().toDateString();

        return (
          <TouchableOpacity
            key={index}
            style={styles.dayContainer}
            onPress={() => onSelectDate(date)}
            activeOpacity={0.7}
          >
            {/* Назва дня тижня (Пн, Вт...) */}
            <Text style={[
              styles.dayName, 
              { color: isSelected ? themeColors.accentColor : themeColors.textColor2 }
            ]}>
              {DAYS[index]}
            </Text>

            {/* Число (12, 13...) в колі */}
            <View style={[
                styles.dateCircle,
                isSelected && { backgroundColor: themeColors.accentColor },
                !isSelected && isToday && { borderWidth: 1, borderColor: themeColors.accentColor }
            ]}>
                <Text style={[
                  styles.dayNumber, 
                  { color: isSelected ? '#fff' : themeColors.textColor }
                ]}>
                  {date.getDate()}
                </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

export default WeekStrip;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
  },
  dayName: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
  }
});
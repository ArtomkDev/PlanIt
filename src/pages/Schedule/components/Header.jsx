import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSchedule } from "../../../context/ScheduleProvider";
import themes from "../../../config/themes";

export default function Header({ currentDate, onDateChange, onTodayPress }) {
  const { global, schedule } = useSchedule();
  const [showDatePicker, setShowDatePicker] = useState(false);

  if (!schedule) return null;

  const [mode, accent] = global.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };

  // Форматуємо місяць і рік (наприклад, "Жовтень 2025")
  const monthYearString = currentDate.toLocaleDateString("uk-UA", { month: 'long', year: 'numeric' });
  // Робимо першу літеру великою
  const formattedDate = monthYearString.charAt(0).toUpperCase() + monthYearString.slice(1);

  return (
    <View style={styles.headerWrapper}>
      
      <View style={styles.headerContent}>
        {/* Ліва частина */}
        <View style={styles.leftSection}>
           {/* Назва розкладу дрібним шрифтом */}
           <Text style={[styles.scheduleName, { color: themeColors.textColor2 }]}>
             {schedule?.name || "Розклад"}
           </Text>
           
           {/* Дата великим шрифтом */}
           <TouchableOpacity 
             style={styles.dateSelector} 
             onPress={() => setShowDatePicker(true)}
             activeOpacity={0.6}
           >
             <Text style={[styles.dateText, { color: themeColors.textColor }]}>
               {formattedDate}
             </Text>
             <Ionicons name="chevron-down" size={18} color={themeColors.accentColor} style={{ marginTop: 2 }}/>
           </TouchableOpacity>
        </View>

        {/* Права частина */}
        <TouchableOpacity 
            style={[
                styles.todayButton, 
                { backgroundColor: themeColors.accentColor } // Легкий фон для кнопки
            ]} 
            onPress={onTodayPress}
        >
            <Text style={[styles.todayText, { color: themeColors.textColor }]}>Сьогодні</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    zIndex: 100,
    paddingTop: 50, 
    paddingBottom: 5, 
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Вирівнювання по низу, щоб дата і кнопка були на одній лінії
  },
  leftSection: {
    flexDirection: 'column',
    gap: 2,
  },
  scheduleName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: { 
    fontSize: 26, 
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  todayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  todayText: {
    fontSize: 13,
    fontWeight: '700',
  }
});
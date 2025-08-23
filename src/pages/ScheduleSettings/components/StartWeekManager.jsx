import React, { useState, useEffect } from 'react';
import { View, Button, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import SettingsScreenLayout from '../SettingsScreenLayout';

export default function StartWeekScreen() {
  const { schedule, setScheduleDraft } = useSchedule();

  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Використовуємо тему з розкладу або дефолт
  const theme = schedule?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  useEffect(() => {
    if (schedule?.starting_week) {
      setSelectedDate(new Date(schedule.starting_week));
    }
  }, [schedule]);

  const getMondayOfWeek = (date) => {
    const copiedDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = copiedDate.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    copiedDate.setUTCDate(copiedDate.getUTCDate() + diff);
    return copiedDate;
  };

  const handleDateSelection = (date) => {
    if (!date) return;
    const cleanDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const monday = getMondayOfWeek(cleanDate);
    setSelectedDate(cleanDate);
    setShowPicker(false);

    setScheduleDraft({
      ...schedule,
      starting_week: monday.toISOString().split('T')[0],
    });
  };

  return (
    <SettingsScreenLayout>
      <View style={styles.inputContainer}>
        <Button
          title={`Вибрати дату (${getMondayOfWeek(selectedDate).toISOString().split('T')[0]})`}
          onPress={() => setShowPicker(!showPicker)}
          color={themeColors.accentColor}
        />

        {showPicker && (
          <View
            style={
              Platform.OS === 'web'
                ? styles.webPicker
                : [styles.pickerContainer, { backgroundColor: themeColors.backgroundColor2 }]
            }
          >
            {Platform.OS === 'web' ? (
              <DatePicker
                selected={selectedDate}
                onChange={(date) => handleDateSelection(date)}
                inline
              />
            ) : (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={(event, date) => handleDateSelection(date)}
              />
            )}
          </View>
        )}
      </View>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    padding: 10,
    alignItems: 'center',
  },
  pickerContainer: {
    marginTop: 10,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    elevation: 5,
  },
  webPicker: {
    marginTop: 10,
    width: '100%',
  },
});

// src/components/SettingsScreenLayout.jsx
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';

export default function SettingsScreenLayout({ children, contentContainerStyle }) {
  const { global, schedule } = useSchedule();
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {paddingTop: 100, paddingBottom: 60 },
});

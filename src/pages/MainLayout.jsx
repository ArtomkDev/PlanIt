import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';

import AutoSaveManager from '../components/AutoSaveManager';
import TabNavigator from '../Navigation/TabNavigator';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import { t } from '../utils/i18n';
import MigrationModal from '../components/MigrationModal';

export default function MainLayout({ guest, onExitGuest }) {
  const {
    user,
    global,
    schedule,
    isLoading,
    error,
    lang
  } = useSchedule();

  if (isLoading && !schedule) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error && !schedule) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t('common.error', lang)}: {error}</Text>
      </View>
    );
  }

  if (!schedule) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{t('main_layout.no_schedule_data', lang)}</Text>
      </View>
    );
  }

  const [currentTheme, currentAccent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(currentTheme, currentAccent);
  const isLightMode = currentTheme === 'light';

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <StatusBar
        translucent
        style={isLightMode ? 'dark' : 'light'}
      />

      <View style={styles.container}>
        <TabNavigator screenProps={{ guest, onExitGuest }} />
      </View>

      <AutoSaveManager />
      
      {!guest && user?.uid && (
        <MigrationModal userId={user.uid} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
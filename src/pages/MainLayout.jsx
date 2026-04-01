import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';

import AutoSaveManager from '../components/AutoSaveManager';
import TabNavigator from '../Navigation/TabNavigator';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import { t } from '../utils/i18n';
import MigrationModal from '../components/MigrationModal';
import AppBlur from '../components/AppBlur';

export default function MainLayout({ guest, onExitGuest }) {
  const {
    user,
    global,
    schedule,
    isLoading,
    error,
    lang,
    resetApplication
  } = useSchedule();

  const [isFatalTimeout, setIsFatalTimeout] = useState(false);

  const isBlocking = isLoading || !schedule || error;
  const isErrorState = error || isFatalTimeout;

  useEffect(() => {
    let timer;
    if (isBlocking) {
      timer = setTimeout(() => {
        setIsFatalTimeout(true);
      }, 5000);
    } else {
      setIsFatalTimeout(false);
    }

    return () => clearTimeout(timer);
  }, [isBlocking]);

  const handleForceCreate = async () => {
    setIsFatalTimeout(false);
    await resetApplication(); 
  };

  const [currentTheme, currentAccent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(currentTheme, currentAccent);
  const isLightMode = currentTheme === 'light';

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <StatusBar translucent style={isLightMode ? 'dark' : 'light'} />

      <View style={styles.container}>
        <TabNavigator screenProps={{ guest, onExitGuest }} />
      </View>

      {isBlocking && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          {isErrorState ? (
            <>
              <AppBlur style={StyleSheet.absoluteFill} intensity={25} tint={isLightMode ? 'light' : 'dark'} />
              <View style={[styles.overlayContent, { backgroundColor: isLightMode ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.85)' }]}>
                
                {!isFatalTimeout ? (
                  <>
                    <ActivityIndicator size="large" color={themeColors.accentColor} style={{ marginBottom: 16 }} />
                    <Text style={[styles.statusText, { color: themeColors.textColor }]}>
                      {`${t('common.error', lang)}: ${error}`}
                    </Text>
                  </>
                ) : (
                  <View style={styles.fatalBox}>
                    <Text style={[styles.fatalTitle, { color: themeColors.textColor }]}>
                      {t('main_layout.fatal_title', lang)}
                    </Text>
                    <Text style={[styles.fatalDesc, { color: themeColors.textMuted || '#8E8E93' }]}>
                      {error ? error : t('main_layout.fatal_desc', lang)}
                    </Text>
                    <TouchableOpacity 
                      style={[styles.forceButton, { backgroundColor: themeColors.accentColor }]}
                      onPress={handleForceCreate}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.forceButtonText}>
                        {t('main_layout.force_create_btn', lang)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            </>
          ) : (
            <ActivityIndicator size="large" color={themeColors.accentColor} />
          )}
        </View>
      )}

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
  overlay: {
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  fatalBox: {
    alignItems: 'center',
    width: '100%',
  },
  fatalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  fatalDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  forceButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  forceButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  }
});
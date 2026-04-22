import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AutoSaveManager from '../services/AutoSaveManager';
import TabNavigator from '../navigation/TabNavigator';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import { t } from '../utils/i18n';
import MigrationModal from '../components/modals/MigrationModal';
import AppBlur from '../components/ui/AppBlur';
import MorphingLoader from '../components/ui/MorphingLoader';

import SyncConflictScreen from '../pages/SyncConflict/SyncConflictScreen';
import AdBanner from '../components/AdBanner/AdBanner';
import OnboardingWizard from '../pages/Onboarding/OnboardingWizard';

const MainStack = createNativeStackNavigator();

export default function MainLayout({ guest, onExitGuest }) {
  const {
    user,
    global,
    schedule,
    schedules,
    isLoading,
    cloudSyncState,
    error,
    lang,
    resetApplication,
    conflictQueue,
    handleResolveConflict
  } = useSchedule();

  const [isFatalTimeout, setIsFatalTimeout] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const hasSchedules = schedules && schedules.length > 0;
  
  const isInitialSync = user && !guest && !hasSchedules && cloudSyncState === 'syncing';
  const isBlocking = isLoading || isInitialSync || error || (hasSchedules && !schedule);
  const isErrorState = error || isFatalTimeout;

  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isBlocking && !hasSchedules) {
      const timeout = setTimeout(() => setShowOnboarding(true), 150);
      return () => clearTimeout(timeout);
    } else {
      setShowOnboarding(false);
    }
  }, [isBlocking, hasSchedules]);

  useEffect(() => {
    let timer;
    if (isBlocking) {
      timer = setTimeout(() => {
        setIsFatalTimeout(true);
      }, 5000);
      
      setShowOverlay(true);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setIsFatalTimeout(false);
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => setShowOverlay(false));
    }

    return () => clearTimeout(timer);
  }, [isBlocking, overlayOpacity]);

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
        <View style={{ flex: 1 }}>
          <MainStack.Navigator screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 500 }}>
            {showOnboarding ? (
              <MainStack.Screen name="Onboarding" component={OnboardingWizard} />
            ) : (
              <MainStack.Screen name="Tabs">
                {() => <TabNavigator screenProps={{ guest, onExitGuest }} />}
              </MainStack.Screen>
            )}
          </MainStack.Navigator>
        </View>
      </View>

      {showOverlay && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: themeColors.backgroundColor, opacity: overlayOpacity }]}>
          {isErrorState ? (
            <>
              <AppBlur style={StyleSheet.absoluteFill} intensity={25} tint={isLightMode ? 'light' : 'dark'} />
              <View style={[styles.overlayContent, { backgroundColor: isLightMode ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.85)' }]}>
                
                {!isFatalTimeout ? (
                  <>
                    <MorphingLoader size={50} style={{ marginBottom: 16 }} />
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
            <MorphingLoader size={80} />
          )}
        </Animated.View>
      )}

      <AutoSaveManager />
      
      {!guest && user?.uid && (
        <MigrationModal userId={user.uid} />
      )}

      <SyncConflictScreen 
        conflictQueue={conflictQueue}
        handleResolveConflict={handleResolveConflict}
        lang={lang}
      />
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
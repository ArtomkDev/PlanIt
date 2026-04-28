import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Modal, AppState } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AutoSaveManager from '../services/AutoSaveManager';
import TabNavigator from '../navigation/TabNavigator';
import { useSchedule } from '../context/ScheduleProvider';
import themes from '../config/themes';
import { t } from '../utils/i18n';
import MigrationModal from '../components/modals/MigrationModal';
import AppBlur from '../components/ui/AppBlur';
import MorphingLoader from '../components/ui/MorphingLoader';

import SyncConflictScreen from '../pages/SyncConflict/SyncConflictScreen';
import OnboardingWizard from '../pages/Onboarding/OnboardingWizard';
import { syncScheduleToWidget } from '../widgets/widgetService';

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

  const navigation = useNavigation();

  const [isFatalTimeout, setIsFatalTimeout] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);

  const hasSchedules = schedules && schedules.length > 0;
  const isInitialSync = user && !guest && !hasSchedules && cloudSyncState === 'syncing';
  const isBlocking = isLoading || isInitialSync || error || (hasSchedules && !schedule);
  const isErrorState = error || isFatalTimeout;

  const [showOverlay, setShowOverlay] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkIntent = async () => {
      try {
        const intentStr = await AsyncStorage.getItem('widget_intent');
        if (!intentStr) return;

        const intent = JSON.parse(intentStr);
        if (Date.now() - intent.timestamp < 5000) {
          if (intent.action === 'OPEN_SCHEDULE_SELECTOR') {
            setShowWidgetConfig(true);
            await AsyncStorage.removeItem('widget_intent');
          }
        }
        await AsyncStorage.removeItem('widget_intent');
      } catch (e) {}
    };

    checkIntent();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkIntent();
      }
    });

    return () => subscription.remove();
  }, [navigation]);

  const handleSelectWidgetSchedule = async (sch) => {
    await syncScheduleToWidget(sch);
    setShowWidgetConfig(false);
  };

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

      <Modal visible={showWidgetConfig} animationType="fade" transparent={true}>
        <View style={styles.widgetModalOverlay}>
          <View style={[styles.widgetModalContent, { backgroundColor: themeColors.cardBackground || '#1C1C1E' }]}>
            <Text style={[styles.widgetModalTitle, { color: themeColors.textColor }]}>
              Виберіть розклад для віджета
            </Text>
            
            {schedules && schedules.length > 0 ? schedules.map(sch => (
              <TouchableOpacity
                key={sch.id}
                style={[styles.widgetScheduleOption, { backgroundColor: themeColors.backgroundColor || '#2C2C2E' }]}
                onPress={() => handleSelectWidgetSchedule(sch)}
                activeOpacity={0.7}
              >
                <Text style={[styles.widgetScheduleText, { color: themeColors.textColor }]}>
                  {sch.name || 'Без назви'}
                </Text>
              </TouchableOpacity>
            )) : (
              <Text style={{ color: themeColors.textMuted, textAlign: 'center', marginBottom: 20 }}>
                У вас ще немає жодного розкладу
              </Text>
            )}

            <TouchableOpacity style={styles.widgetCancelBtn} onPress={() => setShowWidgetConfig(false)}>
              <Text style={styles.widgetCancelText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1 },
  overlay: { zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  overlayContent: { padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', width: '85%', maxWidth: 400, elevation: 10 },
  statusText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  fatalBox: { alignItems: 'center', width: '100%' },
  fatalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  fatalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  forceButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  forceButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  widgetModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 9999 },
  widgetModalContent: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  widgetModalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  widgetScheduleOption: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)' },
  widgetScheduleText: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  widgetCancelBtn: { marginTop: 12, padding: 16 },
  widgetCancelText: { color: '#FF453A', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }
});
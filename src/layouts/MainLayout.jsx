import { StatusBar } from 'expo-status-bar';
import { requireOptionalNativeModule } from 'expo';
import * as SystemUI from 'expo-system-ui';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, AppState, Appearance, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import AutoSaveManager from '../services/AutoSaveManager';
import { useScheduleActions, useScheduleData, useScheduleSync } from '../context/ScheduleProvider';
import useAppTheme from '../hooks/useAppTheme';
import { t } from '../utils/i18n';
import MigrationModal from '../components/modals/MigrationModal';
import AppBlur from '../components/ui/AppBlur';
import MorphingLoader from '../components/ui/MorphingLoader';
import AdBanner from '../components/AdBanner/AdBanner';
import { useBottomSheetPresentation } from '../context/BottomSheetPresentationContext';
import { useAttachmentImagePreview } from '../context/AttachmentImagePreviewContext';

import SyncConflictScreen from '../pages/SyncConflict/SyncConflictScreen';
import ImportScheduleModal from '../components/modals/ImportScheduleModal';
import SchedulePickerSheet from '../pages/Schedule/components/SchedulePickerSheet';
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';

const MainStack = createNativeStackNavigator();

const updateAndroidSystemBars = async (backgroundColor, style) => {
  if (AppState.currentState !== 'active') return;
  try {
    // Expo's public setStyle wrapper discards the native promise in this SDK.
    const navigationBar = requireOptionalNativeModule('ExpoNavigationBar');
    await Promise.all([
      SystemUI.setBackgroundColorAsync(backgroundColor),
      navigationBar?.setStyle(style),
    ]);
  } catch (error) {
    if (error?.code !== 'ERR_MISSING_ACTIVITY') console.warn('Unable to update Android system bars:', error);
  }
};

export default function MainLayout({ guest, onExitGuest }) {
  const reduceMotion = useReducedMotionPreference();
  const {
    user,
    schedule,
    schedules,
    isLoading,
    error,
    lang,
    widgetScheduleId,
  } = useScheduleData();
  const {
    cloudSyncState,
    conflictQueue,
    handleResolveConflict,
  } = useScheduleSync();
  const {
    retryInitialization,
    selectWidgetSchedule,
  } = useScheduleActions();

  const navigation = useNavigation();
  const isBannerRoute = useNavigationState((state) => {
    let route = state.routes[state.index ?? 0];
    while (route?.state) {
      route = route.state.routes[route.state.index ?? 0];
    }
    return route?.name === 'ScheduleTab' || route?.name === 'TasksTab';
  });
  const { hasPresentedSheets } = useBottomSheetPresentation();
  const { isImagePreviewOpen } = useAttachmentImagePreview();
  const url = Linking.useURL();

  const [isFatalTimeout, setIsFatalTimeout] = useState(false);
  const [retrySequence, setRetrySequence] = useState(0);
  const [confirmedEmptyScope, setConfirmedEmptyScope] = useState(null);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const hasSchedules = schedules && schedules.length > 0;
  const hasUsableSchedule = hasSchedules && !!schedule;
  const emptyStateScope = guest ? 'guest' : (user?.uid || 'none');
  const hasConfirmedEmptyState = confirmedEmptyScope === emptyStateScope;
  // Network/sync errors must never hide an already loaded schedule behind the
  // destructive recovery screen. That screen is only for an actual unusable
  // data state; expected conflicts are handled by SyncConflictScreen.
  const hasFatalDataError = !!error && !hasUsableSchedule;
  const canConfirmEmptyState = (
    !isLoading
    && !hasSchedules
    && !hasFatalDataError
    && (guest || !user || cloudSyncState === 'synced' || cloudSyncState === 'offline')
  );
  // Once an authoritative empty state has been observed, keep onboarding
  // mounted through transient syncing/cache metadata changes. It is dismissed
  // only when the user actually creates (or receives) an active schedule.
  const showOnboarding = !hasSchedules && (hasConfirmedEmptyState || canConfirmEmptyState);
  const isInitialSync = (
    user
    && !guest
    && !hasSchedules
    && !hasConfirmedEmptyState
    && cloudSyncState === 'syncing'
  );
  const isBlocking = isLoading || isInitialSync || hasFatalDataError || (hasSchedules && !schedule);
  const isErrorState = hasFatalDataError || isFatalTimeout;

  const [showOverlay, setShowOverlay] = useState(true);
  const [hasContentLayout, setHasContentLayout] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (url) {
      let code = null;
      if (url.includes("share/")) {
        const parts = url.split("share/");
        code = parts[1]?.split("?")[0]?.replace("/", "");
      }
      if (code && code.length >= 5) {
        setImportCode(code.toUpperCase());
        setImportModalVisible(true);
      }
    }
  }, [url]);

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
  }, []);

  useEffect(() => {
    if (hasSchedules) {
      setConfirmedEmptyScope(null);
      return;
    }
    if (canConfirmEmptyState) {
      setConfirmedEmptyScope(emptyStateScope);
    }
  }, [hasSchedules, canConfirmEmptyState, emptyStateScope]);

  useEffect(() => {
    let timer;
    if (isBlocking || !hasContentLayout) {
      timer = setTimeout(() => {
        setIsFatalTimeout(true);
      }, 12000);
      
      setShowOverlay(true);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 160,
        useNativeDriver: true,
      }).start();
    } else {
      setIsFatalTimeout(false);
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowOverlay(false);
      });
    }

    return () => {
      clearTimeout(timer);
      overlayOpacity.stopAnimation();
    };
  }, [isBlocking, hasContentLayout, overlayOpacity, reduceMotion, retrySequence]);

  const handleRetry = () => {
    setIsFatalTimeout(false);
    setRetrySequence(sequence => sequence + 1);
    retryInitialization();
  };

  const handleCloseImportModal = () => {
    setImportModalVisible(false);
    setImportCode("");
  };

  const handleAddScheduleFromWidgetPicker = () => {
    navigation.navigate("Tabs", {
      screen: "SettingsTab",
      params: {
        screen: "ScheduleEditorScreen",
        params: { isNew: true },
      },
    });
  };

  const { colors: themeColors, colorScheme } = useAppTheme();
  const isLightMode = colorScheme === 'light';
  const shouldShowBanner = hasSchedules && isBannerRoute && !isBlocking && !showOverlay && conflictQueue.length === 0;
  const bannerVisible = shouldShowBanner && !hasPresentedSheets && !isImagePreviewOpen
    && !notificationsVisible && !importModalVisible && !showWidgetConfig;

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const apply = () => updateAndroidSystemBars(themeColors.backgroundColorTabNavigator, isLightMode ? 'dark' : 'light');
    apply();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') apply();
    });
    return () => subscription.remove();
  }, [themeColors.backgroundColorTabNavigator, isLightMode]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    return () => {
      updateAndroidSystemBars(null, Appearance.getColorScheme() === 'dark' ? 'light' : 'dark');
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <StatusBar style={isLightMode ? 'dark' : 'light'} />

      <AdBanner visible={bannerVisible} reserveSpace={shouldShowBanner} />

      <SafeAreaProvider style={styles.container} accessibilityElementsHidden={showOverlay || conflictQueue.length > 0}
        importantForAccessibility={showOverlay || conflictQueue.length > 0 ? 'no-hide-descendants' : 'auto'}>
        <View style={{ flex: 1 }}>
          <MainStack.Navigator
            screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade', animationDuration: 220 }}
          >
            {showOnboarding ? (
              <MainStack.Screen name="Onboarding">
                {() => {
                  const OnboardingWizard = require('../pages/Onboarding/OnboardingWizard').default;
                  return <OnboardingWizard
                    onLayout={() => setHasContentLayout(true)}
                    onImportSchedule={() => {
                      setImportCode("");
                      setImportModalVisible(true);
                    }}
                  />;
                }}
              </MainStack.Screen>
            ) : (
              <MainStack.Screen name="Tabs">
                {() => {
                  const TabNavigator = require('../navigation/TabNavigator').default;
                  return <TabNavigator screenProps={{ guest, onExitGuest }} onNotificationsVisibilityChange={setNotificationsVisible}
                    onLayout={() => setHasContentLayout(true)} />;
                }}
              </MainStack.Screen>
            )}
          </MainStack.Navigator>
        </View>
      </SafeAreaProvider>

      <SchedulePickerSheet
        visible={showWidgetConfig}
        onClose={() => setShowWidgetConfig(false)}
        selectedScheduleId={widgetScheduleId}
        onSelectSchedule={selectWidgetSchedule}
        onAddSchedule={handleAddScheduleFromWidgetPicker}
        variant="widget"
        testID="widget-schedule-sheet"
      />

      {showOverlay && (
        <Animated.View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={isErrorState ? t('main_layout.fatal_title', lang) : t('schedule.loading', lang)}
          accessibilityViewIsModal
          style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: themeColors.backgroundColor, opacity: overlayOpacity }]}>
          {isErrorState ? (
            <>
              <AppBlur style={StyleSheet.absoluteFill} intensity={25} tint={isLightMode ? 'light' : 'dark'} />
              <View style={[styles.overlayContent, { backgroundColor: isLightMode ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.85)' }]}>
                <View style={styles.fatalBox}>
                  <Text style={[styles.fatalTitle, { color: themeColors.textColor }]}>
                    {t('main_layout.fatal_title', lang)}
                  </Text>
                  <Text style={[styles.fatalDesc, { color: themeColors.textColor2 }]}>
                    {t('main_layout.fatal_desc', lang)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: themeColors.accentColor }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.retry', lang)}
                    onPress={handleRetry}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.retryButtonText, { color: themeColors.textOnAccent }]}>
                      {t('common.retry', lang)}
                    </Text>
                  </TouchableOpacity>
                </View>
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

      <ImportScheduleModal
        visible={importModalVisible}
        onClose={handleCloseImportModal}
        initialCode={importCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { zIndex: 1000, justifyContent: 'center', alignItems: 'center' },
  overlayContent: { padding: 24, borderRadius: 20, alignItems: 'center', justifyContent: 'center', width: '85%', maxWidth: 400, elevation: 10 },
  fatalBox: { alignItems: 'center', width: '100%' },
  fatalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  fatalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  retryButtonText: { fontSize: 16, fontWeight: '700' }
});

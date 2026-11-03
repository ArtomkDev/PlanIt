import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CalendarDots, CheckSquare, GearSix } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import themes from '../config/themes';
import { useScheduleData, useScheduleLayout } from '../context/ScheduleProvider';
import { NotificationDrawerProvider } from '../context/NotificationDrawerContext';
import MorphingLoader from '../components/ui/MorphingLoader';
import PlanItTabBar from './PlanItTabBar';
import { LIQUID_GLASS_NAVIGATION_STYLE, resolveNavigationStyle } from './navigationMetrics';
import { t } from '../utils/i18n';
import Schedule from '../pages/Schedule/Schedule';
import { triggerHaptic } from '../utils/haptics';
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';

const Tab = createBottomTabNavigator();
const NativeTab = Platform.OS === 'ios' ? createNativeBottomTabNavigator() : null;
const Stack = createNativeStackNavigator();
const DRAWER_OPEN_DURATION = 285;
const DRAWER_CLOSE_DURATION = 240;
const DRAWER_MOTION_EASING = Easing.bezier(0.2, 0, 0, 1);
const getNativeTabIcon = (name, selectedName = name) => ({ focused }) => ({
  type: 'sfSymbol',
  name: focused ? selectedName : name,
});

function SettingsStack({ screenProps }) {
  const { global: globalSettings } = useScheduleData();
  const [mode, accent] = globalSettings?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          freezeOnBlur: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: themeColors.backgroundColor },
        }}
      >
        <Stack.Screen name="SettingsOverview">
          {props => {
            const Settings = require('../pages/Settings/Settings').default;
            return <Settings {...props} {...screenProps} />;
          }}
        </Stack.Screen>
        
        <Stack.Screen name="ScheduleSwitcher" getComponent={() => require('../pages/Settings/components/ScheduleSwitcher').default} />
        <Stack.Screen name="ScheduleEditorScreen" getComponent={() => require('../pages/Settings/components/ScheduleEditorScreen').default} />
        <Stack.Screen name="Theme" getComponent={() => require('../pages/Settings/components/preferences/ThemeSettings').default} />
        <Stack.Screen name="Navigation" getComponent={() => require('../pages/Settings/components/preferences/NavigationSettings').default} />
        <Stack.Screen name="Language" getComponent={() => require('../pages/Settings/components/preferences/LanguageSettings').default} />
        <Stack.Screen name="ResetDB" getComponent={() => require('../pages/Settings/components/ResetDB').default} />
        <Stack.Screen name="AboutApp" getComponent={() => require('../pages/Settings/components/AboutApp').default} />
        <Stack.Screen name="LegalDocument" getComponent={() => require('../pages/Settings/components/LegalDocumentScreen').default} />
        <Stack.Screen name="DeviceManagement" getComponent={() => require('../pages/Settings/components/managers/DeviceManagement').default} />
        <Stack.Screen name="NotificationsScreen" getComponent={() => require('../pages/Settings/components/NotificationsScreen').default} />
        <Stack.Screen name="FileLibrary" getComponent={() => require('../pages/Settings/components/FileLibraryScreen').default} />
        <Stack.Screen name="AccountSettings" getComponent={() => require('../pages/Settings/components/AccountSettings/AccountSettings').default} />
        <Stack.Screen name="DeleteAccount" getComponent={() => require('../pages/Settings/components/AccountSettings/components/DeleteAccountScreen').default} />
        <Stack.Screen name="ChangeName" getComponent={() => require('../pages/Settings/components/AccountSettings/components/ChangeNameScreen').default} />
        <Stack.Screen name="ChangeEmail" getComponent={() => require('../pages/Settings/components/AccountSettings/components/ChangeEmailScreen').default} />
        <Stack.Screen name="ChangePassword" getComponent={() => require('../pages/Settings/components/AccountSettings/components/ChangePasswordScreen').default} />
        <Stack.Screen name="SharedSchedulesManager" getComponent={() => require('../pages/Settings/components/SharedSchedulesManager').default} />
      </Stack.Navigator>
    </View>
  );
}

export default function TabNavigator({ screenProps, onNotificationsVisibilityChange, onLayout }) {
  const { global: globalSettings, lang, isLoading } = useScheduleData();
  const { tabBarHeight, setTabBarHeight } = useScheduleLayout();
  const reduceMotion = useReducedMotionPreference();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, accent] = globalSettings?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const navigationStyle = resolveNavigationStyle(globalSettings?.navigationStyle);
  const useLiquidGlassTabs = navigationStyle === LIQUID_GLASS_NAVIGATION_STYLE && Boolean(NativeTab);
  const showLabels = globalSettings?.navigationLabels ?? true;
  const scheduleTabLabel = t('common.schedule', lang);
  const tasksTabLabel = t('common.tasks', lang);
  const settingsTabLabel = t('common.settings', lang);
  const drawerProgress = useSharedValue(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsMounted, setNotificationsMounted] = useState(false);

  const drawerWidth = Math.min(
    430,
    Math.max(300, screenWidth * 0.82),
    Math.max(280, screenWidth - 86)
  );
  const drawerInset = screenWidth - drawerWidth;
  const appShellMotionStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          drawerProgress.value,
          [0, 1],
          [0, -drawerWidth]
        ),
      },
      {
        scale: interpolate(drawerProgress.value, [0, 1], [1, 0.975]),
      },
    ],
  }), [drawerWidth]);
  const appShellStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(drawerProgress.value, [0, 1], [0, 20]),
  }));
  const inactiveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      drawerProgress.value,
      [0, 0.7, 1],
      [0, 0.1, 0.16]
    ),
  }));

  const animateNotifications = useCallback((open) => {
    if (open) onNotificationsVisibilityChange?.(true);
    triggerHaptic(open ? "open" : "sheetClose", { key: "notification-drawer" });
    if (open) {
      setNotificationsMounted(true);
    }

    setNotificationsOpen(open);
    cancelAnimation(drawerProgress);

    const toValue = open ? 1 : 0;
    const motionDuration = reduceMotion ? 0 : (open ? DRAWER_OPEN_DURATION : DRAWER_CLOSE_DURATION);
    drawerProgress.value = withTiming(toValue, {
      duration: motionDuration,
      easing: DRAWER_MOTION_EASING,
    }, (finished) => {
      if (finished && !open && onNotificationsVisibilityChange) {
        runOnJS(onNotificationsVisibilityChange)(false);
      }
    });
  }, [drawerProgress, onNotificationsVisibilityChange, reduceMotion]);

  useEffect(() => () => {
    cancelAnimation(drawerProgress);
    onNotificationsVisibilityChange?.(false);
  }, [drawerProgress, onNotificationsVisibilityChange]);

  const openNotifications = useCallback(() => {
    animateNotifications(true);
  }, [animateNotifications]);

  const closeNotifications = useCallback(() => {
    animateNotifications(false);
  }, [animateNotifications]);

  const notificationDrawerValue = useMemo(() => ({
    isNotificationsOpen: notificationsOpen,
    openNotifications,
    closeNotifications,
    drawerProgress,
    drawerContentInset: 0,
  }), [closeNotifications, drawerProgress, notificationsOpen, openNotifications]);

  const drawerPanResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => (
        notificationsOpen &&
        Math.abs(gestureState.dx) > 8 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15
      ),
      onPanResponderMove: (_, gestureState) => {
        if (!notificationsOpen) return;

        const nextProgress = Math.max(
          0,
          Math.min(1, 1 - gestureState.dx / drawerWidth)
        );
        drawerProgress.value = nextProgress;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!notificationsOpen) return;

        const shouldClose = gestureState.dx > drawerWidth * 0.2 || gestureState.vx > 0.45;
        animateNotifications(!shouldClose);
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (!notificationsOpen) return;

        const shouldClose = gestureState.dx > drawerWidth * 0.2 || gestureState.vx > 0.45;
        animateNotifications(!shouldClose);
      },
    }),
    [animateNotifications, drawerProgress, drawerWidth, notificationsOpen]
  );

  const screenPropsRef = useRef(screenProps);
  useEffect(() => {
    screenPropsRef.current = screenProps;
  }, [screenProps]);

  const SettingsStackWrapper = useCallback((props) => (
    <SettingsStack {...props} screenProps={screenPropsRef.current} />
  ), []);

  const handleLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) setTabBarHeight(height);
  }, [setTabBarHeight]);

  useEffect(() => {
    if (useLiquidGlassTabs) {
      setTabBarHeight(58 + Math.max(insets?.bottom || 0, 0));
    }
  }, [insets?.bottom, setTabBarHeight, useLiquidGlassTabs]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <MorphingLoader size={80} />
      </View>
    );
  }

  const NotificationInboxPanel = notificationsMounted
    ? require('../pages/Schedule/components/NotificationInboxPanel').default
    : null;

  return (
    <NotificationDrawerProvider value={notificationDrawerValue}>
      <View
        style={[styles.drawerRoot, { backgroundColor: themeColors.backgroundColor }]}
        onLayout={onLayout}
        {...(notificationsOpen ? drawerPanResponder.panHandlers : {})}
      >
        <View
          pointerEvents={notificationsOpen ? 'auto' : 'none'}
          style={[styles.notificationLayer, { width: drawerWidth, bottom: insets.bottom }]}
        >
          {notificationsMounted && <NotificationInboxPanel backgroundColor="transparent" />}
        </View>

        <Reanimated.View
          style={[
            styles.appShellMotion,
            appShellMotionStyle,
          ]}
        >
          <Reanimated.View
            style={[
              styles.appShell,
              appShellStyle,
              {
                backgroundColor: themeColors.backgroundColor,
              },
            ]}
          >
            {useLiquidGlassTabs ? (
              <NativeTab.Navigator
                screenOptions={{
                  lazy: true,
                  headerShown: false,
                  tabBarActiveTintColor: themeColors.accentColor,
                  tabBarInactiveTintColor: themeColors.textColor2,
                  tabBarBlurEffect: 'systemDefault',
                  tabBarControllerMode: 'tabBar',
                  tabBarMinimizeBehavior: 'auto',
                  overrideScrollViewContentInsetAdjustmentBehavior: true,
                }}
              >
                <NativeTab.Screen
                  name="ScheduleTab"
                  component={Schedule}
                  options={{
                    title: scheduleTabLabel,
                    tabBarLabel: showLabels ? scheduleTabLabel : '',
                    tabBarIcon: getNativeTabIcon('calendar'),
                  }}
                />
                <NativeTab.Screen
                  name="TasksTab"
                  getComponent={() => require('../pages/Tasks/Tasks').default}
                  options={{
                    title: tasksTabLabel,
                    tabBarLabel: showLabels ? tasksTabLabel : '',
                    tabBarIcon: getNativeTabIcon('checkmark.square', 'checkmark.square.fill'),
                  }}
                />
                <NativeTab.Screen
                  name="SettingsTab"
                  component={SettingsStackWrapper}
                  options={{
                    title: settingsTabLabel,
                    tabBarLabel: showLabels ? settingsTabLabel : '',
                    tabBarIcon: getNativeTabIcon('gearshape', 'gearshape.fill'),
                  }}
                />
              </NativeTab.Navigator>
            ) : (
              <Tab.Navigator
                detachInactiveScreens={true}
                tabBar={(props) => (
                  <PlanItTabBar {...props} insets={insets} onLayout={handleLayout} />
                )}
                screenOptions={{
                  sceneContainerStyle: {
                    backgroundColor: themeColors.backgroundColor,
                    paddingBottom: tabBarHeight || (110 + insets.bottom)
                  },
                  tabBarActiveTintColor: themeColors.accentColor,
                  tabBarInactiveTintColor: themeColors.textColor2,
                  tabBarHideOnKeyboard: true,
                  lazy: true,
                  animation: 'none',
                  // Freezing suspends Reanimated views; UI-thread updates made meanwhile are
                  // lost and the schedule pager shows stale positions after returning.
                  freezeOnBlur: false,
                  headerShown: false,
                }}
              >
                <Tab.Screen
                  name="ScheduleTab"
                  component={Schedule}
                  options={{
                    tabBarLabel: scheduleTabLabel,
                    tabBarIcon: ({ color, size, focused }) => (
                      <CalendarDots size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                    ),
                  }}
                />
                <Tab.Screen
                  name="TasksTab"
                  getComponent={() => require('../pages/Tasks/Tasks').default}
                  options={{
                    tabBarLabel: tasksTabLabel,
                    tabBarIcon: ({ color, size, focused }) => (
                      <CheckSquare size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                    ),
                  }}
                />
                <Tab.Screen
                  name="SettingsTab"
                  component={SettingsStackWrapper}
                  options={{
                    tabBarLabel: settingsTabLabel,
                    tabBarIcon: ({ color, size, focused }) => (
                      <GearSix size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                    ),
                  }}
                />
              </Tab.Navigator>
            )}

            <Reanimated.View
              pointerEvents="none"
              style={[
                styles.inactiveOverlay,
                inactiveOverlayStyle,
                {
                  backgroundColor: themeColors.backgroundColor3 || '#000',
                },
              ]}
            />
          </Reanimated.View>
        </Reanimated.View>

        {notificationsOpen && (
          <TouchableOpacity
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', lang)}
            onPress={closeNotifications}
            style={[styles.closeTapTarget, { width: drawerInset }]}
          />
        )}

        {Platform.OS === 'android' && (
          <View
            pointerEvents="none"
            testID="system-navigation-background"
            style={[
              styles.systemNavigationBackground,
              {
                height: insets.bottom,
                backgroundColor: themeColors.backgroundColorTabNavigator,
              },
            ]}
          />
        )}
      </View>
    </NotificationDrawerProvider>
  );
}

const styles = StyleSheet.create({
  drawerRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  appShellMotion: {
    flex: 1,
    zIndex: 2,
  },
  appShell: {
    flex: 1,
    overflow: 'hidden',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  notificationLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  closeTapTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
    elevation: 17,
  },
  // Keep the system bar covered when Android rounds the transformed app shell.
  systemNavigationBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
});

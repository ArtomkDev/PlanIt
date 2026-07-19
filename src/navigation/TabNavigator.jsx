import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CalendarDots, CheckSquare, GearSix } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import themes from '../config/themes';
import { useScheduleData, useScheduleLayout } from '../context/ScheduleProvider';
import { NotificationDrawerProvider } from '../context/NotificationDrawerContext';
import MorphingLoader from '../components/ui/MorphingLoader';
import PlanItTabBar from './PlanItTabBar';
import { t } from '../utils/i18n';
import Schedule from '../pages/Schedule/Schedule';
import Tasks from '../pages/Tasks/Tasks';
import Settings from '../pages/Settings/Settings';
import ThemeSettings from '../pages/Settings/components/preferences/ThemeSettings';
import LanguageSettings from '../pages/Settings/components/preferences/LanguageSettings';
import ResetDB from '../pages/Settings/components/ResetDB';
import AboutApp from '../pages/Settings/components/AboutApp';
import ScheduleSwitcher from '../pages/Settings/components/ScheduleSwitcher';
import DeviceManager from '../pages/Settings/components/managers/DeviceManagement';
import NotificationsScreen from '../pages/Settings/components/NotificationsScreen';
import ScheduleEditorScreen from '../pages/Settings/components/ScheduleEditorScreen';
import FileLibraryScreen from '../pages/Settings/components/FileLibraryScreen';
import AccountSettings from '../pages/Settings/components/AccountSettings/AccountSettings';
import DeleteAccountScreen from '../pages/Settings/components/AccountSettings/components/DeleteAccountScreen';
import ChangeNameScreen from '../pages/Settings/components/AccountSettings/components/ChangeNameScreen';
import ChangeEmailScreen from '../pages/Settings/components/AccountSettings/components/ChangeEmailScreen';
import ChangePasswordScreen from '../pages/Settings/components/AccountSettings/components/ChangePasswordScreen';
import SharedSchedulesManager from '../pages/Settings/components/SharedSchedulesManager';
import NavigationSettings from '../pages/Settings/components/preferences/NavigationSettings';
import NotificationInboxPanel from '../pages/Schedule/components/NotificationInboxPanel';
import { triggerHaptic } from '../utils/haptics';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const DRAWER_OPEN_DURATION = 285;
const DRAWER_CLOSE_DURATION = 240;
const DRAWER_VISUAL_OPEN_DURATION = 330;
const DRAWER_VISUAL_CLOSE_DURATION = 270;
const DRAWER_MOTION_EASING = Easing.bezier(0.2, 0, 0, 1);
const DRAWER_VISUAL_EASING = Easing.inOut(Easing.quad);

function SettingsStack({ screenProps }) {
  const { global } = useScheduleData();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <Stack.Navigator
        detachInactiveScreens={true}
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          cardStyle: { backgroundColor: themeColors.backgroundColor },
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        <Stack.Screen name="SettingsOverview">
          {props => <Settings {...props} {...screenProps} />}
        </Stack.Screen>
        
        <Stack.Screen name="ScheduleSwitcher" component={ScheduleSwitcher} />
        <Stack.Screen name="ScheduleEditorScreen" component={ScheduleEditorScreen} />
        <Stack.Screen name="Theme" component={ThemeSettings} />
        <Stack.Screen name="Navigation" component={NavigationSettings} />
        <Stack.Screen name="Language" component={LanguageSettings} />
        <Stack.Screen name="ResetDB" component={ResetDB} />
        <Stack.Screen name="AboutApp" component={AboutApp} />
        <Stack.Screen name="DeviceManagement" component={DeviceManager} />
        <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
        <Stack.Screen name="FileLibrary" component={FileLibraryScreen} />
        <Stack.Screen name="AccountSettings" component={AccountSettings} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="ChangeName" component={ChangeNameScreen} />
        <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="SharedSchedulesManager" component={SharedSchedulesManager} />
      </Stack.Navigator>
    </View>
  );
}

export default function TabNavigator({ screenProps }) {
  const { global, lang, isLoading } = useScheduleData();
  const { tabBarHeight, setTabBarHeight } = useScheduleLayout();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const drawerMotionProgress = useRef(new Animated.Value(0)).current;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsMounted, setNotificationsMounted] = useState(false);

  const drawerWidth = Math.min(
    430,
    Math.max(300, screenWidth * 0.82),
    Math.max(280, screenWidth - 86)
  );
  const drawerInset = screenWidth - drawerWidth;
  const appTranslateX = drawerMotionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -drawerWidth],
  });
  const appScale = drawerMotionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.975],
  });
  const appRadius = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });
  const drawerOpacity = drawerMotionProgress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0, 0.82, 1],
  });
  const drawerTranslateX = drawerMotionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });
  const inactiveOverlayOpacity = drawerMotionProgress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0.1, 0.16],
  });

  const animateNotifications = useCallback((open) => {
    triggerHaptic(open ? "open" : "sheetClose", { key: "notification-drawer" });
    if (open) {
      setNotificationsMounted(true);
    }

    setNotificationsOpen(open);
    drawerProgress.stopAnimation();
    drawerMotionProgress.stopAnimation();

    const toValue = open ? 1 : 0;
    const motionDuration = open ? DRAWER_OPEN_DURATION : DRAWER_CLOSE_DURATION;
    const visualDuration = open ? DRAWER_VISUAL_OPEN_DURATION : DRAWER_VISUAL_CLOSE_DURATION;

    Animated.parallel([
      Animated.timing(drawerMotionProgress, {
        toValue,
        duration: motionDuration,
        easing: DRAWER_MOTION_EASING,
        isInteraction: false,
        useNativeDriver: true,
      }),
      Animated.timing(drawerProgress, {
        toValue,
        duration: visualDuration,
        easing: DRAWER_VISUAL_EASING,
        isInteraction: false,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished && !open) {
        setNotificationsMounted(false);
      }
    });
  }, [drawerMotionProgress, drawerProgress]);

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
    drawerContentInset: drawerInset,
  }), [closeNotifications, drawerInset, drawerProgress, notificationsOpen, openNotifications]);

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
        drawerProgress.setValue(nextProgress);
        drawerMotionProgress.setValue(nextProgress);
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
    [animateNotifications, drawerMotionProgress, drawerProgress, drawerWidth, notificationsOpen]
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <MorphingLoader size={80} />
      </View>
    );
  }

  return (
    <NotificationDrawerProvider value={notificationDrawerValue}>
      <View
        style={[styles.drawerRoot, { backgroundColor: themeColors.backgroundColor }]}
        {...(notificationsMounted ? drawerPanResponder.panHandlers : {})}
      >
        {notificationsMounted && (
          <Animated.View
            pointerEvents={notificationsOpen ? 'auto' : 'none'}
            style={[
              styles.notificationUnderlay,
              {
                opacity: drawerOpacity,
                backgroundColor: themeColors.backgroundColor,
              },
            ]}
          >
            <Animated.View
              renderToHardwareTextureAndroid={notificationsMounted}
              shouldRasterizeIOS={notificationsMounted}
              style={[
                styles.notificationDrawer,
                {
                  left: 0,
                  right: 0,
                  transform: [{ translateX: drawerTranslateX }],
                },
              ]}
            >
              <NotificationInboxPanel />
            </Animated.View>
          </Animated.View>
        )}

        <Animated.View
          renderToHardwareTextureAndroid={notificationsMounted}
          shouldRasterizeIOS={notificationsMounted}
          style={[
            styles.appShellMotion,
            {
              shadowOpacity: notificationsMounted ? 0.18 : 0,
              elevation: notificationsMounted ? 16 : 0,
              transform: [
                { translateX: appTranslateX },
                { scale: appScale },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.appShell,
              {
                backgroundColor: themeColors.backgroundColor,
                borderRadius: appRadius,
              },
            ]}
          >
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
                headerShown: false,
              }}
            >
              <Tab.Screen
                name="ScheduleTab"
                component={Schedule}
                options={{
                  tabBarLabel: t('common.schedule', lang),
                  tabBarIcon: ({ color, size, focused }) => (
                    <CalendarDots size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                  ),
                }}
              />
              <Tab.Screen
                name="TasksTab"
                component={Tasks}
                options={{
                  tabBarLabel: t('common.tasks', lang),
                  tabBarIcon: ({ color, size, focused }) => (
                    <CheckSquare size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                  ),
                }}
              />
              <Tab.Screen
                name="SettingsTab"
                component={SettingsStackWrapper}
                options={{
                  tabBarLabel: t('common.settings', lang),
                  tabBarIcon: ({ color, size, focused }) => (
                    <GearSix size={size} color={color} weight={focused ? 'fill' : 'regular'} />
                  ),
                }}
              />
            </Tab.Navigator>

            {notificationsMounted && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.inactiveOverlay,
                  {
                    opacity: inactiveOverlayOpacity,
                    backgroundColor: themeColors.backgroundColor3 || '#000',
                  },
                ]}
              />
            )}
          </Animated.View>
        </Animated.View>

        {notificationsOpen && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeNotifications}
            style={[styles.closeTapTarget, { right: drawerWidth }]}
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
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 10, height: 0 },
  },
  appShell: {
    flex: 1,
    overflow: 'hidden',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  notificationUnderlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  notificationDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  closeTapTarget: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
});

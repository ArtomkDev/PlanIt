import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { CalendarDots, GearSix } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import themes from '../config/themes';
import { useSchedule } from '../context/ScheduleProvider';
import AppBlur from '../components/ui/AppBlur';
import AdBanner from '../components/AdBanner/AdBanner';
import MorphingLoader from '../components/ui/MorphingLoader';
import { t } from '../utils/i18n';

import Schedule from '../pages/Schedule/Schedule';
import Settings from '../pages/Settings/Settings';
import BreaksManager from '../pages/Settings/components/managers/BreaksManager';
import WeekManager from '../pages/Settings/components/managers/WeekManager';
import StartWeekManager from '../pages/Settings/components/managers/StartWeekManager';
import SubjectsManager from '../pages/Settings/components/managers/SubjectsManager';
import TeachersManager from '../pages/Settings/components/managers/TeachersManager';
import ScheduleManager from '../pages/Settings/components/ScheduleManager';
import ThemeSettings from '../pages/Settings/components/preferences/ThemeSettings';
import ResetDB from '../pages/Settings/components/ResetDB';
import ScheduleSwitcher from '../pages/Settings/components/ScheduleSwitcher';
import DeviceManager from '../pages/Settings/components/managers/DeviceManagement';
import ScheduleEditorScreen from '../pages/Settings/components/ScheduleEditorScreen';
import LanguageSettings from '../pages/Settings/components/preferences/LanguageSettings';
import AccountSettings from '../pages/Settings/components/AccountSettings/AccountSettings';
import DeleteAccountScreen from '../pages/Settings/components/AccountSettings/components/DeleteAccountScreen';
import ChangeNameScreen from '../pages/Settings/components/AccountSettings/components/ChangeNameScreen';
import ChangeEmailScreen from '../pages/Settings/components/AccountSettings/components/ChangeEmailScreen';
import ChangePasswordScreen from '../pages/Settings/components/AccountSettings/components/ChangePasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator(); 

function SettingsStack({ screenProps }) {
  const { global } = useSchedule();
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      <Stack.Navigator
        detachInactiveScreens={false}
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
        <Stack.Screen name="Breaks" component={BreaksManager} />
        <Stack.Screen name="Weeks" component={WeekManager} />
        <Stack.Screen name="StartWeek" component={StartWeekManager} />
        <Stack.Screen name="Subjects" component={SubjectsManager} />
        <Stack.Screen name="Teachers" component={TeachersManager} />
        <Stack.Screen name="Schedule" component={ScheduleManager} />
        <Stack.Screen name="ScheduleSwitcher" component={ScheduleSwitcher} />
        <Stack.Screen name="ScheduleEditorScreen" component={ScheduleEditorScreen} />
        <Stack.Screen name="Theme" component={ThemeSettings} />
        <Stack.Screen name="Language" component={LanguageSettings} />
        <Stack.Screen name="ResetDB" component={ResetDB} />
        <Stack.Screen name="DeviceManagement" component={DeviceManager} />
        <Stack.Screen name="AccountSettings" component={AccountSettings} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="ChangeName" component={ChangeNameScreen} />
        <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </Stack.Navigator>
    </View>
  );
}

export default function TabNavigator({ screenProps }) {
  const { global, lang, isLoading, tabBarHeight, setTabBarHeight } = useSchedule();
  const insets = useSafeAreaInsets();
  
  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const screenPropsRef = useRef(screenProps);
  useEffect(() => {
    screenPropsRef.current = screenProps;
  }, [screenProps]);

  const SettingsStackWrapper = useCallback((props) => (
    <SettingsStack {...props} screenProps={screenPropsRef.current} />
  ), []);

  const handleLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== tabBarHeight) {
      setTabBarHeight(height);
    }
  }, [tabBarHeight, setTabBarHeight]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <MorphingLoader size={80} />
      </View>
    );
  }

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View style={styles.customTabBarContainer} onLayout={handleLayout}>
          <AppBlur style={StyleSheet.absoluteFill} intensity={80} />
          <View style={styles.adWrapper}>
            <AdBanner />
          </View>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        sceneContainerStyle: { 
          backgroundColor: themeColors.backgroundColor,
          paddingBottom: tabBarHeight || (110 + insets.bottom)
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 0,
          height: 50 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' },
        tabBarActiveTintColor: themeColors.accentColor,
        tabBarInactiveTintColor: themeColors.textColor2,
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
  );
}

const styles = StyleSheet.create({
  customTabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  adWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    width: '100%',
  }
});
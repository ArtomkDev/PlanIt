import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import themes from '../config/themes';
import { useSchedule } from '../context/ScheduleProvider';
import AppBlur from '../components/AppBlur';
import AdBanner from '../components/AdBanner';
import MorphingLoader from '../components/MorphingLoader';
import { t } from '../utils/i18n';

import Schedule from '../pages/Schedule/Schedule';
import ScheduleSettings from '../pages/ScheduleSettings/ScheduleSettings';
import BreaksManager from '../pages/ScheduleSettings/components/BreaksManager';
import WeekManager from '../pages/ScheduleSettings/components/WeekManager';
import StartWeekManager from '../pages/ScheduleSettings/components/StartWeekManager';
import SubjectsManager from '../pages/ScheduleSettings/components/SubjectsManager';
import TeachersManager from '../pages/ScheduleSettings/components/TeachersManager';
import ScheduleManager from '../pages/ScheduleSettings/components/ScheduleManager';
import AutoSaveManager from '../pages/ScheduleSettings/components/AutoSaveIntervalSettings';
import ThemeSettings from '../pages/ScheduleSettings/components/ThemeSettings';
import ResetDB from '../pages/ScheduleSettings/components/ResetDB';
import ScheduleSwitcher from '../pages/ScheduleSettings/components/ScheduleSwitcher';
import DeviceManager from '../pages/ScheduleSettings/components/DeviceManager';
import ScheduleEditorScreen from '../pages/ScheduleSettings/components/ScheduleEditorScreen';
import LanguageSettings from '../pages/ScheduleSettings/components/LanguageSettings';
import AccountSettings from '../pages/ScheduleSettings/components/AccountSettings';
import DeleteAccountScreen from '../pages/ScheduleSettings/components/AccountSettings/DeleteAccountScreen';
import ChangeNameScreen from '../pages/ScheduleSettings/components/AccountSettings/ChangeNameScreen';
import ChangeEmailScreen from '../pages/ScheduleSettings/components/AccountSettings/ChangeEmailScreen';
import ChangePasswordScreen from '../pages/ScheduleSettings/components/AccountSettings/ChangePasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator(); 

function ScheduleSettingsStack({ screenProps }) {
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
        <Stack.Screen name="ScheduleSettingsMain">
          {props => <ScheduleSettings {...props} {...screenProps} />}
        </Stack.Screen>
        <Stack.Screen name="Breaks" component={BreaksManager} />
        <Stack.Screen name="Weeks" component={WeekManager} />
        <Stack.Screen name="StartWeek" component={StartWeekManager} />
        <Stack.Screen name="Subjects" component={SubjectsManager} />
        <Stack.Screen name="Teachers" component={TeachersManager} />
        <Stack.Screen name="Schedule" component={ScheduleManager} />
        <Stack.Screen name="ScheduleSwitcher" component={ScheduleSwitcher} />
        <Stack.Screen name="ScheduleEditorScreen" component={ScheduleEditorScreen} />
        <Stack.Screen name="AutoSave" component={AutoSaveManager} />
        <Stack.Screen name="Theme" component={ThemeSettings} />
        <Stack.Screen name="Language" component={LanguageSettings} />
        <Stack.Screen name="ResetDB" component={ResetDB} />
        <Stack.Screen name="DeviceService" component={DeviceManager} />
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
    <ScheduleSettingsStack {...props} screenProps={screenPropsRef.current} />
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
        name="Home3_1"
        component={Schedule}
        options={{
          tabBarLabel: t('common.schedule', lang),
          tabBarIcon: ({ color, size }) => <Icon name="calendar" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Home3_2"
        component={SettingsStackWrapper}
        options={{
          tabBarLabel: t('common.settings', lang),
          tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} />,
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
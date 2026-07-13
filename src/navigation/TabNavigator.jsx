import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useCallback, useRef, useEffect } from 'react';
import { View } from 'react-native';
import { CalendarDots, GearSix } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import themes from '../config/themes';
import { useScheduleData, useScheduleLayout } from '../context/ScheduleProvider';
import MorphingLoader from '../components/ui/MorphingLoader';
import PlanItTabBar from './PlanItTabBar';
import { t } from '../utils/i18n';
import Schedule from '../pages/Schedule/Schedule';
import Settings from '../pages/Settings/Settings';
import ThemeSettings from '../pages/Settings/components/preferences/ThemeSettings';
import LanguageSettings from '../pages/Settings/components/preferences/LanguageSettings';
import ResetDB from '../pages/Settings/components/ResetDB';
import AboutApp from '../pages/Settings/components/AboutApp';
import ScheduleSwitcher from '../pages/Settings/components/ScheduleSwitcher';
import DeviceManager from '../pages/Settings/components/managers/DeviceManagement';
import ScheduleEditorScreen from '../pages/Settings/components/ScheduleEditorScreen';
import AccountSettings from '../pages/Settings/components/AccountSettings/AccountSettings';
import DeleteAccountScreen from '../pages/Settings/components/AccountSettings/components/DeleteAccountScreen';
import ChangeNameScreen from '../pages/Settings/components/AccountSettings/components/ChangeNameScreen';
import ChangeEmailScreen from '../pages/Settings/components/AccountSettings/components/ChangeEmailScreen';
import ChangePasswordScreen from '../pages/Settings/components/AccountSettings/components/ChangePasswordScreen';
import SharedSchedulesManager from '../pages/Settings/components/SharedSchedulesManager';
import NavigationSettings from '../pages/Settings/components/preferences/NavigationSettings';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

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

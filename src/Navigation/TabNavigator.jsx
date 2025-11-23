import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';

import themes from '../config/themes';
import { useSchedule } from '../context/ScheduleProvider';
import AppBlur from '../components/AppBlur';

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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ScheduleSettingsStack({ screenProps }) {
  const { global } = useSchedule();
  const [themeMode] = global?.theme || ['light', 'blue'];
  
  const headerTextColor = themeMode === 'light' ? '#000' : '#fff';

  return (
    <Stack.Navigator
      screenOptions={{
        headerTransparent: true,
        // 🔥 ПРИБРАЛИ headerBackground - тепер ми керуємо ним в SettingsScreenLayout
        headerTintColor: headerTextColor,
        headerTitleStyle: {
          color: headerTextColor,
          fontSize: 18,
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ScheduleSettingsMain"
        options={{ title: 'Налаштування розкладу' }}
      >
        {props => <ScheduleSettings {...props} {...screenProps} />}
      </Stack.Screen>
      <Stack.Screen name="Breaks" component={BreaksManager} />
      <Stack.Screen name="Weeks" component={WeekManager} />
      <Stack.Screen name="StartWeek" component={StartWeekManager} />
      <Stack.Screen name="Subjects" component={SubjectsManager} />
      <Stack.Screen name="Teachers" component={TeachersManager} />
      <Stack.Screen name="Schedule" component={ScheduleManager} />
      <Stack.Screen name="ScheduleSwitcher" component={ScheduleSwitcher} />
      <Stack.Screen name="AutoSave" component={AutoSaveManager} />
      <Stack.Screen name="Theme" component={ThemeSettings} />
      <Stack.Screen name="ResetDB" component={ResetDB} />
      <Stack.Screen name="DeviceService" component={DeviceManager} />
    </Stack.Navigator>
  );
}

export default function TabNavigator({ screenProps }) {
  const { global } = useSchedule();

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          height: 70,
          paddingBottom: 10,
          paddingTop: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 0,
        },
        tabBarBackground: () => <AppBlur style={{ flex: 1, overflow: 'hidden' }} />,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: themeColors.accentColor,
        tabBarInactiveTintColor: themeColors.textColor2,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home3_1"
        component={Schedule}
        options={{
          tabBarLabel: 'Розклад',
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Home3_2"
        options={{
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          ),
        }}
      >
        {() => <ScheduleSettingsStack screenProps={screenProps} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
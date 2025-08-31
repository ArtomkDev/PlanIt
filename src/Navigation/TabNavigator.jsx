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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ScheduleSettingsStack() {
  const { global, schedule } = useSchedule();
  const [themeMode] = global?.theme || ['light', 'blue'];

  return (
    <Stack.Navigator
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => <AppBlur style={{ flex: 1 }} />,
        headerTitleStyle: {
          color: themeMode === 'dark' ? '#fff' : '#000',
          fontSize: 18,
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ScheduleSettingsMain"
        component={ScheduleSettings}
        options={{ title: 'Налаштування розкладу' }}
      />
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
    </Stack.Navigator>
  );
}

export default function TabNavigator() {
  const { global ,schedule } = useSchedule();

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
          backgroundColor: 'transparent', // ✅ blur робить фон
          elevation: 0, // ✅ без тіней на Android
          shadowOpacity: 0, // ✅ без тіней на iOS
          borderTopWidth: 0,  // ✅ прибирає верхню лінію
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
        component={ScheduleSettingsStack}
        options={{
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// src/navigation/TabNavigator.jsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { BlurView } from 'expo-blur';

import themes from '../config/themes';
import { useSchedule } from '../context/ScheduleProvider';

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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


function ScheduleSettingsStack() {
  const { schedule } = useSchedule();                  // ✅ беремо тему з контексту
  const [themeMode] = schedule?.theme || ['light', 'blue'];

  return (
    <Stack.Navigator
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => (
          <BlurView
            tint={themeMode === 'dark' ? 'dark' : 'light'} // ✅ міняється залежно від теми
            intensity={90}
            style={{ flex: 1 }}
          />
        ),
        headerTitleStyle: {
          color: themeMode === 'dark' ? '#fff' : '#000', // ✅ текст теж адаптується
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
      <Stack.Screen name="AutoSave" component={AutoSaveManager} />
      <Stack.Screen name="Theme" component={ThemeSettings} />
      <Stack.Screen name="ResetDB" component={ResetDB} />
    </Stack.Navigator>
  );
}



export default function TabNavigator() {
  const { schedule } = useSchedule(); // ✅ беремо повний schedule
  const [themeMode, accentName] = schedule?.theme || ['light', 'blue'];

  const themeColors = themes[themeMode] || themes.light;
  const accent = themes.accentColors[accentName] || themes.accentColors.blue;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          position: 'absolute',
          height: 70,
          paddingBottom: 10,
          paddingTop: 0,
          borderWidth: 0,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <BlurView
            tint={themeMode === 'dark' ? 'dark' : 'light'} // ✅ як у BreaksManager
            intensity={90}
            style={{ flex: 1, overflow: 'hidden' }} // ✅ важливо для того самого ефекту
          />
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          color: themeColors.textColor2,
        },
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: themeColors.textColor2,
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
          headerShown: false,
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
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}
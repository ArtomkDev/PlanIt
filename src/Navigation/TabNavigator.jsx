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

// Стек для налаштувань розкладу
function ScheduleSettingsStack() {
  return (
    <Stack.Navigator>
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
  const { theme } = useSchedule(); // витягаємо з контексту
  const [currentTheme, accentColor] = theme || ['light', 'blue'];

  const themeColors = themes[currentTheme] || themes.light;
  const accent = themes.accentColors[accentColor] || themes.accentColors.blue;

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
            tint={currentTheme === 'dark' ? 'dark' : 'light'}
            intensity={100}
            style={{ flex: 1 }}
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

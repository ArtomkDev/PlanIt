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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // 🔥 Вимикаємо нативний хедер повністю
        animation: 'slide_from_right', // Плавна анімація слайду
        gestureEnabled: true, // Жест "назад" працює
      }}
    >
      <Stack.Screen name="ScheduleSettingsMain">
        {props => <ScheduleSettings {...props} {...screenProps} />}
      </Stack.Screen>
      
      {/* Передаємо title як initialParams або просто хардкодимо в компонентах, 
          але для зручності можна передати title в options, хоча Nav його не покаже, ми використаємо його в компоненті */}
      <Stack.Screen name="Breaks" component={BreaksManager} options={{ title: 'Перерви' }} />
      <Stack.Screen name="Weeks" component={WeekManager} options={{ title: 'Тижні' }} />
      <Stack.Screen name="StartWeek" component={StartWeekManager} options={{ title: 'Початок семестру' }} />
      <Stack.Screen name="Subjects" component={SubjectsManager} options={{ title: 'Предмети' }} />
      <Stack.Screen name="Teachers" component={TeachersManager} options={{ title: 'Викладачі' }} />
      <Stack.Screen name="Schedule" component={ScheduleManager} options={{ title: 'Редактор розкладу' }} />
      <Stack.Screen name="ScheduleSwitcher" component={ScheduleSwitcher} options={{ title: 'Мої розклади' }} />
      <Stack.Screen name="AutoSave" component={AutoSaveManager} options={{ title: 'Автозбереження' }} />
      <Stack.Screen name="Theme" component={ThemeSettings} options={{ title: 'Тема' }} />
      <Stack.Screen name="ResetDB" component={ResetDB} options={{ title: 'Скидання' }} />
      <Stack.Screen name="DeviceService" component={DeviceManager} options={{ title: 'Пристрої' }} />
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
          tabBarLabel: 'Розклад',
          tabBarIcon: ({ color, size }) => <Icon name="calendar" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Home3_2"
        options={{
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} />,
        }}
      >
        {() => <ScheduleSettingsStack screenProps={screenProps} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
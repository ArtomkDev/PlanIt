import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import themes from '../config/themes';
import Schedule from '../pages/Schedule/Schedule';
import ScheduleSettings from '../pages/ScheduleSettings/ScheduleSettings';
import BreaksManager from '../pages/ScheduleSettings/components/BreaksManager';
import WeekManager from '../pages/ScheduleSettings/components/WeekManager'
import StartWeekManager from '../pages/ScheduleSettings/components/StartWeekManager'
import SubjectsManager from '../pages/ScheduleSettings/components/SubjectsManager'
import TeachersManager from '../pages/ScheduleSettings/components/TeachersManager'
import ScheduleManager from '../pages/ScheduleSettings/components/ScheduleManager'
import ResetDB from '../pages/ScheduleSettings/components/ResetDB';
import Settings from '../pages/Settings/Settings';
import { BlurView } from 'expo-blur';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Стек для налаштувань розкладу
function ScheduleSettingsStack({ commonProps }) {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ScheduleSettingsMain"
        options={{ title: 'Налаштування розкладу' }}
      >
        {(props) => <ScheduleSettings {...props} {...commonProps} />}
      </Stack.Screen>
      
      <Stack.Screen name="Breaks" component={BreaksManager} />

      <Stack.Screen name="Weeks" component={WeekManager} />

      <Stack.Screen name="StartWeek" component={StartWeekManager} />

      <Stack.Screen name="Subjects" component={SubjectsManager} />

      <Stack.Screen name="Teachers" component={TeachersManager} />

      <Stack.Screen name="Schedule" component={ScheduleManager} />

      <Stack.Screen name="ResetDB" component={ResetDB} />
    </Stack.Navigator>
  );
}

export default function TabNavigator({ commonProps }) {
  const [currentTheme, accentColor] = commonProps.theme || ['light', 'blue'];
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
        options={{
          tabBarLabel: 'Розклад',
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size} color={color} />
          ),
          headerShown: false,
        }}
      >
        {(props) => <Schedule {...props} {...commonProps} />}
      </Tab.Screen>

      <Tab.Screen
        name="Home3_2"
        options={{
          tabBarLabel: 'Налаштування',
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" size={size} color={color} />
          ),
          headerShown: false,
        }}
      >
        {(props) => <ScheduleSettingsStack commonProps={{ ...props, ...commonProps }} />}
      </Tab.Screen>

      <Tab.Screen
        name="AccountSettings"
        options={{
          tabBarLabel: 'Акаунт',
          tabBarIcon: ({ color, size }) => (
            <Icon name="person" size={size} color={color} />
          ),
          headerShown: false,
        }}
      >
        {(props) => <Settings {...props} {...commonProps} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import React from 'react'
import Icon from 'react-native-vector-icons/Ionicons'
import themes from '../config/themes'
import Schedule from '../pages/Schedule/Schedule'
import ScheduleSettings from '../pages/ScheduleSettings/ScheduleSettings'
import Settings from '../pages/Settings/Settings'
import { BlurView } from 'expo-blur'


const Tab = createBottomTabNavigator()

export default function TabNavigator({ commonProps }) {
	const [currentTheme, accentColor] = commonProps.theme || ['light', 'blue']
	const themeColors = themes[currentTheme] || themes.light
	const accent = themes.accentColors[accentColor] || themes.accentColors.blue

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
			    backgroundColor: 'transparent', // важливо — фон прозорий
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
				name='Home3_1'
				options={{
					tabBarLabel: 'Розклад', // Текст під вкладкою
					tabBarIcon: ({ color, size }) => (
						<Icon name='calendar' size={size} color={color} /> // Іконка
					),
					headerShown: false,
				}}
			>
				{() => <Schedule {...commonProps} />}
			</Tab.Screen>
			<Tab.Screen
				name='Home3_2'
				options={{
					tabBarLabel: 'Налаштування', // Текст під вкладкою
					tabBarIcon: ({ color, size }) => (
						<Icon name='settings' size={size} color={color} /> // Іконка
					),
					headerShown: false,
				}}
			>
				{() => <ScheduleSettings {...commonProps} />}
			</Tab.Screen>

			<Tab.Screen
				name='AccountSettings'
				options={{
					tabBarLabel: 'Акаунт',
					tabBarIcon: ({ color, size }) => (
						<Icon name='person' size={size} color={color} />
					),
					headerShown: false,
				}}
			>
				{() => <Settings {...commonProps} />}
			</Tab.Screen>
		</Tab.Navigator>
	)
}

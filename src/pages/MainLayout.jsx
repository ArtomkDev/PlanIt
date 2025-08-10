import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import React, { useEffect, useRef, useState } from 'react'
import { Button, StyleSheet, View } from 'react-native'
import { auth } from '../../firebase'
import { getSchedule, saveSchedule } from '../../firestore'
import AutoSaveManager from '../components/AutoSaveManager'
import TabNavigator from '../Navigation/TabNavigator'
import themes from '../config/themes';

const Tab = createBottomTabNavigator()

export default function MainLayout() {
	const [schedule, setSchedule] = useState(null) // Дані розкладу
	const [authUser, setAuthUser] = useState(null) // Авторизований користувач
	const [autoSaveInterval, setAutoSaveInterval] = useState(30) // Інтервал автозбереження
	const [isUnsavedChanges, setIsUnsavedChanges] = useState(false) // Чи є незбережені зміни
	const [lessonTimes, setLessonTimes] = useState([]) // Масив часу пар
	const [startingWeek, setStartingWeek] = useState(1) // Початковий тиждень
	const timerRef = useRef(null)

	const [theme, setTheme] = useState(['light', 'blue']) // ['currentTheme', 'accentColor']

	const [currentTheme, accentColor] = theme
	const themeColors = themes[currentTheme] || themes.light
	const accent = themes.accentColors[accentColor] || themes.accentColors.blue

	// Завантаження користувача та даних
	useEffect(() => {
		const user = auth.currentUser
		if (user) {
			setAuthUser(user) // Зберігаємо користувача
			loadSchedule(user.uid) // Завантажуємо розклад для користувача
		}
	}, [])

	useEffect(() => {
		if (schedule?.start_time && schedule?.duration && schedule?.breaks) {
			calculateLessonTimes(
				schedule.start_time,
				schedule.duration,
				schedule.breaks
			)
		}
	}, [schedule?.start_time, schedule?.duration, schedule?.breaks])

	// Завантаження розкладу з Firebase
	const loadSchedule = async userId => {
		try {
			const schedule = await getSchedule(userId)

			// Встановлення станів на основі отриманих даних
			setSchedule(schedule)
			setStartingWeek(schedule.starting_week)
			setAutoSaveInterval(schedule.auto_save)

			// Встановлення теми, якщо вона існує в розкладі
			if (schedule.theme) {
				setTheme(schedule.theme)
			}
			console.log(schedule)
		} catch (error) {
			console.error('Помилка завантаження розкладу:', error)
		}
	}

	const updateStartingWeek = week => {
		const formattedDate = new Date(
			week.getFullYear(),
			week.getMonth(),
			week.getDate()
		)
			.toISOString()
			.split('T')[0] // Формат YYYY-MM-DD
		const updatedSchedule = { ...schedule, starting_week: formattedDate }
		setSchedule(updatedSchedule)
		setStartingWeek(formattedDate)
		setIsUnsavedChanges(true)
	}

	// Обчислення часу пар
	const calculateLessonTimes = (startTime, duration, breaks) => {
		try {
			const [hours, minutes] = startTime.split(':').map(Number)
			if (isNaN(hours) || isNaN(minutes)) {
				throw new Error(`Некоректний формат start_time: ${startTime}`)
			}

			const start = new Date()
			start.setHours(hours, minutes, 0)

			const times = []
			let currentTime = new Date(start)

			breaks.forEach((breakDuration, index) => {
				const endOfLesson = new Date(
					currentTime.getTime() + duration * 60 * 1000
				)
				times.push({
					start: currentTime.toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit',
					}),
					end: endOfLesson.toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit',
					}),
				})
				currentTime = new Date(
					endOfLesson.getTime() + breakDuration * 60 * 1000
				)
			})

			setLessonTimes(times)
		} catch (error) {
			console.error('Помилка обчислення часу пар:', error.message)
		}
	}

	// Збереження розкладу
	const handleSaveChanges = async () => {
		if (authUser && schedule) {
			try {
				await saveSchedule(authUser.uid, schedule)
				console.log('Збереження виконано')
				setIsUnsavedChanges(false)
			} catch (error) {
				console.error('Помилка збереження:', error)
			}
		}
	}

	// Оновлення інтервалу автозбереження
	const handleAutoSaveIntervalChange = interval => {
		setAutoSaveInterval(interval)
		setSchedule(prevSchedule => ({ ...prevSchedule, auto_save: interval }))
		setIsUnsavedChanges(true)
	}

	const handleDataChange = updatedSchedule => {
		setSchedule(updatedSchedule)
		setIsUnsavedChanges(true)
	}

	const handleThemeChange = newTheme => {
		setTheme(newTheme)
		setSchedule(prevSchedule => ({ ...prevSchedule, theme: newTheme }))
		setIsUnsavedChanges(true)
	}

	const commonProps = {
		schedule,
		authUser,
		autoSaveInterval,
		isUnsavedChanges,
		setSchedule,
		handleSaveChanges,
		onDataChange: handleDataChange,
		lessonTimes,
		updateStartingWeek,
		startingWeek,
		handleAutoSaveIntervalChange,
		onThemeChange: handleThemeChange,
		theme: theme,
		themeColors: themeColors,
		accent: accent,
	}

	return (
		<View style={[{ flex: 1, paddingTop: 40, backgroundColor: themeColors.backgroundColor}]}>
			<View style={styles.container}>
				{/* Кнопка "Зберегти зараз" */}
				{isUnsavedChanges && (
					<Button title='Зберегти зараз' onPress={handleSaveChanges} />
				)}

				{/* Панель вкладок */}
				<TabNavigator commonProps={commonProps} />
			</View>
			<AutoSaveManager
				authUser={authUser}
				schedule={schedule}
				handleSaveChanges={handleSaveChanges}
				onAutoSaveComplete={() => setIsUnsavedChanges(false)}
				isUnsavedChanges={isUnsavedChanges}
				autoSaveInterval={autoSaveInterval}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 10,
	},
	input: {
		flex: 1,
		padding: 10,
		marginRight: 10,
	},
})

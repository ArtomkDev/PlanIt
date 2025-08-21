import React, { useState } from 'react'
import {
	Dimensions,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import DaySchedule from './components/DaySchedule'
import Header from './components/Header'
import NavigationButtons from './components/NavigationButtons'
import { DayScheduleProvider } from '../../context/DayScheduleProvider'

const screenWidth = Dimensions.get('window').width

export default function Schedule({
	schedule,
	lessonTimes,
	theme,
	themeColors,
	accent,
	onThemeChange,
}) {
	const [currentDate, setCurrentDate] = useState(new Date())

	const daysOfWeek = [
		'Понеділок',
		'Вівторок',
		'Середа',
		'Четвер',
		'П’ятниця',
		'Субота',
		'Неділя',
	]

	const subjects = schedule?.subjects || []
	const repeatWeeks = schedule?.repeat || 1
	const mondayFirstWeek = schedule?.starting_week
		? new Date(schedule.starting_week)
		: null

	const getDayIndex = date => (date.getDay() === 0 ? 6 : date.getDay() - 1)

	const calculateCurrentWeek = date => {
		if (!mondayFirstWeek) return 1
		const diffDays = Math.floor(
			(date - mondayFirstWeek) / (1000 * 60 * 60 * 24)
		)
		return (
			(((Math.floor(diffDays / 7) % repeatWeeks) + repeatWeeks) % repeatWeeks) +
			1
		)
	}

	const getDaySchedule = date => {
		const dayIndex = getDayIndex(date)
		if (!schedule?.schedule) return []
		const currentWeek = calculateCurrentWeek(date)
		return schedule.schedule[dayIndex]?.[`week${currentWeek}`] || []
	}

	const changeDate = direction => {
		const newDate = new Date(currentDate)
		newDate.setDate(currentDate.getDate() + direction)
		setCurrentDate(newDate)
	}

	const isToday = currentDate.toDateString() === new Date().toDateString()

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: themeColors.backgroundColor },
			]}
		>
			<Header
				daysOfWeek={daysOfWeek}
				currentDate={currentDate}
				getDayIndex={getDayIndex}
			/>
			<NavigationButtons changeDate={changeDate} />
			<DayScheduleProvider date={currentDate}>
  				<DaySchedule />
			</DayScheduleProvider>

			{!isToday && (
				<TouchableOpacity
					style={[styles.todayButton, { backgroundColor: accent }]}
					onPress={() => setCurrentDate(new Date())}
				>
					<Text style={styles.todayButtonText}>На сьогодні</Text>
				</TouchableOpacity>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 20 },
	todayButton: {
		position: 'absolute',
		bottom: 75,
		left: 20,
		right: 20,
		padding: 15,
		borderRadius: 5,
		alignItems: 'center',
	},
	todayButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
})

import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useState } from 'react'
import {
	Button,
	FlatList,
	Platform,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import BreaksManager from './components/BreaksManager'
import ResetDB from './components/ResetDB'
import ScheduleManager from './components/ScheduleManager'
import SubjectsManager from './components/SubjectsManager'

import TeachersManager from './components/TeachersManager'

import WeekManager from './components/WeekManager';


// Для веб-версії
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function ScheduleSettings({
	schedule,
	authUser,
	autoSaveInterval,               
	refreshing,
	onRefresh,
	onDataChange,
	setSchedule,
	themeColors,
	accent,
}) {
	const [showPicker, setShowPicker] = useState(false) // Контролює видимість календаря
	const [selectedDate, setSelectedDate] = useState(new Date()) // Обрана дата
	const [tempAutoSaveInterval, setTempAutoSaveInterval] =
		useState(autoSaveInterval) // Тимчасове значення інтервалу

	// Ініціалізація дати з Firebase
	useEffect(() => {
		if (schedule?.starting_week) {
			setSelectedDate(new Date(schedule.starting_week))
		}
	}, [schedule])

	// Функція для обчислення понеділка поточного тижня
	const getMondayOfWeek = date => {
		const copiedDate = new Date(
			Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
		) // Переконання, що час очищений
		const day = copiedDate.getUTCDay() // Отримуємо день тижня (0 - неділя, 1 - понеділок, ...)
		const diff = day === 0 ? -6 : 1 - day // Якщо неділя (0), зміщення -6
		copiedDate.setUTCDate(copiedDate.getUTCDate() + diff) // Зсув до понеділка
		return copiedDate // Повертаємо понеділок
	}

	// Обробка вибору дати
	const handleDateSelection = date => {
		if (!date) return
		const cleanDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate()
		) // Очистка часу
		const monday = getMondayOfWeek(cleanDate)
		console.log('Обрана дата:', cleanDate)
		console.log('Понеділок тижня:', monday)

		setSelectedDate(cleanDate)
		setShowPicker(false) // Закриваємо календар

		// Оновлюємо початковий тиждень у розкладі
		onDataChange({
			...schedule,
			starting_week: monday.toISOString().split('T')[0], // ISO формат
		})
	}

	// Перевірка наявності даних
	if (!schedule || !authUser) {
		return (
			<View style={styles.loadingContainer}>
				<Text>Завантаження даних...</Text>
			</View>
		)
	}

	return (
		<FlatList
			data={[{}]}
			renderItem={() => (
				<View
					style={[
						styles.container,
						{ backgroundColor: themeColors.backgroundColor },
					]}
				>
					<Text style={[styles.title, { color: themeColors.textColor }]}>
						Розклад користувача: {authUser.email}
					</Text>

					<BreaksManager
						breaks={schedule.breaks}
						setBreaks={breaks => {
							const updatedSchedule = { ...schedule, breaks }
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule)
						}}
						themeColors={themeColors}
						accent={accent}
					/>

					<TeachersManager
						teachers={schedule.teachers}
						setTeachers={updatedTeachers => {
							const updatedSchedule = { ...schedule, teachers: updatedTeachers }
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						onAddTeacher={newTeacher => {
							const updatedTeachers = [
								...schedule.teachers,
								{ ...newTeacher, id: Date.now() },
							]
							const updatedSchedule = {
								...schedule,
								teachers: updatedTeachers,
							}
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						themeColors={themeColors}
						accent={accent}
					/>

					<SubjectsManager
						subjects={schedule.subjects}
						setSubjects={updatedSubjects => {
							const updatedSchedule = { ...schedule, subjects: updatedSubjects }
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						onAddSubject={newSubject => {
							const updatedSubjects = [
								...schedule.subjects,
								{ ...newSubject, id: Date.now() },
							]
							const updatedSchedule = {
								...schedule,
								subjects: updatedSubjects,
							}
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						teachers={schedule.teachers} // Передаємо список учителів у SubjectsManager
						themeColors={themeColors}
						accent={accent}
					/>
					<WeekManager
						schedule={schedule}
						setSchedule={updatedSchedule => {
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						subjects={schedule.subjects}
						themeColors={themeColors}
						accent={accent}
					/>

					<ScheduleManager
						schedule={schedule}
						setSchedule={updatedSchedule => {
							setSchedule(updatedSchedule)
							onDataChange(updatedSchedule) // Передаємо оновлений розклад
						}}
						subjects={schedule.subjects}
						themeColors={themeColors}
						accent={accent}
					/>

					{/* Кнопка для відкриття календаря */}
					<View style={styles.inputContainer}>
						<Button
							title={`Вибрати дату (${
								getMondayOfWeek(selectedDate).toISOString().split('T')[0]
							})`}
							onPress={() => setShowPicker(!showPicker)}
						/>

						{showPicker && (
							<View
								style={
									Platform.OS === 'web'
										? styles.webPicker
										: [
												styles.pickerContainer,
												{ backgroundColor: themeColors.backgroundColor2 },
										  ]
								}
							>
								{Platform.OS === 'web' ? (
									// React-datepicker для веба
									<DatePicker
										selected={selectedDate}
										onChange={date => handleDateSelection(date)}
										inline
									/>
								) : (
									<DateTimePicker
										value={selectedDate}
										mode='date'
										display='default'
										onChange={(event, date) => handleDateSelection(date)}
									/>
								)}
							</View>
						)}
					</View>

					<ResetDB />
				</View>
			)}
			keyExtractor={(_, index) => String(index)}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
		/>
	)
}

const styles = StyleSheet.create({
	container: {
		flexGrow: 1,
		backgroundColor: '#fff',
		padding: 10,
		paddingBottom: 70,
	},
	title: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 20,
	},
	inputContainer: {
		flexDirection: 'column',
		alignItems: 'center',
		marginBottom: 20,
	},
	input: {
		borderWidth: 1,
		borderColor: '#ccc',
		padding: 10,
		borderRadius: 5,
		width: '50%',
		textAlign: 'center',
	},
	pickerContainer: {
		marginTop: 10,
		backgroundColor: 'white',
		padding: 10,
		borderRadius: 10,
		elevation: 5,
	},
	webPicker: {
		marginTop: 10,
		width: '100%',
	},
	signOutContainer: {
		marginTop: 20,
		alignItems: 'center',
	},
	confirmButton: {
		backgroundColor: '#007bff',
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderRadius: 10,
		alignItems: 'center',
		marginTop: 10,
	},
	confirmButtonText: {
		color: '#fff',
		fontWeight: 'bold',
		fontSize: 16,
	},
	disabledButton: {
		backgroundColor: '#ccc',
	},
})

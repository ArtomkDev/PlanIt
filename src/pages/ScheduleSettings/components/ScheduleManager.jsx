import React, { useEffect, useState } from 'react'
import {
	FlatList,
	Modal,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useSchedule } from '../../../context/ScheduleProvider'
import themes from '../../../config/themes'
import SettingsScreenLayout from '../SettingsScreenLayout'
import { Ionicons } from '@expo/vector-icons'

export default function ScheduleManager() {
	const { schedule, setScheduleDraft } = useSchedule()

	const [initialized, setInitialized] = useState(false)
	const [showSubjectModal, setShowSubjectModal] = useState(false)
	const [selectedSubject, setSelectedSubject] = useState(null)

	const daysOfWeek = [
		'Понеділок',
		'Вівторок',
		'Середа',
		'Четвер',
		'П’ятниця',
		'Субота',
		'Неділя',
	]

	// тема
	const themeName = schedule?.theme?.[0] || 'light'
	const accentName = schedule?.theme?.[1] || 'blue'
	const themeColors = themes[themeName]
	const accent = themes.accentColors[accentName]

	const subjects = schedule?.subjects || []

	// ініціалізація пустих тижнів
	useEffect(() => {
		if (!initialized && schedule?.repeat) {
			const updatedSchedule = { ...schedule }
			let needsUpdate = false

			updatedSchedule.schedule = updatedSchedule.schedule.map(day => {
				const updatedDay = {}
				for (let i = 1; i <= 4; i++) {
					if (!day[`week${i}`]) {
						updatedDay[`week${i}`] = [0]
						needsUpdate = true
					} else {
						updatedDay[`week${i}`] = day[`week${i}`]
					}
				}
				return updatedDay
			})

			if (needsUpdate) setScheduleDraft(updatedSchedule)
			setInitialized(true)
		}
	}, [schedule, initialized])

	// зміна предмету
	const handleSubjectChange = (dayIndex, weekPart, subjectIndex, newSubjectId) => {
		const updatedSchedule = { ...schedule }
		updatedSchedule.schedule[dayIndex][weekPart][subjectIndex] = newSubjectId
		setScheduleDraft(updatedSchedule)
	}

	const openSubjectModal = (dayIndex, weekPart, subjectIndex) => {
		setSelectedSubject({ dayIndex, weekPart, subjectIndex })
		setShowSubjectModal(true)
	}

	const handleSelectSubject = subjectId => {
		if (selectedSubject) {
			const { dayIndex, weekPart, subjectIndex } = selectedSubject
			handleSubjectChange(dayIndex, weekPart, subjectIndex, subjectId)
		}
		setShowSubjectModal(false)
	}

	const handleAddDefaultSubject = (dayIndex, weekPart) => {
		const updatedSchedule = { ...schedule }
		if (!updatedSchedule.schedule[dayIndex][weekPart]) {
			updatedSchedule.schedule[dayIndex][weekPart] = []
		}
		updatedSchedule.schedule[dayIndex][weekPart].push(0)
		setScheduleDraft(updatedSchedule)
	}

	const handleRemoveSubject = (dayIndex, weekPart, subjectIndex) => {
		const updatedSchedule = { ...schedule }
		updatedSchedule.schedule[dayIndex][weekPart] =
			updatedSchedule.schedule[dayIndex][weekPart].filter(
				(_, index) => index !== subjectIndex
			)
		setScheduleDraft(updatedSchedule)
	}

	if (!schedule || !schedule.schedule) {
		return <Text>Loading schedule...</Text>
	}

	if (!Array.isArray(schedule.schedule)) {
		return <Text>Invalid schedule data</Text>
	}

	// свайп-кнопка справа
	const renderRightActions = (dayIndex, weekPart, subjectIndex) => (
		<TouchableOpacity
			style={styles.deleteAction}
			onPress={() => handleRemoveSubject(dayIndex, weekPart, subjectIndex)}
		>
			<Ionicons name="trash" size={24} color="#fff" />
		</TouchableOpacity>
	)

	return (
		<SettingsScreenLayout>
			<View
				style={[
					styles.container,
					{ backgroundColor: themeColors.backgroundColor },
				]}
			>
				{schedule.schedule.map((day, dayIndex) => (
					<View key={dayIndex} style={styles.dayContainer}>
						<Text style={[styles.dayTitle, { color: themeColors.textColor }]}>
							{daysOfWeek[dayIndex]}
						</Text>

						{Object.keys(day)
							.sort(
								(a, b) =>
									parseInt(a.replace('week', '')) -
									parseInt(b.replace('week', ''))
							)
							.slice(0, schedule.repeat)
							.map(weekPart => (
								<View key={weekPart} style={styles.weekPartContainer}>
									<Text
										style={[
											styles.weekPartTitle,
											{ color: themeColors.textColor },
										]}
									>
										{weekPart}
									</Text>

									{day[weekPart].map((subjectId, subjectIndex) => (
										<Swipeable
											key={subjectIndex}
											renderRightActions={() =>
												renderRightActions(dayIndex, weekPart, subjectIndex)
											}
										>
											<TouchableOpacity
												style={[
													styles.subjectButton,
													{ backgroundColor: 'rgba(0,0,0,0.05)' },
												]}
												onPress={() =>
													openSubjectModal(dayIndex, weekPart, subjectIndex)
												}
											>
												<Text
													style={[
														styles.subjectButtonText,
														{ color: themeColors.textColor },
													]}
												>
													{subjects.find(s => s.id === subjectId)?.name ||
														'Вибрати предмет'}
												</Text>
											</TouchableOpacity>
										</Swipeable>
									))}

									<TouchableOpacity
										style={[styles.addSubjectButton, { backgroundColor: accent }]}
										onPress={() => handleAddDefaultSubject(dayIndex, weekPart)}
									>
										<Ionicons name="add" size={20} color="#fff" />
										<Text style={styles.addSubjectButtonText}>Додати пару</Text>
									</TouchableOpacity>
								</View>
							))}
					</View>
				))}

				{/* модалка вибору предмету */}
				{showSubjectModal && (
					<Modal transparent={true} animationType="slide" visible={showSubjectModal}>
						<View style={styles.modalContainer}>
							<View
								style={[
									styles.modalContent,
									{ backgroundColor: themeColors.backgroundColor2 },
								]}
							>
								<Text
									style={[styles.modalTitle, { color: themeColors.textColor }]}
								>
									Виберіть предмет
								</Text>
								<FlatList
									data={subjects}
									keyExtractor={item => item.id.toString()}
									renderItem={({ item }) => (
										<TouchableOpacity
											style={styles.subjectOption}
											onPress={() => handleSelectSubject(item.id)}
										>
											<Text
												style={[
													styles.subjectOptionText,
													{ color: themeColors.textColor },
												]}
											>
												{item.name}
											</Text>
										</TouchableOpacity>
									)}
								/>
								<TouchableOpacity
									style={styles.closeModalButton}
									onPress={() => setShowSubjectModal(false)}
								>
									<Text style={styles.closeModalButtonText}>Закрити</Text>
								</TouchableOpacity>
							</View>
						</View>
					</Modal>
				)}
			</View>
		</SettingsScreenLayout>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
	dayContainer: {
		marginBottom: 24,
	},
	dayTitle: {
		fontSize: 20,
		fontWeight: '600',
		marginBottom: 12,
	},
	weekPartContainer: {
		marginBottom: 16,
		padding: 12,
		borderRadius: 12,
		backgroundColor: 'rgba(0,0,0,0.03)',
	},
	weekPartTitle: {
		fontSize: 16,
		fontWeight: '500',
		marginBottom: 8,
	},
	subjectButton: {
		paddingVertical: 14,
		paddingHorizontal: 16,
		borderRadius: 12,
		marginBottom: 10,
	},
	subjectButtonText: {
		fontSize: 16,
		fontWeight: '500',
	},
	addSubjectButton: {
		marginTop: 8,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		borderRadius: 12,
	},
	addSubjectButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
		marginLeft: 6,
	},
	// swipe action
	deleteAction: {
		backgroundColor: '#ef4444',
		justifyContent: 'center',
		alignItems: 'center',
		width: 70,
		marginBottom: 10,
		borderRadius: 12,
	},
	// модалка
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.3)',
	},
	modalContent: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 20,
		maxHeight: '60%',
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '600',
		marginBottom: 12,
	},
	subjectOption: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0,0,0,0.1)',
	},
	subjectOptionText: {
		fontSize: 16,
	},
	closeModalButton: {
		marginTop: 16,
		padding: 14,
		borderRadius: 12,
		backgroundColor: '#f3f4f6',
	},
	closeModalButtonText: {
		fontSize: 16,
		textAlign: 'center',
		fontWeight: '500',
	},
})

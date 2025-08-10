import React, { useState } from 'react'
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'
import themes from '../../../config/themes'

export default function SubjectsManager({
	subjects,
	setSubjects,
	onAddSubject,
	teachers,
	themeColors,
	accent,
}) {
	const [newSubject, setNewSubject] = useState({
		name: '',
		teacher: '',
		zoom_link: '',
		color: 'red',
	})

	const [isModalVisible, setIsModalVisible] = useState(false)
	const [isEditMode, setIsEditMode] = useState(false)
	const [editSubjectId, setEditSubjectId] = useState(null)
	const [selectedTeacher, setSelectedTeacher] = useState('')

	// Знаходимо ім'я вчителя за ID
	const getTeacherName = teacherId => {
		const teacher = teachers.find(t => t.id === teacherId)
		return teacher ? teacher.name : 'Unknown Teacher'
	}

	const handleColorSelect = color => {
		setNewSubject({ ...newSubject, color })
	}

	const handleAddSubject = () => {
		if (newSubject.teacher === '') {
			alert('Please select a teacher.')
			return
		}
		if (isEditMode) {
			// Редагування предмета
			setSubjects(
				subjects.map(subject =>
					subject.id === editSubjectId ? { ...subject, ...newSubject } : subject
				)
			)
			setIsEditMode(false)
			setEditSubjectId(null)
		} else {
			// Додавання нового предмета
			onAddSubject(newSubject)
		}
		setNewSubject({ name: '', teacher: '', zoom_link: '', color: 'red' })
	}

	const handleEditSubject = subject => {
		setNewSubject({
			name: subject.name,
			teacher: subject.teacher,
			zoom_link: subject.zoom_link,
		})
		setSelectedTeacher(getTeacherName(subject.teacher))
		setIsEditMode(true)
		setEditSubjectId(subject.id)
	}

	const handleRemoveSubject = id => {
		setSubjects(subjects.filter(subject => subject.id !== id))
	}

	// Відкриваємо/закриваємо модальне вікно для вибору вчителя
	const toggleModal = () => {
		setIsModalVisible(!isModalVisible)
	}

	// Оновлюємо ID вчителя, коли він вибраний
	const handleTeacherSelect = teacherId => {
		setNewSubject({ ...newSubject, teacher: teacherId })
		setSelectedTeacher(getTeacherName(teacherId)) // Встановлюємо ім'я вибраного вчителя
		toggleModal() // Закриваємо модальне вікно
	}

	return (
		<View style={styles.container}>
			<Text style={[styles.header, { color: themeColors.textColor }]}>
				Manage Subjects
			</Text>
			<TextInput
				style={[
					styles.input,
					{
						color: themeColors.textColor,
						backgroundColor: themeColors.backgroundColor2,
					},
				]}
				placeholder='Subject Name'
				value={newSubject.name}
				onChangeText={text => setNewSubject({ ...newSubject, name: text })}
			/>

			<TouchableOpacity
				style={[
					styles.input,
					{
						borderColor: themeColors.textColor2,
						backgroundColor: themeColors.backgroundColor2,
					},
				]}
				onPress={toggleModal}
			>
				<Text style={[styles.teacherText, { color: themeColors.textColor }]}>
					{selectedTeacher ? selectedTeacher : 'Select Teacher'}
				</Text>
			</TouchableOpacity>

			<TextInput
				style={[
					styles.input,
					{
						color: themeColors.textColor,
						backgroundColor: themeColors.backgroundColor2,
					},
				]}
				placeholder='Zoom Link'
				value={newSubject.zoom_link}
				onChangeText={text => setNewSubject({ ...newSubject, zoom_link: text })}
			/>

			<View style={styles.colorSelector}>
				{Object.entries(themes.accentColors).map(([colorName, colorValue]) => (
					<TouchableOpacity
						key={colorName}
						style={[
							styles.colorCircle,
							{
								backgroundColor: colorValue,
								borderWidth: newSubject.color === colorName ? 2 : 0,
							},
						]}
						onPress={() => handleColorSelect(colorName)}
					/>
				))}
			</View>

			<TouchableOpacity
				style={[styles.addButton, { backgroundColor: accent }]}
				onPress={handleAddSubject}
			>
				<Text style={[styles.addButtonText, { color: themeColors.textColor }]}>
					{isEditMode ? 'Save Changes' : 'Add Subject'}
				</Text>
			</TouchableOpacity>

			<Modal
				transparent={true}
				visible={isModalVisible}
				animationType='slide'
				onRequestClose={toggleModal}
			>
				<View style={styles.modalOverlay}>
					<View
						style={[
							styles.modalContent,
							{ backgroundColor: themeColors.backgroundColor2 },
						]}
					>
						<Text
							style={[styles.modalHeader, { color: themeColors.textColor }]}
						>
							Select Teacher
						</Text>
						<FlatList
							data={teachers}
							keyExtractor={item => item.id.toString()}
							renderItem={({ item }) => (
								<Pressable
									style={[
										styles.teacherItem,
										{ backgroundColor: themeColors.backgroundColor3 },
									]}
									onPress={() => handleTeacherSelect(item.id)}
								>
									<Text
										style={[
											styles.teacherText,
											{ color: themeColors.textColor },
										]}
									>
										{item.name}
									</Text>
								</Pressable>
							)}
						/>
						<TouchableOpacity
							style={[styles.closeModalButton, { backgroundColor: accent }]}
							onPress={toggleModal}
						>
							<Text
								style={[
									styles.closeModalButtonText,
									{ color: themeColors.textColor },
								]}
							>
								Close
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>

			<FlatList
				data={subjects}
				keyExtractor={item => item.id.toString()}
				renderItem={({ item }) => (
					<View
						style={[
							styles.subjectItem,
							{ backgroundColor: themeColors.backgroundColor2 },
						]}
					>
						<Text
							style={[styles.subjectText, { color: themeColors.textColor }]}
						>
							{item.name} - {getTeacherName(item.teacher)}
						</Text>
						<View style={styles.actionButtons}>
							<TouchableOpacity
								onPress={() => handleEditSubject(item)}
								style={[styles.editButton, { backgroundColor: accent }]}
							>
								<Text
									style={[
										styles.actionButtonText,
										{ color: themeColors.textColor },
									]}
								>
									Edit
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => handleRemoveSubject(item.id)}
								style={styles.removeButton}
							>
								<Text style={styles.actionButtonText}>Remove</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
	},
	header: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20,
	},
	input: {
		padding: 10,
		marginBottom: 15,
		borderRadius: 5,
	},
	teacherText: {
		fontSize: 16,
		color: '#333',
	},
	addButton: {
		backgroundColor: '#28A745',
		padding: 10,
		borderRadius: 5,
		alignItems: 'center',
		marginBottom: 15,
	},
	addButtonText: {
		color: '#FFF',
		fontSize: 16,
	},
	subjectItem: {
		marginBottom: 10,
		padding: 10,
		borderRadius: 5,
		backgroundColor: '#f9f9f9',
	},
	subjectText: {
		fontSize: 16,
		marginBottom: 5,
	},
	actionButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	editButton: {
		backgroundColor: '#007BFF',
		padding: 5,
		borderRadius: 5,
	},
	removeButton: {
		backgroundColor: '#FF6347',
		padding: 5,
		borderRadius: 5,
	},
	actionButtonText: {
		color: '#FFF',
		fontSize: 14,
	},
	modalOverlay: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		width: '80%',
		backgroundColor: '#fff',
		padding: 20,
		borderRadius: 10,
	},
	modalHeader: {
		fontSize: 18,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	teacherItem: {
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#ccc',
	},
	closeModalButton: {
		backgroundColor: '#FF6347',
		padding: 10,
		borderRadius: 5,
		marginTop: 15,
		alignItems: 'center',
	},
	closeModalButtonText: {
		color: '#fff',
	},
	colorSelector: {
		flexDirection: 'row',
		marginBottom: 15,
	},
	colorCircle: {
		width: 30,
		height: 30,
		borderRadius: 15,
		marginRight: 10,
		borderColor: '#000',
	},
})

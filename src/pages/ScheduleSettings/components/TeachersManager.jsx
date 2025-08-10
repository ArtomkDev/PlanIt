import React, { useState } from 'react'
import {
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'

export default function TeachersManager({
	teachers,
	setTeachers,
	onAddTeacher,
	themeColors,
	accent,
}) {
	const [newTeacher, setNewTeacher] = useState({ name: '', phone: '' })
	const [isEditMode, setIsEditMode] = useState(false)
	const [editTeacherId, setEditTeacherId] = useState(null)

	const handleAddTeacher = () => {
		if (isEditMode) {
			// Редагування викладача
			setTeachers(
				teachers.map(teacher =>
					teacher.id === editTeacherId ? { ...teacher, ...newTeacher } : teacher
				)
			)
			setIsEditMode(false)
			setEditTeacherId(null)
		} else {
			// Додавання нового викладача
			onAddTeacher(newTeacher)
		}
		setNewTeacher({ name: '', phone: '' })
	}

	const handleEditTeacher = teacher => {
		setNewTeacher({ name: teacher.name, phone: teacher.phone })
		setIsEditMode(true)
		setEditTeacherId(teacher.id)
	}

	const handleRemoveTeacher = id => {
		setTeachers(teachers.filter(teacher => teacher.id !== id))
	}

	return (
		<View style={styles.container}>
			<Text style={[styles.header, { color: themeColors.textColor }]}>
				Manage Teachers
			</Text>
			<TextInput
				style={[
					styles.input,
					{
						color: themeColors.textColor,
						backgroundColor: themeColors.backgroundColor2
					},
				]}
				placeholder='Teacher Name'
				value={newTeacher.name}
				onChangeText={text => setNewTeacher({ ...newTeacher, name: text })}
			/>
			<TextInput
				style={[
					styles.input,
					{
						color: themeColors.textColor,
						backgroundColor: themeColors.backgroundColor2
					},
				]}
				placeholder='Phone'
				value={newTeacher.phone}
				onChangeText={text => setNewTeacher({ ...newTeacher, phone: text })}
			/>
			<TouchableOpacity
				style={[
					styles.addButton,
					{
						backgroundColor: accent,
					},
				]}
				onPress={handleAddTeacher}
			>
				<Text style={[styles.addButtonText, { color: themeColors.textColor }]}>
					{isEditMode ? 'Save Changes' : 'Add Teacher'}
				</Text>
			</TouchableOpacity>

			<FlatList
				data={teachers}
				keyExtractor={item => item.id.toString()}
				renderItem={({ item }) => (
					<View
						style={[
							styles.teacherItem,
							{ backgroundColor: themeColors.backgroundColor2 },
						]}
					>
						<Text
							style={[styles.teacherText, { color: themeColors.textColor }]}
						>
							{item.name} - {item.phone}
						</Text>
						<View style={styles.actionButtons}>
							<TouchableOpacity
								style={[styles.editButton, { backgroundColor: accent }]}
								onPress={() => handleEditTeacher(item)}
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
								style={styles.removeButton}
								onPress={() => handleRemoveTeacher(item.id)}
							>
								<Text
									style={[
										styles.actionButtonText,
										{ color: themeColors.textColor },
									]}
								>
									Remove
								</Text>
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
	teacherItem: {
		marginBottom: 10,
		padding: 10,
		borderRadius: 5,
		backgroundColor: '#f9f9f9',
	},
	teacherText: {
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
		marginRight: 10,
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
})

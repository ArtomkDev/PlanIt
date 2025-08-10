import { doc, setDoc } from 'firebase/firestore'
import React from 'react'
import { Alert, Button, StyleSheet, View } from 'react-native'
import { auth, db } from '../../../../firebase' // Firebase auth і Firestore
import defaultSchedule from '../../../config/defaultSchedule'

export default function ResetDB() {
	const resetFirestore = async () => {
		const user = auth.currentUser
		if (!user) {
			Alert.alert('Помилка', 'Будь ласка, увійдіть у свій акаунт.')
			return
		}

		try {
			const scheduleRef = doc(db, 'schedules', user.uid)

			await setDoc(scheduleRef, { schedule: defaultSchedule })
			Alert.alert('Успіх', 'Дані успішно оновлено в Firestore!')
		} catch (error) {
			console.error('Помилка при оновленні Firestore:', error)
			Alert.alert('Помилка', 'Сталася помилка. Спробуйте ще раз.')
		}
	}

	return (
		<View style={styles.container}>
			<Button
				title='Оновити дані у Firestore'
				onPress={resetFirestore}
				color='red'
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
})

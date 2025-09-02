import { doc, setDoc } from 'firebase/firestore'
import React from 'react'
import { Alert, Button, StyleSheet, View } from 'react-native'
import { auth, db } from '../../../../firebase'
import createDefaultData from '../../../config/createDefaultData'
import SettingsScreenLayout from '../SettingsScreenLayout'
import SignOutButton from './SignOutButton'

export default function ResetDB() {
	const resetFirestore = async () => {
		const user = auth.currentUser
		if (!user) {
			Alert.alert('Помилка', 'Будь ласка, увійдіть у свій акаунт.')
			return
		}

		try {
			const scheduleRef = doc(db, 'schedules', user.uid)

			// Створюємо нові дані по новій структурі
			const newData = createDefaultData()

			// Записуємо у Firestore
			await setDoc(scheduleRef, { schedule: newData })

			Alert.alert('Успіх', 'Розклад скинуто на дефолтний!')
		} catch (error) {
			console.error('Помилка при оновленні Firestore:', error)
			Alert.alert('Помилка', 'Сталася помилка. Спробуйте ще раз.')
		}
	}

	return (
		<SettingsScreenLayout>
			<View style={styles.container}>
				<Button
					title='Скинути розклад'
					onPress={resetFirestore}
					color='red'
				/>
				<SignOutButton />
			</View>
		</SettingsScreenLayout>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
	},
})

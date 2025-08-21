import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../firebase';

const SignOutButton = () => {
	const handleSignOut = async () => {
		try {
			await signOut(auth);
			console.log('Вихід виконано успішно');
		} catch (error) {
			console.error('Помилка виходу:', error.message);
		}
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity style={styles.button} onPress={handleSignOut}>
				<Text style={styles.buttonText}>Вийти з акаунту</Text>
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginTop: 20,
		alignItems: 'center',
	},
	button: {
		backgroundColor: '#ff4d4f', // Червоний колір для кнопки
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		elevation: 3, // Тінь для Android
		shadowColor: '#000', // Тінь для iOS
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	buttonText: {
		color: '#fff', // Білий текст
		fontSize: 16,
		fontWeight: 'bold',
		textAlign: 'center',
	},
});

export default SignOutButton;

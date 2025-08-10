import { useNavigation } from '@react-navigation/native'
import { signInWithEmailAndPassword } from 'firebase/auth'
import React, { useState } from 'react'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { auth } from '../../firebase'

export default function SignIn() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const navigation = useNavigation()

	const logIn = () => {
		signInWithEmailAndPassword(auth, email, password)
			.then(() => {
				setError('')
				setEmail('')
				setPassword('')
			})
			.catch(() => {
				setError("SORRY, COULDN'T FIND YOUR ACCOUNT")
			})
	}

	return (
		<View style={styles.container}>
			<Text style={styles.header}>Log in</Text>
			<TextInput
				style={styles.input}
				placeholder='Please enter your email'
				value={email}
				onChangeText={setEmail}
				keyboardType='email-address'
			/>
			<TextInput
				style={styles.input}
				placeholder='Please enter your password'
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>
			<Button title='Login' onPress={logIn} />
			{error ? <Text style={styles.error}>{error}</Text> : null}

			{/* Кнопка для переходу до сторінки реєстрації */}
			<View style={styles.signupContainer}>
				<Button
					title='Sign Up'
					onPress={() => navigation.navigate('SignUp')} // Перехід на екран реєстрації
				/>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: 'center', padding: 16 },
	header: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
	input: {
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		marginBottom: 16,
		paddingLeft: 8,
	},
	error: { color: 'red', textAlign: 'center', marginBottom: 16 },
	signupContainer: { marginTop: 16, alignItems: 'center' }, // Додано стилі для контейнера кнопки
})

import { createUserWithEmailAndPassword } from 'firebase/auth'
import React, { useState } from 'react'
import { Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { auth } from '../../firebase'

export default function SignUp() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState('')

	const register = () => {
		if (password !== confirmPassword) {
			setError("Passwords didn't match")
			return
		}

		createUserWithEmailAndPassword(auth, email, password)
			.then(() => {
				setError('')
				setEmail('')
				setPassword('')
				setConfirmPassword('')
			})
			.catch(() => {
				setError('Error creating account')
			})
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Create an Account</Text>
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
			<TextInput
				style={styles.input}
				placeholder='Please re-enter your password'
				value={confirmPassword}
				onChangeText={setConfirmPassword}
				secureTextEntry
			/>
			<Button title='Create' onPress={register} />
			{error ? <Text style={styles.error}>{error}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: 'center', padding: 16 },
	title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
	input: {
		height: 40,
		borderColor: 'gray',
		borderWidth: 1,
		marginBottom: 16,
		paddingLeft: 8,
	},
	error: { color: 'red', textAlign: 'center' },
})

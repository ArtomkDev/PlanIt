import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { onAuthStateChanged } from 'firebase/auth'
import React, { useEffect, useState } from 'react'
import { auth } from './firebase'
import SignIn from './src/auth/SignIn'
import SignUp from './src/auth/SignUp'
import MainLayout from './src/pages/MainLayout'

const Stack = createStackNavigator()

export default function App() {
	const [user, setUser] = useState(null)

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, user => {
			setUser(user)
		})
		return unsubscribe
	}, [])

	return (
		<NavigationContainer>
			<Stack.Navigator>
				{user ? (
					<Stack.Screen
						name='MainLayout'
						component={MainLayout}
						options={{ headerShown: false }}
					/>
				) : (
					<>
						<Stack.Screen
							name='SignIn'
							component={SignIn}
							options={{ title: 'Sign In' }}
						/>
						<Stack.Screen
							name='SignUp'
							component={SignUp}
							options={{ title: 'Sign Up' }}
						/>
					</>
				)}
			</Stack.Navigator>
		</NavigationContainer>
	)
}

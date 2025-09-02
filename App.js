import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { onAuthStateChanged } from 'firebase/auth'
import React, { useEffect, useState } from 'react'
import { auth } from './firebase'
import SignIn from './src/auth/SignIn'
import SignUp from './src/auth/SignUp'
import WelcomeScreen from './src/auth/WelcomeScreen'
import MainLayout from './src/pages/MainLayout'
import { ScheduleProvider } from './src/context/ScheduleProvider'
import AsyncStorage from '@react-native-async-storage/async-storage'

const Stack = createStackNavigator()

export default function App() {
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkLocalSchedule = async () => {
      try {
        const local = await AsyncStorage.getItem('guest_schedule')
        if (local) {
          setGuest(true) // автоматичний вхід як гість
        }
      } finally {
        setIsChecking(false)
      }
    }
    checkLocalSchedule()
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user)
        setGuest(false)
      } else {
        setUser(null)
      }
    })
    return unsubscribe
  }, [])

  if (isChecking) return null

  return (
    <ScheduleProvider guest={guest} user={user}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user || guest ? (
            <Stack.Screen
              name="MainLayout"
              component={MainLayout}
              initialParams={{ guest }}
            />
          ) : (
            <>
              <Stack.Screen name="Welcome">
                {props => <WelcomeScreen {...props} setGuest={setGuest} />}
              </Stack.Screen>
              <Stack.Screen name="SignIn" component={SignIn} />
              <Stack.Screen name="SignUp" component={SignUp} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ScheduleProvider>
  )
}

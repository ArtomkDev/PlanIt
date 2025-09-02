// App.js
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { auth } from "./firebase";
import SignIn from "./src/auth/SignIn";
import SignUp from "./src/auth/SignUp";
import WelcomeScreen from "./src/auth/WelcomeScreen";
import MainLayout from "./src/pages/MainLayout";
import { ScheduleProvider } from "./src/context/ScheduleProvider";

import { checkDeviceStatus, registerDevice } from "./src/utils/deviceService";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  // Перевірка локального режиму (гість)
  useEffect(() => {
    const checkLocalSchedule = async () => {
      try {
        const local = await AsyncStorage.getItem("guest_schedule");
        if (local) {
          setGuest(true);
        }
      } finally {
        setLoading(false);
      }
    };
    checkLocalSchedule();
  }, []);

  // Авторизація + реєстрація пристрою
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await registerDevice(firebaseUser.uid);
          const active = await checkDeviceStatus(firebaseUser.uid);

          if (!active) {
            await signOut(auth);
          } else {
            setUser(firebaseUser);
            setGuest(false);
          }
        } catch (e) {
          console.log("Device check error:", e);
          await signOut(auth);
        }
      } else {
        setUser(null);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) return null; // можна вставити SplashScreen

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
                {(props) => <WelcomeScreen {...props} setGuest={setGuest} />}
              </Stack.Screen>
              <Stack.Screen name="SignIn" component={SignIn} />
              <Stack.Screen name="SignUp" component={SignUp} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ScheduleProvider>
  );
}

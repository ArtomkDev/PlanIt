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
import { EditorProvider } from "./src/context/EditorProvider";
import { manualLogin, setManualLogin } from "./src/utils/authFlags";


import {
  checkDeviceStatus,
  registerDevice,
  listenDeviceStatus,
} from "./src/utils/deviceService";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLocal = async () => {
      const local = await AsyncStorage.getItem("guest_schedule");
      if (local) setGuest(true);
      setLoading(false);
    };
    checkLocal();
  }, []);

  useEffect(() => {
  let unsubscribeDevice = null;

  const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const manualFlag = await AsyncStorage.getItem("manualLogin");

        if (manualLogin) {
          await registerDevice(firebaseUser.uid);
          setManualLogin(false); // скидаємо прапорець
          setUser(firebaseUser);
          setGuest(false);
          unsubscribeDevice = await listenDeviceStatus(firebaseUser.uid);
        } else {
          const active = await checkDeviceStatus(firebaseUser.uid);
          if (!active) {
            await AsyncStorage.clear();
            await signOut(auth);
          } else {
            setUser(firebaseUser);
            setGuest(false);
            unsubscribeDevice = await listenDeviceStatus(firebaseUser.uid);
          }
        }
      } catch (e) {
        console.log("Device check error:", e);
        await AsyncStorage.clear();
        await signOut(auth);
      }
    } else {
      setUser(null);
      if (unsubscribeDevice) {
        unsubscribeDevice();
        unsubscribeDevice = null;
      }
    }
  });


  return () => {
    unsubscribeAuth();
    if (unsubscribeDevice) unsubscribeDevice();
  };
}, []);


  if (loading) return null;

  return (
    <ScheduleProvider guest={guest} user={user}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user || guest ? (
              <Stack.Screen name="MainLayout">
                {(props) => (
                  <EditorProvider>
                    <MainLayout {...props} guest={guest} />
                  </EditorProvider>
                )}
              </Stack.Screen>
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
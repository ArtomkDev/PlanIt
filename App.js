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
import { registerDevice, listenForDeviceRemoval } from "./src/utils/deviceService";
import { setManualLogin } from "./src/utils/authFlags";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkGuestMode = async () => {
      const localSchedule = await AsyncStorage.getItem("guest_schedule");
      if (localSchedule) setGuest(true);
      setLoading(false);
    };
    checkGuestMode();
  }, []);

  useEffect(() => {
    let deviceListenerUnsubscribe = () => {};

    const handleSignOut = () => {
      signOut(auth).catch((error) => console.error("Sign out error", error));
    };

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      deviceListenerUnsubscribe();

      if (firebaseUser) {
        setUser(firebaseUser);
        setGuest(false);
        setManualLogin(false);
        await registerDevice(firebaseUser.uid);
        deviceListenerUnsubscribe = await listenForDeviceRemoval(firebaseUser.uid, handleSignOut);
      } else {
        setUser(null);
      }
    });

    return () => {
      authUnsubscribe();
      deviceListenerUnsubscribe();
    };
  }, []);

  if (loading) {
    return null; 
  }

  const handleExitGuest = () => {
    setGuest(false);
  };

  return (
    <ScheduleProvider guest={guest} user={user}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user || guest ? (
            <Stack.Screen name="MainLayout">
              {(props) => (
                <EditorProvider>
                  <MainLayout {...props} guest={guest} onExitGuest={handleExitGuest} />
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

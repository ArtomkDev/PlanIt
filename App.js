import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native"; 
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen"; 

import { auth } from "./firebase";
import SignIn from "./src/auth/SignIn";
import SignUp from "./src/auth/SignUp";
import WelcomeScreen from "./src/auth/WelcomeScreen";
import MainLayout from "./src/pages/MainLayout";
import { ScheduleProvider } from "./src/context/ScheduleProvider";
import { EditorProvider } from "./src/context/EditorProvider";
import { registerDevice, listenForDeviceRemoval } from "./src/utils/deviceService";
import { setManualLogin } from "./src/utils/authFlags";
import themes from "./src/config/themes"; 

SplashScreen.preventAutoHideAsync();

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync(Ionicons.font);
        const localSchedule = await AsyncStorage.getItem("guest_schedule");
        // Якщо є локальні дані, автоматично вмикаємо гостя (якщо не залогінений)
        if (localSchedule) setGuest(true);
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
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

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null; 
  }

  // Функція для виходу з режиму гостя (повертає на екран Welcome)
  const handleExitGuest = () => {
    setGuest(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={onLayoutRootView}>
      <ScheduleProvider guest={guest} user={user}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {/* Логіка: Показуємо MainLayout, якщо є Юзер АБО Гість */}
            {user || guest ? (
              <Stack.Screen name="MainLayout">
                {(props) => (
                  <EditorProvider>
                    <MainLayout 
                      {...props} 
                      guest={guest} 
                      onExitGuest={handleExitGuest} // 🔥 ВИПРАВЛЕНО: Тепер передаємо функцію зміни стану
                    />
                  </EditorProvider>
                )}
              </Stack.Screen>
            ) : (
              <>
                <Stack.Screen name="Welcome">
                  {(props) => (
                    <WelcomeScreen 
                      {...props} 
                      onGuestLogin={() => setGuest(true)} // 🔥 ВИПРАВЛЕНО: Правильна назва пропсу для WelcomeScreen
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="SignIn" component={SignIn} />
                <Stack.Screen name="SignUp" component={SignUp} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </ScheduleProvider>
    </View>
  );
}
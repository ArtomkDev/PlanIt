import 'react-native-gesture-handler';
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { auth } from "./firebase";
import AuthScreen from "./src/auth/AuthScreen"; 
import MainLayout from "./src/pages/MainLayout";
import { ScheduleProvider } from "./src/context/ScheduleProvider";
import { EditorProvider } from "./src/context/EditorProvider";
import { registerDevice, listenForDeviceRemoval } from "./src/utils/deviceService";
import { setManualLogin } from "./src/utils/authFlags";

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);

  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFonts() {
      try {
        await Font.loadAsync(Ionicons.font);
      } catch (e) {
        console.warn("Font loading failed, starting offline mode...", e);
      } finally {
        if (isMounted) setFontsLoaded(true);
      }
    }

    loadFonts();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let deviceListenerUnsubscribe = () => {};
    let currentUid = null;

    const handleSignOut = () => {
      signOut(auth).catch(console.error);
    };

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      deviceListenerUnsubscribe();
      
      if (firebaseUser) {
        currentUid = firebaseUser.uid;
        setUser(firebaseUser);
        setGuest(false);
        setManualLogin(false);
        
        setAuthResolved(true); 
        
        try {
          await registerDevice(firebaseUser.uid);
          if (currentUid === firebaseUser.uid) {
            deviceListenerUnsubscribe = await listenForDeviceRemoval(firebaseUser.uid, handleSignOut);
          }
        } catch (error) {
          console.error("Помилка реєстрації пристрою:", error);
        }
      } else {
        currentUid = null;
        setUser(null);
        
        try {
          const localSchedule = await AsyncStorage.getItem("guest_schedule");
          setGuest(!!localSchedule);
        } catch (e) {
          console.warn(e);
        } finally {
          setAuthResolved(true);
        }
      }
    });

    return () => {
      authUnsubscribe();
      deviceListenerUnsubscribe();
    };
  }, []);

  const appIsReady = fontsLoaded && authResolved;

  useEffect(() => {
    if (appIsReady) {
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 100);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  const handleExitGuest = () => {
    setGuest(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <ScheduleProvider guest={guest} user={user}>
        <NavigationContainer onReady={() => SplashScreen.hideAsync().catch(() => {})}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user || guest ? (
              <Stack.Screen name="MainLayout">
                {(props) => (
                  <EditorProvider>
                    <MainLayout
                      {...props}
                      guest={guest}
                      onExitGuest={handleExitGuest}
                    />
                  </EditorProvider>
                )}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Auth">
                {(props) => (
                  <AuthScreen 
                    {...props} 
                    onGuestLogin={() => setGuest(true)} 
                  />
                )}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </ScheduleProvider>
    </GestureHandlerRootView>
  );
}
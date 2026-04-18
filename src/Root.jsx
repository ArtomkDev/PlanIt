import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from "react";
import { AppState, Alert } from 'react-native';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onIdTokenChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { auth } from "./config/firebase";
import { trackScreenView } from "./utils/analytics/analytics";
import { setCrashlyticsUser, initGlobalErrorHandling } from "./utils/analytics/crashlytics";
import AuthScreen from "./auth/AuthScreen"; 
import MainLayout from "./layouts/MainLayout";
import { ScheduleProvider } from "./context/ScheduleProvider";
import { EditorProvider } from "./context/EditorProvider";
import { registerDevice, listenForDeviceRemoval } from "./utils/deviceService";
import { setManualLogin } from "./utils/authFlags";
import useAppLanguage from './hooks/useAppLanguage';
import { t } from './utils/i18n';
import { initAds } from './utils/adInit/adInit';

initGlobalErrorHandling();
SplashScreen.preventAutoHideAsync();
initAds();

const Stack = createNativeStackNavigator();

export default function RootApp() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const { lang, isLangLoading } = useAppLanguage();

  const wasLoggedIn = useRef(false);
  const navigationRef = useRef();
  const routeNameRef = useRef();

  useEffect(() => {
    let isMounted = true;
    async function loadFonts() {
      try {
      } catch (e) {
        console.warn(e);
      } finally {
        if (isMounted) setFontsLoaded(true);
      }
    }
    loadFonts();
    return () => { isMounted = false; };
  }, []);

  const verifySession = async (currentUser) => {
    if (!currentUser) return;
    try {
      await currentUser.getIdToken(true);
    } catch (error) {
      if (error.code !== 'auth/network-request-failed') {
        await signOut(auth);
      }
    }
  };

  useEffect(() => {
    let deviceListenerUnsubscribe = () => {};
    let currentUid = null;

    const handleSignOut = () => {
      signOut(auth).catch(console.error);
    };

    const authUnsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      deviceListenerUnsubscribe();
      
      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          wasLoggedIn.current = true;
          currentUid = firebaseUser.uid;
          setUser(firebaseUser);
          setGuest(false);
          setManualLogin(false);
          setAuthResolved(true); 
          setCrashlyticsUser(firebaseUser.uid);
          
          try {
            await registerDevice(firebaseUser.uid);
            if (currentUid === firebaseUser.uid) {
              deviceListenerUnsubscribe = await listenForDeviceRemoval(firebaseUser.uid, handleSignOut);
            }
          } catch (error) {
            console.error(error);
          }
        } else {
          currentUid = null;
          setUser(null);
          setGuest(false); 
          setAuthResolved(true);
        }
      } else {
        currentUid = null;
        setUser(null);
        setCrashlyticsUser('');
        
        if (wasLoggedIn.current) {
          setGuest(false);
          wasLoggedIn.current = false;
          setAuthResolved(true);
          
          try {
            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter(key => 
              key.toLowerCase().includes('schedule') && key !== 'guest_schedule'
            );
            if (keysToRemove.length > 0) {
              await AsyncStorage.multiRemove(keysToRemove);
            }
          } catch (e) {
            console.warn(e);
          }
        } else {
          try {
            const localSchedule = await AsyncStorage.getItem("guest_schedule");
            setGuest(!!localSchedule);
          } catch (e) {
            console.warn(e);
          } finally {
            setAuthResolved(true);
          }
        }
      }
    });

    return () => {
      authUnsubscribe();
      deviceListenerUnsubscribe();
    };
  }, []);

  const appIsReady = fontsLoaded && authResolved && !isLangLoading;

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
        <NavigationContainer 
          ref={navigationRef}
          onReady={() => {
            if (navigationRef.current) {
              routeNameRef.current = navigationRef.current.getCurrentRoute().name;
            }
            SplashScreen.hideAsync().catch(() => {});
          }}
          onStateChange={async () => {
            const previousRouteName = routeNameRef.current;
            const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

            if (previousRouteName !== currentRouteName && currentRouteName) {
              trackScreenView(currentRouteName);
            }
            routeNameRef.current = currentRouteName;
          }}
        >
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
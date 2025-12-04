import React, { useEffect, useState, useCallback } from "react";
import { View } from "react-native"; // Додаємо View для обгортки
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { onAuthStateChanged, signOut } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen"; // ⚡️ Імпорт Splash Screen

import { auth } from "./firebase";
import SignIn from "./src/auth/SignIn";
import SignUp from "./src/auth/SignUp";
import WelcomeScreen from "./src/auth/WelcomeScreen";
import MainLayout from "./src/pages/MainLayout";
import { ScheduleProvider } from "./src/context/ScheduleProvider";
import { EditorProvider } from "./src/context/EditorProvider";
import { registerDevice, listenForDeviceRemoval } from "./src/utils/deviceService";
import { setManualLogin } from "./src/utils/authFlags";

// ⚡️ Запобігаємо автоматичному зникненню заставки, поки все не завантажиться
SplashScreen.preventAutoHideAsync();

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Завантажуємо шрифт іконок (Pre-load)
        await Font.loadAsync(Ionicons.font);

        // 2. Перевіряємо локальні налаштування (гостьовий режим)
        const localSchedule = await AsyncStorage.getItem("guest_schedule");
        if (localSchedule) setGuest(true);

        // Тут можна додати інші важкі завантаження (наприклад, початковий запит в БД)
        
      } catch (e) {
        console.warn(e);
      } finally {
        // 3. Даємо сигнал, що додаток готовий до рендеру
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
      // Відписуємось від попереднього слухача, якщо він був
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

  // ⚡️ Ця функція спрацює, коли кореневий View буде відрендерено
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Тільки зараз ховаємо заставку. 
      // Це гарантує, що користувач не побачить "стрибків" шрифтів.
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null; // Поки не готові, нічого не рендеримо (заставка висить)
  }

  return (
    // ⚡️ Обгортаємо все у View з onLayout
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
    </View>
  );
}

// Допоміжна функція для виходу з гостьового режиму (якщо вона не була визначена всередині)
const handleExitGuest = () => {
  // Тут логіка, якщо вона потрібна на рівні App, 
  // але оскільки setGuest всередині App, краще передавати її як пропc
};
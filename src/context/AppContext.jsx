import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Імпортуємо Firebase Auth

const AppContext = createContext();

export function AppProvider({ children }) {
  const [schedule, setSchedule] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  
  // ДОДАНО: Стан для відстеження ініціалізації Firebase
  const [isAuthLoading, setIsAuthLoading] = useState(true); 

  useEffect(() => {
    const auth = getAuth();
    // Слухаємо стан Firebase. Ця функція спрацює один раз при старті
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthLoading(false); // Firebase дав відповідь (неважливо, гість чи юзер) - знімаємо блок!
    });

    return () => unsubscribe();
  }, []);

  const onDataChange = (data) => {
    console.log("Data updated", data);
    setSchedule(data);
  };

  // Поки Firebase ще не дав відповідь, ми НЕ РЕНДЕРИМО програму взагалі.
  // Показуємо просто пустий екран або індикатор завантаження (як Splash Screen)
  if (isAuthLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#32D74B" />
      </View>
    );
  }

  return (
    <AppContext.Provider value={{ schedule, setSchedule, authUser, setAuthUser, isAuthLoading, onDataChange }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000', // Або колір твого фону додатку
    justifyContent: 'center',
    alignItems: 'center',
  }
});
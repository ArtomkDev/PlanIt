import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [schedule, setSchedule] = useState(null);
  const [authUser, setAuthUser] = useState(null);

  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const onDataChange = (data) => {
    console.log("Data updated", data);
    setSchedule(data);
  };

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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
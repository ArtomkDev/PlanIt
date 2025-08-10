import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, ActivityIndicator } from "react-native";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../firebase";

export default function AuthDetails() {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true); // Додаємо стан для відображення завантаження

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user ? user : null);
      setLoading(false); // При отриманні користувача, припиняємо індикатор завантаження
    });

    // Відписка при демонтажі компонента
    return () => unsubscribe();
  }, []);

  const userSignOut = async () => {
    try {
      await signOut(auth);
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error:", error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Завантаження...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {authUser ? (
        <View>
          <Text style={styles.text}>{`Signed in as ${authUser.email}`}</Text>
          <Button title="Sign Out" onPress={userSignOut} />
        </View>
      ) : (
        <Text style={styles.text}>Signed Out</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  text: { fontSize: 16, marginBottom: 10 },
});

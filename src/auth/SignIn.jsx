// src/auth/SignIn.jsx
import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useSchedule } from '../context/ScheduleProvider';
import { migrateLocalToCloud } from './migrateLocalToCloud';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const { reloadAllSchedules } = useSchedule();

  const logIn = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setError('');
      setEmail('');
      setPassword('');

      // спроба міграції локальних даних (якщо вони є)
      try {
        await migrateLocalToCloud(cred.user.uid);
      } catch (e) {
        console.warn('Migration on sign-in failed', e);
      }

      // даємо трохи часу для onAuthStateChanged -> ScheduleProvider оновить user,
      // потім просимо провайдер перезавантажити дані.
      setTimeout(() => {
        try { reloadAllSchedules(); } catch(e) { /* safe */ }
      }, 400);
    } catch (e) {
      console.error(e);
      setError("SORRY, COULDN'T FIND YOUR ACCOUNT");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Log in</Text>
      <TextInput
        style={styles.input}
        placeholder='Please enter your email'
        value={email}
        onChangeText={setEmail}
        keyboardType='email-address'
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder='Please enter your password'
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title='Login' onPress={logIn} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.signupContainer}>
        <Button
          title='Sign Up'
          onPress={() => navigation.navigate('SignUp')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  header: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 16,
    paddingLeft: 8,
  },
  error: { color: 'red', textAlign: 'center', marginBottom: 16 },
  signupContainer: { marginTop: 16, alignItems: 'center' },
});

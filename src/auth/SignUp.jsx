// src/auth/SignUp.jsx
import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useSchedule } from '../context/ScheduleProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createDefaultData from '../config/createDefaultData';
import { migrateLocalToCloud } from './migrateLocalToCloud';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { reloadAllSchedules } = useSchedule();

  const register = async () => {
	  if (password !== confirmPassword) {
	    setError("Passwords didn't match");
	    return;
	  }
  
	  try {
	    const cred = await createUserWithEmailAndPassword(auth, email, password);
	
	    // Спочатку міграція локальних даних
	    const rawLocal = await AsyncStorage.getItem('guest_schedule');
	    if (rawLocal) {
	      await migrateLocalToCloud(cred.user.uid);
	    } else {
	      const def = createDefaultData();
	      await setDoc(doc(db, 'schedules', cred.user.uid), { schedule: def });
	    }
	
	    // Після цього дозволяємо ScheduleProvider підвантажити дані
	    setTimeout(() => {
	      try { reloadAllSchedules(); } catch (e) { /* safe */ }
	    }, 400);
	
	  } catch (e) {
	    console.error(e);
	    setError('Error creating account');
	  }
	};


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an Account</Text>
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
      <TextInput
        style={styles.input}
        placeholder='Please re-enter your password'
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title='Create' onPress={register} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 16,
    paddingLeft: 8,
  },
  error: { color: 'red', textAlign: 'center' },
});

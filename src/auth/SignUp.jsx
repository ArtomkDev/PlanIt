import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase'; 
import AuthLayout from '../components/AuthLayout';
import useSystemThemeColors from '../hooks/useSystemThemeColors';

// 🔥 ВАЖЛИВО: Винесено назовні
const InputField = ({ icon, placeholder, secureTextEntry, value, onChangeText, isPasswordButton, setIsPasswordVisible, isPasswordVisible, autoCapitalize="none", colors }) => (
  <View style={[styles.inputContainer, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
    <Ionicons name={icon} size={20} color={colors.textColor2} style={styles.inputIcon} />
    <TextInput
      style={[styles.input, { color: colors.textColor }]}
      placeholder={placeholder}
      placeholderTextColor={colors.textColor2}
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize={autoCapitalize}
    />
    {isPasswordButton && (
      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
        <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textColor2} />
      </TouchableOpacity>
    )}
  </View>
);

const SignUp = ({ navigation }) => {
  const { colors } = useSystemThemeColors('blue');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі поля');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      
    } catch (error) {
       let msg = "Помилка реєстрації";
       if (error.code === 'auth/email-already-in-use') msg = "Цей email вже використовується";
       if (error.code === 'auth/weak-password') msg = "Пароль занадто слабкий (мінімум 6 символів)";
       if (error.code === 'auth/invalid-email') msg = "Некоректний email";

       Alert.alert('Помилка', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Створити акаунт"
      subtitle="Зареєструйтесь, щоб зберігати розклад у хмарі."
      showBackButton
      onBack={() => navigation.goBack()}
    >
      <View style={styles.form}>
        <InputField
          icon="person-outline"
          placeholder="Ваше ім'я"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          colors={colors}
        />
        <InputField
          icon="mail-outline"
          placeholder="Email пошта"
          value={email}
          onChangeText={setEmail}
          colors={colors}
        />
        <InputField
          icon="lock-closed-outline"
          placeholder="Пароль"
          secureTextEntry={!isPasswordVisible}
          value={password}
          onChangeText={setPassword}
          isPasswordButton={true}
          isPasswordVisible={isPasswordVisible}
          setIsPasswordVisible={setIsPasswordVisible}
          colors={colors}
        />

        <TouchableOpacity
          style={[styles.registerButton, { backgroundColor: colors.accentColor, opacity: isLoading ? 0.7 : 1 }]}
          onPress={handleSignUp}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.registerButtonText}>Створити акаунт</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textColor2 }]}>Вже є акаунт? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={[styles.footerLink, { color: colors.accentColor }]}>Увійти</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 10 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16 },
  eyeButton: { padding: 10, marginRight: -10 },
  registerButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '600' },
});

export default SignUp;
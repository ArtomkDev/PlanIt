import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase'; 
import AuthLayout from '../components/AuthLayout';
import useSystemThemeColors from '../hooks/useSystemThemeColors';

const InputField = ({ icon, placeholder, secureTextEntry, value, onChangeText, isPasswordButton, setIsPasswordVisible, isPasswordVisible, colors }) => (
  <View style={[styles.inputContainer, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }]}>
    <Ionicons name={icon} size={20} color={colors.textColor2} style={styles.inputIcon} />
    <TextInput
      style={[styles.input, { color: colors.textColor }]}
      placeholder={placeholder}
      placeholderTextColor={colors.textColor2}
      secureTextEntry={secureTextEntry}
      value={value}
      onChangeText={onChangeText}
      autoCapitalize="none"
      keyboardType={placeholder.includes('email') ? 'email-address' : 'default'}
    />
    {isPasswordButton && (
      <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
        <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textColor2} />
      </TouchableOpacity>
    )}
  </View>
);

const SignIn = ({ navigation }) => {
  const { colors } = useSystemThemeColors('blue');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Помилка', 'Будь ласка, заповніть всі поля');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      let msg = "Невірний email або пароль";
      if (error.code === 'auth/invalid-email') msg = "Некоректний формат email";
      if (error.code === 'auth/invalid-credential') msg = "Невірний email або пароль";
      if (error.code === 'auth/too-many-requests') msg = "Забагато спроб. Спробуйте пізніше.";
      
      Alert.alert('Помилка входу', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="З поверненням!"
      subtitle="Увійдіть, щоб синхронізувати розклад."
      showBackButton
      onBack={() => navigation.goBack()}
    >
      <View style={styles.form}>
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

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={[styles.forgotPasswordText, { color: colors.accentColor }]}>Забули пароль?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, { backgroundColor: colors.accentColor, opacity: isLoading ? 0.7 : 1 }]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Увійти</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textColor2 }]}>Ще не маєте акаунту? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={[styles.footerLink, { color: colors.accentColor }]}>Зареєструватись</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  form: { gap: 16 },
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
  forgotPassword: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 10 },
  forgotPasswordText: { fontSize: 14, fontWeight: '500' },
  loginButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loginButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '600' },
});

export default SignIn;
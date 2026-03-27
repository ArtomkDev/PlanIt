import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase'; 
import AuthLayout from '../components/AuthLayout';
import useSystemThemeColors from '../hooks/useSystemThemeColors';
import useAppLanguage from '../hooks/useAppLanguage';
import { t } from '../utils/i18n';

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
  const { lang, isLangLoading } = useAppLanguage();
  const { colors } = useSystemThemeColors('blue');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (isLangLoading) {
    return (
      <View style={[styles.loadingWrapper, { backgroundColor: colors.backgroundColor }]}>
        <ActivityIndicator size="large" color={colors.accentColor} />
      </View>
    );
  }

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert(t('common.error', lang), t('auth.errors.fill_fields', lang));
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      
    } catch (error) {
       let msg = t('auth.errors.signup_failed', lang);
       if (error.code === 'auth/email-already-in-use') msg = t('auth.errors.email_already_in_use', lang);
       if (error.code === 'auth/weak-password') msg = t('auth.errors.weak_password', lang);
       if (error.code === 'auth/invalid-email') msg = t('auth.errors.invalid_email', lang);

       Alert.alert(t('common.error', lang), msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.signup.title', lang)}
      subtitle={t('auth.signup.subtitle', lang)}
      showBackButton
      onBack={() => navigation.goBack()}
    >
      <View style={styles.form}>
        <InputField
          icon="person-outline"
          placeholder={t('auth.fields.name', lang)}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          colors={colors}
        />
        <InputField
          icon="mail-outline"
          placeholder={t('auth.fields.email', lang)}
          value={email}
          onChangeText={setEmail}
          colors={colors}
        />
        <InputField
          icon="lock-closed-outline"
          placeholder={t('auth.fields.password', lang)}
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
            <Text style={styles.registerButtonText}>{t('auth.signup.submit', lang)}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textColor2 }]}>
            {t('auth.signup.already_have_account', lang)}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={[styles.footerLink, { color: colors.accentColor }]}>
              {t('auth.signup.login_link', lang)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  form: { gap: 16, marginTop: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16 },
  eyeButton: { padding: 10, marginRight: -10 },
  registerButton: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  registerButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '600' },
});

export default SignUp;
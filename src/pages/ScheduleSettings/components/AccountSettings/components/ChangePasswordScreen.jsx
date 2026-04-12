import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';

import { auth } from '../../../../../../firebase';
import { useSchedule } from '../../../../../context/ScheduleProvider';
import themes from '../../../../../config/themes';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';
import { t } from '../../../../../utils/i18n';

export default function ChangePasswordScreen() {
  const { global, lang } = useSchedule();
  const navigation = useNavigation();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const user = auth.currentUser;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isSocialLogin = useMemo(() => {
    if (!user) return false;
    return user.providerData.some(
      (provider) => provider.providerId === 'google.com' || provider.providerId === 'apple.com'
    );
  }, [user]);

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setErrorMsg(t('settings.account_settings.change_password.req_empty', lang) || "Будь ласка, заповніть обидва поля.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg(t('settings.account_settings.change_password.req_length', lang) || "Новий пароль має містити щонайменше 6 символів.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      await updatePassword(user, newPassword);
      
      Alert.alert(
        t('common.success', lang) || "Успішно",
        t('settings.account_settings.change_password.success_msg', lang) || "Ваш пароль успішно змінено.",
        [{ text: t('common.ok', lang) || "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorMsg(t('settings.account_settings.change_password.wrong_password', lang) || "Невірний поточний пароль.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg(t('settings.account_settings.change_password.weak_password', lang) || "Пароль надто слабкий.");
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      {isSocialLogin ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            {t('settings.account_settings.change_password.social_login_title', lang) || "Зміна пароля недоступна"}
          </Text>
          <Text style={styles.infoText}>
            {t('settings.account_settings.change_password.social_login_desc', lang) || "Ви увійшли за допомогою облікового запису Google або Apple, тому у вас немає пароля для зміни."}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>
              {t('settings.account_settings.change_password.title', lang) || "Зміна пароля"}
            </Text>
            <Text style={styles.infoText}>
              {t('settings.account_settings.change_password.desc', lang) || "Для вашої безпеки введіть поточний пароль перед встановленням нового."}
            </Text>
          </View>

          <Text style={styles.inputLabel}>
            {t('settings.account_settings.change_password.current_password_label', lang) || "Поточний пароль"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('settings.account_settings.change_password.current_password_placeholder', lang) || "Введіть поточний пароль"}
            placeholderTextColor={themeColors.textColor2}
            secureTextEntry
            value={currentPassword}
            onChangeText={(text) => {
              setCurrentPassword(text);
              if (errorMsg) setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>
            {t('settings.account_settings.change_password.new_password_label', lang) || "Новий пароль"}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('settings.account_settings.change_password.new_password_placeholder', lang) || "Введіть новий пароль"}
            placeholderTextColor={themeColors.textColor2}
            secureTextEntry
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (errorMsg) setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.accentColor }, loading && styles.actionButtonDisabled]} 
            onPress={handleChangePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>
                {t('common.save', lang) || "Зберегти"}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: { paddingHorizontal: 16, paddingTop: 20 },
  infoBox: { backgroundColor: themeColors.backgroundColor2, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: themeColors.borderColor, marginBottom: 24 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', color: themeColors.textColor, marginBottom: 8 },
  infoText: { fontSize: 14, color: themeColors.textColor2, lineHeight: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: themeColors.textColor2, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: themeColors.backgroundColor2, borderWidth: 1, borderColor: themeColors.borderColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: themeColors.textColor, marginBottom: 16 },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 16, marginLeft: 4 },
  actionButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';

import { auth } from '../../../../../config/firebase';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import MorphingLoader from '../../../../../components/ui/MorphingLoader';
import themes from '../../../../../config/themes';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';
import { t } from '../../../../../utils/i18n';
import {
  hasPasswordProvider,
  requestAddPasswordEmail,
  requestPasswordResetEmail,
} from '../../../../../auth/passwordResetService';
import PasswordStrengthBar from '../../../../../auth/components/PasswordStrengthBar';
import {
  getPasswordPolicyMessage,
  isPasswordAllowed,
} from '../../../../../auth/passwordPolicy';

export default function ChangePasswordScreen() {
  const { global, lang } = useScheduleData();
  const navigation = useNavigation();
  useIsFocused();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const user = auth.currentUser;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  const hasPassword = hasPasswordProvider(user);
  useEffect(() => {
    if (resetCooldown <= 0) return undefined;
    const timer = setTimeout(
      () => setResetCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resetCooldown]);


  const handleEmailVerification = async () => {
    if (resetCooldown > 0 || loading) {
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const email = await (hasPassword
        ? requestPasswordResetEmail({ user, lang })
        : requestAddPasswordEmail({ user, lang }));
      setVerificationSent(true);
      setResetCooldown(60);
      Alert.alert(
        t('settings.account_settings.change_password.email_sent_title', lang),
        t(
          hasPassword
            ? 'settings.account_settings.change_password.reset_email_sent_desc'
            : 'settings.account_settings.change_password.add_email_sent_desc',
          lang,
        ).replace('{email}', email),
      );
    } catch (error) {
      if (
        error.code === 'auth/too-many-requests'
        || error.code === 'password-reset/too-many-requests'
      ) {
        setResetCooldown(60);
        setErrorMsg(t('settings.account_settings.change_password.too_many_requests', lang));
      } else if (error.code === 'password-reset/email-unavailable') {
        setErrorMsg(t('settings.account_settings.change_password.email_unavailable', lang));
      } else {
        setErrorMsg(t('settings.account_settings.change_password.email_failed', lang));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword || !confirmPassword) {
      setErrorMsg(t('settings.account_settings.change_password.req_empty', lang) || "Будь ласка, заповніть обидва поля.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t('auth.password_reset.passwords_mismatch', lang));
      return;
    }

    if (!isPasswordAllowed(newPassword)) {
      setErrorMsg(getPasswordPolicyMessage(lang));
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
        setErrorMsg(getPasswordPolicyMessage(lang));
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsScreenLayout
      title={t(
        hasPassword
          ? 'settings.account_settings.change_password.title'
          : 'settings.account_settings.change_password.add_password_title',
        lang,
      )}
      contentContainerStyle={styles.contentContainer}
    >
      {!hasPassword ? (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>
              {t('settings.account_settings.change_password.add_password_title', lang)}
            </Text>
            <Text style={styles.infoText}>
              {t('settings.account_settings.change_password.add_password_desc', lang)
                .replace('{email}', user.email || '')}
            </Text>
          </View>

          {verificationSent ? (
            <Text style={styles.successText}>
              {t('settings.account_settings.change_password.check_email', lang)}
            </Text>
          ) : null}
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: themeColors.accentColor },
              (loading || resetCooldown > 0) && styles.actionButtonDisabled,
            ]}
            onPress={handleEmailVerification}
            disabled={loading || resetCooldown > 0}
          >
            {loading ? (
              <MorphingLoader size={26} />
            ) : (
              <Text style={styles.actionButtonText}>
                {resetCooldown > 0
                  ? `${t('settings.account_settings.change_password.resend_email_btn', lang)} (${resetCooldown})`
                  : verificationSent
                    ? t('settings.account_settings.change_password.resend_email_btn', lang)
                    : t('settings.account_settings.change_password.send_email_btn', lang)}
              </Text>
            )}
          </TouchableOpacity>
        </>
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

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={handleEmailVerification}
            disabled={loading || resetCooldown > 0}
          >
            <Text style={[styles.forgotPasswordText, { color: themeColors.accentColor }]}>
              {resetCooldown > 0
                ? `${t('settings.account_settings.change_password.forgot_password', lang)} (${resetCooldown})`
                : t('settings.account_settings.change_password.forgot_password', lang)}
            </Text>
          </TouchableOpacity>

          {verificationSent ? (
            <Text style={styles.successText}>
              {t('settings.account_settings.change_password.check_email', lang)}
            </Text>
          ) : null}

          <Text style={styles.inputLabel}>
            {t('settings.account_settings.change_password.new_password_label', lang) || "Новий пароль"}
          </Text>
          <View style={styles.passwordFieldGroup}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
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
            <PasswordStrengthBar
              password={newPassword}
              isDark={mode === 'dark'}
            />
          </View>

          <Text style={styles.inputLabel}>
            {t('auth.password_reset.confirm_password_label', lang)}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.password_reset.confirm_password_placeholder', lang)}
            placeholderTextColor={themeColors.textColor2}
            secureTextEntry
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
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
              <MorphingLoader size={26} />
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
  passwordFieldGroup: { marginBottom: 16 },
  passwordInput: { marginBottom: 0 },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 16, marginLeft: 4 },
  successText: { color: '#34C759', fontSize: 14, marginBottom: 16, marginLeft: 4 },
  forgotPasswordButton: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16, paddingVertical: 6 },
  forgotPasswordText: { fontSize: 14, fontWeight: '600' },
  actionButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

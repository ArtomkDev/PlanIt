import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import MorphingLoader from '../components/ui/MorphingLoader';
import themes from '../config/themes';
import { useScheduleData } from '../context/ScheduleProvider';
import SettingsScreenLayout from '../layouts/SettingsScreenLayout';
import { t } from '../utils/i18n';
import {
  completePasswordReset,
  PASSWORD_ACTION_ADD,
  verifyPasswordResetRequest,
} from './passwordResetService';
import PasswordStrengthBar from './components/PasswordStrengthBar';
import {
  getPasswordPolicyMessage,
  isPasswordAllowed,
} from './passwordPolicy';

export default function PasswordResetScreen({ fallbackRoute = 'Auth' }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { global, lang: appLang } = useScheduleData();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const oobCode = route.params?.oobCode;
  const isAddingPassword = route.params?.purpose === PASSWORD_ACTION_ADD;
  const requestedLang = route.params?.lang;
  const lang = requestedLang === 'uk' || requestedLang === 'en'
    ? requestedLang
    : appLang;
  const actionTranslationKey = (suffix) => (
    'auth.' + (isAddingPassword ? 'password_add' : 'password_reset') + '.' + suffix
  );
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;

    const verifyRequest = async () => {
      setStatus('verifying');
      setErrorMsg('');

      try {
        const email = await verifyPasswordResetRequest(oobCode);
        if (!active) return;
        setVerifiedEmail(email);
        setStatus('ready');
      } catch {
        if (!active) return;
        setStatus('invalid');
        setErrorMsg(t('auth.password_reset.invalid_link', lang));
      }
    };

    verifyRequest();
    return () => {
      active = false;
    };
  }, [lang, oobCode]);

  const closeResetFlow = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.replace(fallbackRoute);
  };

  const handleSavePassword = async () => {
    if (!isPasswordAllowed(newPassword)) {
      setErrorMsg(getPasswordPolicyMessage(lang));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('auth.password_reset.passwords_mismatch', lang));
      return;
    }

    setStatus('saving');
    setErrorMsg('');

    try {
      await completePasswordReset(oobCode, newPassword);
      setStatus('complete');
    } catch (error) {
      setStatus('ready');
      if (error.code === 'auth/weak-password') {
        setErrorMsg(getPasswordPolicyMessage(lang));
      } else if (
        error.code === 'auth/expired-action-code'
        || error.code === 'auth/invalid-action-code'
      ) {
        setStatus('invalid');
        setErrorMsg(t('auth.password_reset.invalid_link', lang));
      } else {
        setErrorMsg(t(actionTranslationKey('failed'), lang));
      }
    }
  };

  const isBusy = status === 'verifying' || status === 'saving';

  return (
    <SettingsScreenLayout
      title={t(actionTranslationKey('title'), lang)}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {status === 'invalid'
            ? t('auth.password_reset.invalid_title', lang)
            : status === 'complete'
              ? t('common.success', lang)
            : t(actionTranslationKey('verified_title'), lang)}
        </Text>
        <Text style={styles.infoText}>
          {status === 'verifying'
            ? t('auth.password_reset.verifying', lang)
            : status === 'invalid'
              ? t(actionTranslationKey('invalid_desc'), lang)
              : status === 'complete'
                ? t(actionTranslationKey('success_msg'), lang)
              : t(actionTranslationKey('verified_desc'), lang, { email: verifiedEmail })}
        </Text>
      </View>

      {status === 'ready' || status === 'saving' ? (
        <>
          <Text style={styles.inputLabel}>
            {t('auth.password_reset.new_password_label', lang)}
          </Text>
          <View style={styles.passwordFieldGroup}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              accessibilityLabel={t('auth.password_reset.new_password_label', lang)}
              placeholder={t('auth.password_reset.new_password_placeholder', lang)}
              placeholderTextColor={themeColors.textColor2}
              secureTextEntry
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (errorMsg) setErrorMsg('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
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
            accessibilityLabel={t('auth.password_reset.confirm_password_label', lang)}
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
            autoComplete="new-password"
            textContentType="newPassword"
          />
        </>
      ) : null}

      {errorMsg ? (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          {errorMsg}
        </Text>
      ) : null}

      {status === 'ready' || status === 'saving' || status === 'verifying' ? (
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: themeColors.accentColor },
            isBusy && styles.actionButtonDisabled,
          ]}
          onPress={handleSavePassword}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={t(actionTranslationKey('save_btn'), lang)}
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
        >
          {isBusy ? <MorphingLoader size={22} /> : null}
          <Text style={styles.actionButtonText}>
            {t(actionTranslationKey('save_btn'), lang)}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: themeColors.accentColor }]}
          onPress={closeResetFlow}
          accessibilityRole="button"
          accessibilityLabel={
            status === 'complete'
              ? t('common.done', lang)
              : t('auth.password_reset.back_btn', lang)
          }
        >
          <Text style={styles.actionButtonText}>
            {status === 'complete'
              ? t('common.done', lang)
              : t('auth.password_reset.back_btn', lang)}
          </Text>
        </TouchableOpacity>
      )}
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: { paddingHorizontal: 16, paddingTop: 20 },
  infoBox: {
    backgroundColor: themeColors.backgroundColor2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: themeColors.textColor,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: themeColors.textColor2,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: themeColors.textColor2,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: themeColors.backgroundColor2,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: themeColors.textColor,
    marginBottom: 16,
  },
  passwordFieldGroup: { marginBottom: 16 },
  passwordInput: { marginBottom: 0 },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    marginLeft: 4,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButtonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

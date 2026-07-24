import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { deleteUser } from 'firebase/auth';

import { auth } from '../../../../../config/firebase';
import {
  beginAccountDeletion,
  deleteAllUserData,
} from '../../../../../config/firestore';
import {
  getAccountDeletionProviders,
  isAccountDeletionVerificationValid,
  reauthenticateForAccountDeletion,
  revokeAppleAuthorizationForDeletion,
} from '../../../../../auth/authServices';
import { clearLocalAccountData } from '../../../../../services/localAccountDataService';
import { setIgnoreDeviceRemoval } from '../../../../../utils/deviceService';
import { logCrashlyticsError } from '../../../../../utils/analytics/crashlytics';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import MorphingLoader from '../../../../../components/ui/MorphingLoader';
import themes from '../../../../../config/themes';
import { t } from '../../../../../utils/i18n';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';

const getDeletionErrorKey = (error) => {
  if (
    error?.code === 'auth/wrong-password' ||
    error?.code === 'auth/invalid-credential'
  ) {
    return 'wrong_password';
  }
  if (
    error?.code === 'auth/requires-recent-login' ||
    error?.code === 'account-deletion/verification-expired'
  ) {
    return 'verification_expired';
  }
  if (
    error?.code === 'auth/popup-closed-by-user' ||
    error?.code === 'auth/cancelled-popup-request' ||
    error?.code === 'ERR_REQUEST_CANCELED'
  ) {
    return 'verification_cancelled';
  }
  if (
    error?.code === 'account-deletion/provider-unavailable' ||
    error?.code === 'account-deletion/unsupported-provider'
  ) {
    return 'provider_unavailable';
  }
  if (error?.code === 'account-deletion/missing-provider-token') {
    return 'provider_token_missing';
  }
  if (error?.code === 'account-deletion/partial-failure') {
    return 'server_delete_failed';
  }
  if (error?.code?.startsWith('account-deletion/apple-revocation')) {
    return 'apple_revoke_failed';
  }
  return 'generic_error';
};

export default function DeleteAccountScreen() {
  const { global, lang } = useScheduleData();
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const [password, setPassword] = useState('');
  const [verification, setVerification] = useState(null);
  const [verifyingProvider, setVerifyingProvider] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const user = auth.currentUser;
  const providers = useMemo(
    () => getAccountDeletionProviders(user),
    [user],
  );
  const verificationProviders = useMemo(
    () => (
      providers.includes('apple.com') ? ['apple.com'] : providers
    ),
    [providers],
  );
  const hasAvailableProvider = verificationProviders.some(
    (providerId) =>
      providerId !== 'apple.com' ||
      Platform.OS === 'web' ||
      Platform.OS === 'ios',
  );
  const busy = Boolean(verifyingProvider) || deleting;

  const setLocalizedError = (error) => {
    const key = getDeletionErrorKey(error);
    setErrorMsg(
      t(`settings.account_settings.delete_screen.${key}`, lang),
    );
  };

  const handleVerify = async (providerId) => {
    if (providerId === 'password' && !password.trim()) {
      setErrorMsg(
        t(
          'settings.account_settings.delete_screen.enter_password_req',
          lang,
        ),
      );
      return;
    }

    setVerifyingProvider(providerId);
    setVerification(null);
    setErrorMsg('');

    try {
      const nextVerification = await reauthenticateForAccountDeletion({
        providerId,
        password,
        user: auth.currentUser,
      });
      setVerification(nextVerification);
      setPassword('');
    } catch (error) {
      setLocalizedError(error);
    } finally {
      setVerifyingProvider(null);
    }
  };

  const executeDeletion = async (confirmedVerification) => {
    const currentUser = auth.currentUser;
    if (
      !currentUser ||
      !isAccountDeletionVerificationValid(
        confirmedVerification,
        currentUser,
      )
    ) {
      const error = new Error('Account deletion verification expired.');
      error.code = 'account-deletion/verification-expired';
      setVerification(null);
      setLocalizedError(error);
      return;
    }

    setDeleting(true);
    setErrorMsg('');
    setIgnoreDeviceRemoval(true);
    const releaseDeletionLock = beginAccountDeletion();

    try {
      const appleRevocation =
        await revokeAppleAuthorizationForDeletion(
          confirmedVerification,
          currentUser,
        );
      if (appleRevocation.status === 'revoked') {
        setVerification({
          ...confirmedVerification,
          appleAuthorizationRevoked: true,
        });
      }

      await deleteAllUserData(currentUser.uid);

      try {
        await clearLocalAccountData(currentUser.uid);
      } catch (error) {
        logCrashlyticsError(error, 'deleteAccount_LocalCacheCleanup');
      }

      await deleteUser(currentUser);
    } catch (error) {
      logCrashlyticsError(error, 'deleteAccount_Orchestration');
      if (
        error?.code === 'auth/requires-recent-login' ||
        error?.code?.startsWith('account-deletion/apple-revocation')
      ) {
        setVerification(null);
      }
      setLocalizedError(error);
    } finally {
      releaseDeletionLock();
      setIgnoreDeviceRemoval(false);
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    const currentUser = auth.currentUser;
    if (!isAccountDeletionVerificationValid(verification, currentUser)) {
      const error = new Error('Account deletion verification expired.');
      error.code = 'account-deletion/verification-expired';
      setVerification(null);
      setLocalizedError(error);
      return;
    }

    const confirmationMessage = t(
      'settings.account_settings.delete_screen.alert_msg',
      lang,
    );

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(confirmationMessage)
      ) {
        executeDeletion(verification);
      }
      return;
    }

    Alert.alert(
      t('settings.account_settings.delete_screen.alert_title', lang),
      confirmationMessage,
      [
        { text: t('common.cancel', lang), style: 'cancel' },
        {
          text: t(
            'settings.account_settings.delete_screen.confirm_btn',
            lang,
          ),
          style: 'destructive',
          onPress: () => executeDeletion(verification),
        },
      ],
    );
  };

  const renderProviderButton = (providerId) => {
    const loading = verifyingProvider === providerId;
    const label = providerId === 'password'
      ? t(
        'settings.account_settings.delete_screen.password_provider',
        lang,
      )
      : providerId === 'google.com'
        ? 'Google'
        : providerId === 'apple.com'
          ? 'Apple'
          : providerId;
    const isAppleUnavailable =
      providerId === 'apple.com' &&
      Platform.OS !== 'web' &&
      Platform.OS !== 'ios';

    if (providerId === 'apple.com' && Platform.OS === 'ios') {
      const AppleAuthentication = require('expo-apple-authentication');
      return (
        <View
          key={providerId}
          pointerEvents={busy ? 'none' : 'auto'}
          style={[styles.appleButtonWrapper, busy && styles.disabled]}
        >
          {loading ? (
            <View style={styles.appleLoadingOverlay}>
              <MorphingLoader size={24} />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                mode === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={12}
              style={styles.nativeAppleButton}
              onPress={() => handleVerify(providerId)}
            />
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity
        key={providerId}
        style={[
          styles.providerButton,
          (busy || isAppleUnavailable) && styles.disabled,
        ]}
        onPress={() => handleVerify(providerId)}
        disabled={busy || isAppleUnavailable}
        accessibilityRole="button"
        accessibilityLabel={`${t(
          'settings.account_settings.delete_screen.verify_with',
          lang,
        )} ${label}`}
      >
        {loading ? (
          <MorphingLoader size={24} />
        ) : (
          <Text style={styles.providerButtonText}>
            {t(
              'settings.account_settings.delete_screen.verify_with',
              lang,
            )}{' '}
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>
          {t(
            'settings.account_settings.delete_screen.danger_zone_title',
            lang,
          )}
        </Text>
        <Text style={styles.warningText}>
          {t(
            'settings.account_settings.delete_screen.warning_desc',
            lang,
          )}
        </Text>
        <Text style={styles.scopeText}>
          {t(
            'settings.account_settings.delete_screen.deletion_scope',
            lang,
          )}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        {t(
          'settings.account_settings.delete_screen.verify_identity',
          lang,
        )}
      </Text>
      <Text style={styles.sectionDescription}>
        {t(
          'settings.account_settings.delete_screen.verify_identity_desc',
          lang,
        )}
      </Text>

      {verificationProviders.includes('password') ? (
        <>
          <Text style={styles.inputLabel}>
            {t(
              'settings.account_settings.delete_screen.confirm_password',
              lang,
            )}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.fields.password', lang)}
            placeholderTextColor={themeColors.textColor2}
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setVerification(null);
              if (errorMsg) setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
        </>
      ) : null}

      <View style={styles.providerList}>
        {verificationProviders.map(renderProviderButton)}
      </View>

      {!hasAvailableProvider ? (
        <Text style={styles.errorText}>
          {t(
            'settings.account_settings.delete_screen.no_supported_provider',
            lang,
          )}
        </Text>
      ) : null}

      {verification ? (
        <View style={styles.verifiedBox}>
          <Text style={styles.verifiedText}>
            {t(
              'settings.account_settings.delete_screen.identity_verified',
              lang,
            )}
          </Text>
        </View>
      ) : null}

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <TouchableOpacity
        style={[
          styles.deleteButton,
          (!verification || busy) && styles.deleteButtonDisabled,
        ]}
        onPress={handleDelete}
        disabled={!verification || busy}
        accessibilityRole="button"
      >
        {deleting ? (
          <MorphingLoader size={26} />
        ) : (
          <Text style={styles.deleteButtonText}>
            {t('settings.account_settings.delete_account', lang)}
          </Text>
        )}
      </TouchableOpacity>
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: themeColors.textColor,
    lineHeight: 20,
  },
  scopeText: {
    fontSize: 13,
    color: themeColors.textColor2,
    lineHeight: 19,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: themeColors.textColor,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: themeColors.textColor2,
    lineHeight: 20,
    marginBottom: 18,
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
    marginBottom: 12,
  },
  providerList: {
    gap: 10,
  },
  providerButton: {
    minHeight: 50,
    backgroundColor: themeColors.backgroundColor2,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  providerButtonText: {
    color: themeColors.textColor,
    fontSize: 15,
    fontWeight: '700',
  },
  appleButtonWrapper: {
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nativeAppleButton: {
    width: '100%',
    height: 50,
  },
  appleLoadingOverlay: {
    height: 50,
    backgroundColor: themeColors.backgroundColor2,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  verifiedText: {
    color: '#2FA84F',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 14,
    marginHorizontal: 4,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minHeight: 52,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  disabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

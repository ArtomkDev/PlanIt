import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { User, EnvelopeSimple, LockKey, Trash, GoogleLogo, AppleLogo } from 'phosphor-react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { GoogleAuthProvider, OAuthProvider, linkWithPopup } from 'firebase/auth';
import Constants from 'expo-constants';

import { auth } from '../../../../config/firebase';
import { useSchedule } from '../../../../context/ScheduleProvider';
import themes from '../../../../config/themes';
import { t } from '../../../../utils/i18n';
import MorphingLoader from '../../../../components/ui/MorphingLoader';
import SettingsScreenLayout from '../../../../layouts/SettingsScreenLayout';
import { getLinkedProviders, unlinkProvider, linkGoogleAccount, linkAppleAccount } from '../../../../auth/authServices';

import SettingsGroup from '../../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../../components/ui/SettingsKit/SettingsRow';

const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
}

export default function AccountSettings() {
  const { global, user: contextUser, lang } = useSchedule();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const activeUser = isFocused ? auth.currentUser : contextUser;

  const [linkedProviders, setLinkedProviders] = useState([]);
  const [isProcessing, setIsProcessing] = useState(null);

  const isNativeDisabled = isExpoGo && Platform.OS !== 'web';
  const isSocialOnly = activeUser?.providerData?.every(p => p.providerId !== 'password');

  useEffect(() => {
    if (activeUser) {
      setLinkedProviders(getLinkedProviders());
    }
  }, [activeUser, isFocused]);

  const handleLinkGoogle = async () => {
    if (isNativeDisabled) {
      Alert.alert(
        t('auth.errors.expo_go_title', lang), 
        t('auth.errors.expo_go_google_msg', lang)
      );
      return;
    }

    setIsProcessing('google.com');
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await linkWithPopup(activeUser, provider);
      } else {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        
        const idToken = response?.data?.idToken || response?.idToken;
        
        if (!idToken) {
          throw new Error("No ID token returned");
        }
        
        await linkGoogleAccount(idToken);
      }
      setLinkedProviders(getLinkedProviders());
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED' && error.message !== 'Sign in action cancelled') {
        Alert.alert(t('common.error', lang), error.message);
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleLinkApple = async () => {
    if (isNativeDisabled) {
      Alert.alert(
        t('auth.errors.expo_go_title', lang), 
        t('auth.errors.expo_go_apple_msg', lang)
      );
      return;
    }

    setIsProcessing('apple.com');
    try {
      if (Platform.OS === 'web') {
        const provider = new OAuthProvider('apple.com');
        await linkWithPopup(activeUser, provider);
      } else {
        const AppleAuthentication = require('expo-apple-authentication');
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        await linkAppleAccount(credential.identityToken);
      }
      setLinkedProviders(getLinkedProviders());
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert(t('common.error', lang), error.message);
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUnlink = async (providerId) => {
    if (activeUser.providerData.length <= 1) {
      Alert.alert(t('common.error', lang), t('auth.errors.cannot_unlink_only_provider', lang));
      return;
    }

    setIsProcessing(providerId);
    try {
      await unlinkProvider(providerId);
      setLinkedProviders(getLinkedProviders());
    } catch (error) {
      Alert.alert(t('common.error', lang), error.message);
    } finally {
      setIsProcessing(null);
    }
  };

  const renderProviderStatus = (isLinked, providerId, onLink) => {
    if (isProcessing === providerId) {
      return <MorphingLoader size={24} />;
    }

    if (isLinked) {
      return (
        <TouchableOpacity onPress={() => handleUnlink(providerId)} style={styles.unlinkButton}>
          <Text style={styles.unlinkButtonText}>{t('settings.account_settings.unlink_btn', lang)}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        onPress={onLink} 
        style={[styles.linkButton, isNativeDisabled && { opacity: 0.5 }]}
        activeOpacity={isNativeDisabled ? 1 : 0.7}
      >
        <Text style={styles.linkButtonText}>{t('settings.account_settings.link_btn', lang)}</Text>
      </TouchableOpacity>
    );
  };

  const userName = activeUser?.displayName || t('settings.account_settings.not_specified', lang);
  const userEmail = activeUser?.email || t('settings.account_settings.not_specified', lang);
  
  const initial = userName !== t('settings.account_settings.not_specified', lang) 
    ? userName.charAt(0).toUpperCase() 
    : '?';

  const isGoogleLinked = linkedProviders.includes('google.com');
  const isAppleLinked = linkedProviders.includes('apple.com');

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{userName}</Text>
        <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">{userEmail}</Text>
      </View>

      <SettingsGroup 
        title={t('settings.account_settings.info_section', lang)} 
        themeColors={themeColors}
      >
        <SettingsRow 
          icon={User} 
          label={t('settings.account_settings.name', lang)} 
          value={userName} 
          themeColors={themeColors}
          onPress={() => navigation.navigate('ChangeName')}
        />
        <SettingsRow 
          icon={EnvelopeSimple} 
          label={t('settings.account_settings.email', lang)} 
          value={userEmail} 
          themeColors={themeColors}
          onPress={() => {
            if (isSocialOnly) {
              Alert.alert(
                t('settings.account_settings.change_email_screen.social_login_title', lang),
                t('settings.account_settings.change_email_screen.social_login_desc', lang)
              );
            } else {
              navigation.navigate('ChangeEmail');
            }
          }}
        />
      </SettingsGroup>

      <SettingsGroup 
        title={t('settings.account_settings.linked_accounts_section', lang)} 
        themeColors={themeColors}
      >
        <SettingsRow 
          icon={GoogleLogo} 
          label="Google" 
          showCaret={false}
          themeColors={themeColors}
          rightContent={renderProviderStatus(isGoogleLinked, 'google.com', handleLinkGoogle)}
        />
        {Platform.OS !== 'android' && (
          <SettingsRow 
            icon={AppleLogo} 
            label="Apple" 
            showCaret={false}
            themeColors={themeColors}
            rightContent={renderProviderStatus(isAppleLinked, 'apple.com', handleLinkApple)}
          />
        )}
      </SettingsGroup>

      <SettingsGroup 
        title={t('settings.account_settings.security_section', lang)} 
        themeColors={themeColors}
      >
        <SettingsRow 
          icon={LockKey} 
          label={t('settings.account_settings.password', lang)} 
          value="••••••••" 
          themeColors={themeColors}
          onPress={() => {
            if (isSocialOnly) {
              Alert.alert(
                t('settings.account_settings.change_password.social_login_title', lang),
                t('settings.account_settings.change_password.social_login_desc', lang)
              );
            } else {
              navigation.navigate('ChangePassword');
            }
          }}
        />
      </SettingsGroup>

      <SettingsGroup 
        title={t('settings.account_settings.management_section', lang)} 
        themeColors={themeColors}
      >
        <SettingsRow 
          icon={Trash} 
          label={t('settings.account_settings.delete_account', lang)} 
          danger={true}
          showCaret={false}
          themeColors={themeColors}
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </SettingsGroup>
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 32, 
    paddingHorizontal: 20 
  },
  avatar: {
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: themeColors.accentColor,
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: themeColors.accentColor,
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 5,
  },
  avatarText: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  userName: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: themeColors.textColor, 
    marginBottom: 4, 
    textAlign: 'center', 
    width: '100%' 
  },
  userEmail: { 
    fontSize: 14, 
    color: themeColors.textColor2, 
    textAlign: 'center', 
    width: '100%' 
  },
  linkButton: { 
    backgroundColor: themeColors.accentColor, 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 16 
  },
  linkButtonText: { 
    fontSize: 12, 
    color: '#FFFFFF', 
    fontWeight: '600' 
  },
  unlinkButton: { 
    backgroundColor: 'transparent', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#FF3B30' 
  },
  unlinkButtonText: { 
    fontSize: 12, 
    color: '#FF3B30', 
    fontWeight: '600' 
  },
});
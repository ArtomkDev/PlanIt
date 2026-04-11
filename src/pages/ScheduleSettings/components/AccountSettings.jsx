import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { GoogleAuthProvider, OAuthProvider, linkWithPopup } from 'firebase/auth';
import Constants from 'expo-constants';

import { auth } from '../../../../firebase';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';
import MorphingLoader from '../../../components/MorphingLoader';
import SettingsScreenLayout from '../SettingsScreenLayout';
import { getLinkedProviders, unlinkProvider, linkGoogleAccount, linkAppleAccount } from '../../../auth/authServices';

const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: '66089248812-is6urdiplc47uc3s323n4546vpip7aoe.apps.googleusercontent.com',
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

  const SettingsRow = ({ icon, title, value, rightElement, isLast, isDestructive, onPress }) => {
    const Component = onPress ? TouchableOpacity : View;
    
    return (
      <Component 
        style={[styles.row, !isLast && styles.rowBorder]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.rowLeft}>
          {icon && (
            <View style={[styles.iconContainer, isDestructive && styles.destructiveIconContainer]}>
              <Ionicons name={icon} size={20} color={isDestructive ? '#FF3B30' : themeColors.accentColor} />
            </View>
          )}
          <Text style={[styles.rowTitle, isDestructive && styles.destructiveText]}>{title}</Text>
        </View>
        
        <View style={styles.rowRight}>
          {value && <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>}
          {rightElement}
        </View>
      </Component>
    );
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

      <Text style={styles.sectionTitle}>{t('settings.account_settings.info_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="person-outline" 
          title={t('settings.account_settings.name', lang)} 
          value={userName} 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
          onPress={() => navigation.navigate('ChangeName')}
        />
        
        <SettingsRow 
          icon="mail-outline" 
          title={t('settings.account_settings.email', lang)} 
          value={userEmail} 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
          isLast
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
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.linked_accounts_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="logo-google" 
          title="Google" 
          rightElement={renderProviderStatus(isGoogleLinked, 'google.com', handleLinkGoogle)}
        />
        {Platform.OS !== 'android' && (
          <SettingsRow 
            icon="logo-apple" 
            title="Apple" 
            rightElement={renderProviderStatus(isAppleLinked, 'apple.com', handleLinkApple)}
            isLast
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.security_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="lock-closed-outline" 
          title={t('settings.account_settings.password', lang)} 
          value="••••••••" 
          rightElement={<Ionicons name="chevron-forward" size={20} color={themeColors.textColor2} />}
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
      </View>

      <Text style={styles.sectionTitle}>{t('settings.account_settings.management_section', lang)}</Text>
      <View style={styles.section}>
        <SettingsRow 
          icon="trash-outline" 
          title={t('settings.account_settings.delete_account', lang)} 
          isLast 
          isDestructive 
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </View>
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: { alignItems: 'center', marginBottom: 32, paddingHorizontal: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: themeColors.accentColor,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: themeColors.accentColor,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  userName: { fontSize: 22, fontWeight: '700', color: themeColors.textColor, marginBottom: 4, textAlign: 'center', width: '100%' },
  userEmail: { fontSize: 14, color: themeColors.textColor2, textAlign: 'center', width: '100%' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: themeColors.textColor2, marginLeft: 16, marginBottom: 8, marginTop: 24, letterSpacing: 0.5 },
  section: {
    backgroundColor: themeColors.backgroundColor2,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: themeColors.borderColor, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, minHeight: 56 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.borderColor },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, marginRight: 16 },
  iconContainer: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(150, 150, 150, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  destructiveIconContainer: { backgroundColor: 'rgba(255, 59, 48, 0.1)' },
  rowTitle: { fontSize: 16, color: themeColors.textColor, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  rowValue: { fontSize: 16, color: themeColors.textColor2, marginRight: 8, flexShrink: 1, textAlign: 'right' },
  linkedStatus: { fontSize: 14, color: themeColors.textColor2, fontWeight: '500' },
  linkButton: { backgroundColor: themeColors.accentColor, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  linkButtonText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
  unlinkButton: { backgroundColor: 'transparent', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#FF3B30' },
  unlinkButtonText: { fontSize: 12, color: '#FF3B30', fontWeight: '600' },
  centerRow: { justifyContent: 'center' },
  actionText: { fontSize: 16, color: themeColors.accentColor, fontWeight: '500' },
  destructiveText: { color: '#FF3B30' },
});
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import useSystemThemeColors from '../../hooks/useSystemThemeColors';
import useAppLanguage from '../../hooks/useAppLanguage';
import { t } from '../../utils/i18n';

import { auth } from '../../config/firebase';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, OAuthProvider, linkWithPopup } from 'firebase/auth';
import { linkGoogleAccount, linkAppleAccount } from '../authServices';

const isExpoGo = Constants.appOwnership === 'expo';

if (Platform.OS !== 'web' && !isExpoGo) {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: '66089248812-is6urdiplc47uc3s323n4546vpip7aoe.apps.googleusercontent.com',
    offlineAccess: true,
  });
}

const SocialAuthButtons = ({ onAuthSuccess, onAuthError, isLinking = false }) => {
  const { colors, isDark } = useSystemThemeColors('blue');
  const { lang } = useAppLanguage();
  const [loadingProvider, setLoadingProvider] = useState(null);

  const handleGoogleAuth = async () => {
    if (isExpoGo && Platform.OS !== 'web') {
      Alert.alert(
        t('auth.errors.expo_go_title', lang), 
        t('auth.errors.expo_go_google_msg', lang)
      );
      return;
    }

    setLoadingProvider('google');
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        if (isLinking) {
          await linkWithPopup(auth.currentUser, provider);
        } else {
          await signInWithPopup(auth, provider);
        }
      } else {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        
        const idToken = response?.data?.idToken || response?.idToken;
        
        if (!idToken) {
          setLoadingProvider(null);
          return;
        }

        if (isLinking) {
          await linkGoogleAccount(idToken);
        } else {
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        }
      }
      onAuthSuccess?.();
    } catch (error) {
      onAuthError?.(error);
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleAuth = async () => {
    if (isExpoGo && Platform.OS !== 'web') {
      Alert.alert(
        t('auth.errors.expo_go_title', lang), 
        t('auth.errors.expo_go_apple_msg', lang)
      );
      return;
    }

    setLoadingProvider('apple');
    try {
      if (Platform.OS === 'web') {
        const provider = new OAuthProvider('apple.com');
        if (isLinking) {
          await linkWithPopup(auth.currentUser, provider);
        } else {
          await signInWithPopup(auth, provider);
        }
      } else {
        const AppleAuthentication = require('expo-apple-authentication');
        
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        
        if (isLinking) {
          await linkAppleAccount(credential.identityToken);
        } else {
          const provider = new OAuthProvider('apple.com');
          const firebaseCredential = provider.credential({ idToken: credential.identityToken });
          await signInWithCredential(auth, firebaseCredential);
        }
      }
      onAuthSuccess?.();
    } catch (error) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        onAuthError?.(error);
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const isNativeDisabled = isExpoGo && Platform.OS !== 'web';

  return (
    <View style={styles.container}>
      <View style={styles.dividerContainer}>
        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
        <Text style={[styles.dividerText, { color: colors.textColor2 }]}>
          {isLinking ? t('auth.settings.link_with', lang) : t('auth.common.continue_with', lang)}
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[
            styles.socialButton, 
            { backgroundColor: isDark ? '#222' : '#fff', borderColor: colors.borderColor },
            isNativeDisabled && { opacity: 0.5 }
          ]}
          onPress={handleGoogleAuth}
          disabled={!!loadingProvider}
          activeOpacity={isNativeDisabled ? 1 : 0.7}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator color={colors.textColor} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={isDark ? '#fff' : '#DB4437'} />
              <Text style={[styles.socialButtonText, { color: colors.textColor }]}>Google</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS !== 'android' && (
          <TouchableOpacity
            style={[
              styles.socialButton, 
              { backgroundColor: isDark ? '#fff' : '#000', borderColor: isDark ? '#fff' : '#000' },
              isNativeDisabled && { opacity: 0.5 }
            ]}
            onPress={handleAppleAuth}
            disabled={!!loadingProvider}
            activeOpacity={isNativeDisabled ? 1 : 0.7}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator color={isDark ? '#000' : '#fff'} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={24} color={isDark ? '#000' : '#fff'} />
                <Text style={[styles.socialButtonText, { color: isDark ? '#000' : '#fff' }]}>Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: 20 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 15, fontSize: 14, fontWeight: '500' },
  buttonsRow: { flexDirection: 'row', gap: 12 },
  socialButton: { 
    flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    borderRadius: 12, borderWidth: 1, gap: 10,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.2s ease' },
    })
  },
  socialButtonText: { fontSize: 16, fontWeight: '600' }
});

export default SocialAuthButtons;
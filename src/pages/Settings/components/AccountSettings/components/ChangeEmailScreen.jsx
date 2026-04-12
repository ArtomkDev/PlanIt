import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { db, auth } from '../../../../../config/firebase';
import { useSchedule } from '../../../../../context/ScheduleProvider';
import themes from '../../../../../config/themes';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';
import { t } from '../../../../../utils/i18n';

export default function ChangeEmailScreen() {
  const { global, lang} = useSchedule();
  const navigation = useNavigation();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const user = auth.currentUser;

  const isSocialLogin = useMemo(() => {
    if (!user) return false;
    return user.providerData.some(
      (provider) => provider.providerId === 'google.com' || provider.providerId === 'apple.com'
    );
  }, [user]);

  const handleChangeEmail = async () => {
    if (!password.trim()) {
      setErrorMsg(t('settings.account_settings.change_email_screen.req_password', lang));
      return;
    }
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setErrorMsg(t('settings.account_settings.change_email_screen.req_valid_email', lang));
      return;
    }
    if (newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setErrorMsg(t('settings.account_settings.change_email_screen.req_different_email', lang));
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      await verifyBeforeUpdateEmail(user, newEmail.trim());
      
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { pendingEmail: newEmail.trim().toLowerCase() }, { merge: true });

      const alertMsg = t('settings.account_settings.change_email_screen.alert_msg', lang).replace('{newEmail}', newEmail);

      Alert.alert(
        t('settings.account_settings.change_email_screen.alert_title', lang),
        alertMsg,
        [{ text: t('settings.account_settings.change_email_screen.understood', lang), onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorMsg(t('settings.account_settings.change_email_screen.wrong_password', lang));
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg(t('settings.account_settings.change_email_screen.invalid_email_format', lang));
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg(t('settings.account_settings.change_email_screen.email_in_use', lang));
      } else if (error.code === 'auth/requires-recent-login') {
        setErrorMsg(t('settings.account_settings.change_email_screen.req_recent_login', lang));
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
          <Text style={styles.infoTitle}>{t('settings.account_settings.change_email_screen.social_login_title', lang)}</Text>
          <Text style={styles.infoText}>
            {t('settings.account_settings.change_email_screen.current_email_info', lang)} <Text style={{fontWeight: 'bold'}}>{user.email}</Text>{"\n\n"}
            {t('settings.account_settings.change_email_screen.social_login_desc', lang)}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{t('settings.account_settings.change_email_screen.confirmation_title', lang)}</Text>
            <Text style={styles.infoText}>
              {t('settings.account_settings.change_email_screen.current_email_info', lang)} <Text style={{fontWeight: 'bold'}}>{user.email}</Text>{"\n\n"}
              {t('settings.account_settings.change_email_screen.confirmation_desc', lang)}
            </Text>
          </View>

          <Text style={styles.inputLabel}>{t('settings.account_settings.change_email_screen.current_password_label', lang)}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('settings.account_settings.change_email_screen.current_password_placeholder', lang)}
            placeholderTextColor={themeColors.textColor2}
            secureTextEntry
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMsg) setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.inputLabel}>{t('settings.account_settings.change_email_screen.new_email_label', lang)}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('settings.account_settings.change_email_screen.new_email_placeholder', lang)}
            placeholderTextColor={themeColors.textColor2}
            keyboardType="email-address"
            value={newEmail}
            onChangeText={(text) => {
              setNewEmail(text);
              if (errorMsg) setErrorMsg('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.accent }, loading && styles.actionButtonDisabled]} 
            onPress={handleChangeEmail}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>{t('settings.account_settings.change_email_screen.send_btn', lang)}</Text>
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
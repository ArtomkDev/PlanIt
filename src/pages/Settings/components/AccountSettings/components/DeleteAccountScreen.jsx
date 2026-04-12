import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';

import { auth } from '../../../../../config/firebase';
import { deleteAllUserData, setAccountBeingDeleted } from '../../../../../config/firestore';
import { setIgnoreDeviceRemoval } from '../../../../../utils/deviceService';
import { useSchedule } from '../../../../../context/ScheduleProvider';
import themes from '../../../../../config/themes';
import { t } from '../../../../../utils/i18n';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';

export default function DeleteAccountScreen() {
  const { global, lang} = useSchedule();
  const navigation = useNavigation();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = () => {
    if (!password.trim()) {
      setErrorMsg(t('settings.account_settings.delete_screen.enter_password_req', lang));
      return;
    }

    Alert.alert(
      t('settings.account_settings.delete_screen.alert_title', lang),
      t('settings.account_settings.delete_screen.alert_msg', lang),
      [
        { text: t('common.cancel', lang), style: 'cancel' },
        {
          text: t('settings.account_settings.delete_screen.confirm_btn', lang),
          style: 'destructive',
          onPress: executeDeletion
        }
      ]
    );
  };

  const executeDeletion = async () => {
    setLoading(true);
    setErrorMsg('');

    const user = auth.currentUser;
    if (!user || !user.email) {
      setErrorMsg(t('common.error', lang));
      setLoading(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
    } catch (authError) {
      if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
        setErrorMsg(t('settings.account_settings.delete_screen.wrong_password', lang));
      } else if (authError.code === 'auth/requires-recent-login') {
        setErrorMsg(t('settings.account_settings.delete_screen.requires_recent_login', lang));
      } else {
        setErrorMsg(authError.message);
      }
      setLoading(false);
      return;
    }

    setIgnoreDeviceRemoval(true);

    try {
      await deleteAllUserData(user.uid);
    } catch (dbError) {
      setErrorMsg("Не вдалося видалити ваші дані з сервера. Спробуйте пізніше.");
      setIgnoreDeviceRemoval(false);
      setAccountBeingDeleted(false);
      setLoading(false);
      return;
    }

    try {
      await deleteUser(user);
    } catch (userError) {
      setErrorMsg("Дані видалено, але виникла помилка при видаленні профілю. Зверніться до підтримки.");
      setIgnoreDeviceRemoval(false);
      setAccountBeingDeleted(false);
      setLoading(false);
    }
  };

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>{t('settings.account_settings.delete_screen.danger_zone_title', lang)}</Text>
        <Text style={styles.warningText}>{t('settings.account_settings.delete_screen.warning_desc', lang)}</Text>
      </View>

      <Text style={styles.inputLabel}>{t('settings.account_settings.delete_screen.confirm_password', lang)}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('auth.fields.password', lang)}
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

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <TouchableOpacity 
        style={[styles.deleteButton, loading && styles.deleteButtonDisabled]} 
        onPress={handleDelete}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.deleteButtonText}>{t('settings.account_settings.delete_account', lang)}</Text>
        )}
      </TouchableOpacity>
    </SettingsScreenLayout>
  );
}

const getStyles = (themeColors) => StyleSheet.create({
  contentContainer: { paddingHorizontal: 16, paddingTop: 20 },
  warningBox: { backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.3)', marginBottom: 24 },
  warningTitle: { fontSize: 18, fontWeight: 'bold', color: '#FF3B30', marginBottom: 8 },
  warningText: { fontSize: 14, color: themeColors.textColor, lineHeight: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: themeColors.textColor2, marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: themeColors.backgroundColor2, borderWidth: 1, borderColor: themeColors.borderColor, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: themeColors.textColor, marginBottom: 16 },
  errorText: { color: '#FF3B30', fontSize: 14, marginBottom: 16, marginLeft: 4 },
  deleteButton: { backgroundColor: '#FF3B30', borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
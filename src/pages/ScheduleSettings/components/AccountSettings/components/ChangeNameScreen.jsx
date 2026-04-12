import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { updateProfile } from 'firebase/auth';

import { auth } from '../../../../../../firebase';
import { useSchedule } from '../../../../../context/ScheduleProvider';
import themes from '../../../../../config/themes';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';
import { t } from '../../../../../utils/i18n';

export default function ChangeNameScreen() {
  const { global, lang } = useSchedule();
  const navigation = useNavigation();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const styles = getStyles(themeColors);

  const user = auth.currentUser;
  
  const [newName, setNewName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChangeName = async () => {
    const trimmedName = newName.trim();
    
    if (!trimmedName) {
      setErrorMsg(t('settings.account_settings.change_name.req_empty', lang) || "Ім'я не може бути порожнім.");
      return;
    }
    
    if (trimmedName === user?.displayName) {
      setErrorMsg(t('settings.account_settings.change_name.req_same', lang) || "Введіть нове ім'я, що відрізняється від поточного.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await updateProfile(user, { displayName: trimmedName });
      await user.reload();
      
      Alert.alert(
        t('common.success', lang) || "Успішно",
        t('settings.account_settings.change_name.success_msg', lang) || "Ваше ім'я було успішно оновлено.",
        [{ text: t('common.ok', lang) || "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {t('settings.account_settings.change_name.title', lang) || "Зміна імені"}
        </Text>
        <Text style={styles.infoText}>
          {t('settings.account_settings.change_name.desc', lang) || "Введіть нове ім'я, яке буде відображатися у вашому профілі та видимо для інших (якщо застосовно)."}
        </Text>
      </View>

      <Text style={styles.inputLabel}>
        {t('settings.account_settings.change_name.input_label', lang) || "Нове ім'я"}
      </Text>
      <TextInput
        style={styles.input}
        placeholder={t('settings.account_settings.name', lang) || "Ваше ім'я"}
        placeholderTextColor={themeColors.textColor2}
        value={newName}
        onChangeText={(text) => {
          setNewName(text);
          if (errorMsg) setErrorMsg('');
        }}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
      />

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: themeColors.accentColor }, loading && styles.actionButtonDisabled]} 
        onPress={handleChangeName}
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
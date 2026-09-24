import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { updateProfile } from 'firebase/auth';

import { auth } from '../../../../../config/firebase';
import { useScheduleData } from '../../../../../context/ScheduleProvider';
import MorphingLoader from '../../../../../components/ui/MorphingLoader';
import themes from '../../../../../config/themes';
import SettingsScreenLayout from '../../../../../layouts/SettingsScreenLayout';
import { t } from '../../../../../utils/i18n';

export default function ChangeNameScreen() {
  const { global, lang } = useScheduleData();
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
      setErrorMsg(t('settings.account_settings.change_name.req_empty', lang));
      return;
    }
    
    if (trimmedName === user?.displayName) {
      setErrorMsg(t('settings.account_settings.change_name.req_same', lang));
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await updateProfile(user, { displayName: trimmedName });
      await user.reload();
      
      Alert.alert(
        t('common.success', lang),
        t('settings.account_settings.change_name.success_msg', lang),
        [{ text: t('common.ok', lang), onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setErrorMsg(t('auth.errors.update_failed', lang));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <SettingsScreenLayout contentContainerStyle={styles.contentContainer}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {t('settings.account_settings.change_name.title', lang)}
        </Text>
        <Text style={styles.infoText}>
          {t('settings.account_settings.change_name.desc', lang)}
        </Text>
      </View>

      <Text style={styles.inputLabel}>
        {t("settings.account_settings.name", lang)}
      </Text>
      <TextInput
        style={styles.input}
        accessibilityLabel={t("settings.account_settings.name", lang)}
        placeholder={t('settings.account_settings.name', lang)}
        placeholderTextColor={themeColors.textColor2}
        value={newName}
        onChangeText={(text) => {
          setNewName(text);
          if (errorMsg) setErrorMsg('');
        }}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
        textContentType="name"
        autoComplete="name"
      />

      {errorMsg ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMsg}</Text> : null}

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: themeColors.accentColor }, loading && styles.actionButtonDisabled]} 
        onPress={handleChangeName}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t('common.save', lang)}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {loading ? (
          <View style={styles.loadingButtonContent}>
            <MorphingLoader size={22} />
            <Text style={styles.actionButtonText}>
              {t('common.save', lang)}
            </Text>
          </View>
        ) : (
          <Text style={styles.actionButtonText}>
            {t('common.save', lang)}
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
  loadingButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});

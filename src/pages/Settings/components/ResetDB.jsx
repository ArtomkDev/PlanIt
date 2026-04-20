import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSchedule } from '../../../context/ScheduleProvider';
import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';

const DangerActionCard = ({ title, description, buttonText, onPress, isLoading, disabled, themeColors, isExtreme }) => (
  <View style={[styles.card, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, { color: themeColors.textColor }]}>{title}</Text>
      <Text style={[styles.cardDescription, { color: themeColors.textColor2 }]}>{description}</Text>
    </View>
    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: isExtreme ? '#dc2626' : '#ef4444' },
        (isLoading || disabled) && { opacity: 0.5 }
      ]}
      onPress={onPress}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <Text style={styles.actionButtonText}>{buttonText}</Text>
      )}
    </TouchableOpacity>
  </View>
);

export default function ResetDB() {
  const {
    resetApplication,
    deleteGuestSchedules,
    guest,
    global,
    isLoading,
    lang
  } = useSchedule();

  const [isResetting, setIsResetting] = useState(false);

  const [mode, accent] = global?.theme || ["light", "blue"];
  const themeColors = themes.getColors(mode, accent);

  const handleAction = (actionFn, confirmText) => {
    const title = t('settings.reset_db_screen.alert_title', lang);
    const msg = t('settings.reset_db_screen.alert_msg', lang);

    const onConfirm = async () => {
      setIsResetting(true);
      try {
        await actionFn();
      } catch (error) {
        console.error(error);
      } finally {
        setIsResetting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) onConfirm();
      return;
    }

    Alert.alert(title, msg, [
      { text: t('common.cancel', lang), style: "cancel" },
      { text: confirmText, style: "destructive", onPress: onConfirm },
    ]);
  };

  const handleResetBoth = async () => {
    await resetApplication();
    await deleteGuestSchedules();
  };

  return (
    <SettingsScreenLayout>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        <View style={[styles.warningBanner, { backgroundColor: mode === 'dark' || mode === 'oled' ? '#451a1a' : '#fef2f2', borderColor: '#f87171' }]}>
          <Ionicons name="warning" size={32} color="#ef4444" style={styles.warningIcon} />
          <View style={styles.warningTextContainer}>
            <Text style={[styles.warningTitle, { color: mode === 'dark' || mode === 'oled' ? '#fca5a5' : '#991b1b' }]}>
              {t('settings.reset_db_screen.box_title', lang)}
            </Text>
            <Text style={[styles.warningText, { color: mode === 'dark' || mode === 'oled' ? '#fecaca' : '#b91c1c' }]}>
              {t('settings.reset_db_screen.box_text', lang)}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: themeColors.textColor2 }]}>
          {t('settings.reset_db_screen.data_management', lang)}
        </Text>

        <View style={styles.actionsContainer}>
          {guest ? (
            <DangerActionCard
              title={t('settings.reset_db_screen.button_text', lang)}
              description={t('settings.reset_db_screen.desc_reset_guest', lang)}
              buttonText={t('common.reset', lang)}
              onPress={() => handleAction(resetApplication, t('common.reset', lang))}
              isLoading={isResetting}
              disabled={isLoading}
              themeColors={themeColors}
            />
          ) : (
            <>
              <DangerActionCard
                title={t('settings.reset_db_screen.reset_account_schedules', lang)}
                description={t('settings.reset_db_screen.desc_reset_account', lang)}
                buttonText={t('common.reset', lang)}
                onPress={() => handleAction(resetApplication, t('common.reset', lang))}
                isLoading={isResetting}
                disabled={isLoading}
                themeColors={themeColors}
              />

              <DangerActionCard
                title={t('settings.reset_db_screen.delete_guest_schedules', lang)}
                description={t('settings.reset_db_screen.desc_delete_guest', lang)}
                buttonText={t('common.wipe', lang)}
                onPress={() => handleAction(handleResetBoth, t('common.wipe', lang))}
                isLoading={isResetting}
                disabled={isLoading}
                themeColors={themeColors}
                isExtreme={true}
              />
            </>
          )}
        </View>

      </ScrollView>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  warningBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIcon: {
    marginBottom: 12,
  },
  warningTextContainer: {
    alignItems: 'center',
  },
  warningTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  actionsContainer: {
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    marginBottom: 20,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
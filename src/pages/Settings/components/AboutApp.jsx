import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Share, Alert, Platform } from 'react-native';
import { 
  ShieldCheck, FileText, EnvelopeSimple, 
  ShareNetwork, Globe 
} from 'phosphor-react-native';
import Constants from 'expo-constants';

import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';

import SettingsGroup from '../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../components/ui/SettingsKit/SettingsRow';

export default function AboutApp() {
  const { lang, global } = useSchedule();
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appName = Constants.expoConfig?.name || 'PlanIt';
  
  const WEBSITE_URL = 'https://planit-hub.web.app';
  const SUPPORT_EMAIL = 'planit.app.support@gmail.com';

  const platformName = Platform.select({
    ios: 'iOS',
    android: 'Android',
    web: 'Web',
    default: 'Unknown'
  });

  const openLink = (url) => Linking.openURL(url).catch(() => {
    Alert.alert(t('common.error', lang), "Не вдалося відкрити посилання.");
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Приєднуйся до ${appName} - твій розклад завжди під рукою! ${WEBSITE_URL}`,
        url: WEBSITE_URL,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  return (
    <SettingsScreenLayout title={t('settings.about_screen.title', lang)}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={[styles.appName, { color: themeColors.textColor }]}>{appName}</Text>
        </View>

        <SettingsGroup themeColors={themeColors}>
          <SettingsRow 
            label={t('settings.about_screen.version', lang)} 
            value={appVersion} 
            themeColors={themeColors} 
          />
          <SettingsRow 
            label={t('settings.about_screen.platform', lang)} 
            value={platformName} 
            themeColors={themeColors} 
          />
        </SettingsGroup>

        <SettingsGroup 
          title={t('settings.about_screen.support_section', lang)} 
          themeColors={themeColors}
        >
          <SettingsRow 
            label={t('settings.about_screen.website', lang)} 
            icon={Globe} 
            onPress={() => openLink(WEBSITE_URL)} 
            themeColors={themeColors} 
          />
          <SettingsRow 
            label={t('settings.about_screen.contact_support', lang)} 
            icon={EnvelopeSimple} 
            onPress={() => openLink(`mailto:${SUPPORT_EMAIL}?subject=${appName} Support`)} 
            themeColors={themeColors} 
          />
          <SettingsRow 
            label={t('settings.about_screen.share_app', lang)} 
            icon={ShareNetwork} 
            onPress={handleShare} 
            showCaret={false}
            themeColors={themeColors} 
          />
        </SettingsGroup>

        <SettingsGroup 
          title={t('settings.about_screen.legal_section', lang)} 
          themeColors={themeColors}
        >
          <SettingsRow 
            label={t('settings.about_screen.privacy_policy', lang)} 
            icon={ShieldCheck} 
            onPress={() => openLink(`${WEBSITE_URL}/privacy.html`)} 
            themeColors={themeColors} 
          />
          <SettingsRow 
            label={t('settings.about_screen.terms_of_use', lang)} 
            icon={FileText} 
            onPress={() => openLink(`${WEBSITE_URL}/terms.html`)} 
            themeColors={themeColors} 
          />
        </SettingsGroup>

      </ScrollView>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 16, 
    paddingBottom: 40 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 32, 
    marginTop: 10 
  },
  appName: { 
    fontSize: 34, 
    fontWeight: '800', 
    letterSpacing: 0.5 
  }
});
import React from 'react';
import { View, StyleSheet, Linking, Share, Platform } from 'react-native';
import { 
  Certificate, Cookie, EnvelopeSimple, FileText, Globe, ShareNetwork,
  ShieldCheck, Trash,
} from 'phosphor-react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';

import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import { useScheduleData } from '../../../context/ScheduleProvider';
import { useAppDialog } from '../../../context/AppDialogContext';
import themes from '../../../config/themes';
import { WEBSITE_URL } from '../../../config/website.cjs';
import { t } from '../../../utils/i18n';

import SettingsGroup from '../../../components/ui/SettingsKit/SettingsGroup';
import SettingsRow from '../../../components/ui/SettingsKit/SettingsRow';
import PlanItWordmark from '../../../components/ui/PlanItWordmark';

export default function AboutApp() {
  const { lang, global } = useScheduleData();
  const dialog = useAppDialog();
  const navigation = useNavigation();
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const appName = Constants.expoConfig?.name || 'PlanIt';
  
  const SUPPORT_EMAIL = 'planit.app.support@gmail.com';

  const platformName = Platform.select({
    ios: 'iOS',
    android: 'Android',
    web: 'Web',
    default: 'Unknown'
  });

  const openLink = (url) => Linking.openURL(url).catch(() => {
    dialog.alert({ title: t('common.error', lang), message: t('settings.about_screen.link_open_failed', lang) });
  });

  const openLegalDocument = (documentType) => {
    navigation.navigate('LegalDocument', { documentType });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t('settings.about_screen.share_message', lang, { appName: appName, url: WEBSITE_URL }),
        url: WEBSITE_URL,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  return (
    <SettingsScreenLayout title={t('settings.sections.about', lang)}>
      <View style={styles.container}>
        
        <View style={styles.header}>
          <PlanItWordmark fontSize={52} color={themeColors.textColor} isDark={mode === 'dark' || mode === 'oled'} />
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
            iconWeight="bold"
            onPress={() => openLegalDocument('privacy')}
            themeColors={themeColors} 
          />
          <SettingsRow 
            label={t('settings.about_screen.terms_of_use', lang)} 
            icon={FileText} 
            iconWeight="bold"
            onPress={() => openLegalDocument('terms')}
            themeColors={themeColors} 
          />
          <SettingsRow
            label={t('settings.about_screen.cookie_policy', lang)}
            icon={Cookie}
            iconWeight="bold"
            onPress={() => openLegalDocument('cookies')}
            themeColors={themeColors}
          />
          <SettingsRow
            label={t('settings.about_screen.account_deletion', lang)}
            icon={Trash}
            iconWeight="bold"
            onPress={() => openLegalDocument('delete')}
            themeColors={themeColors}
          />
          <SettingsRow
            label={t('settings.about_screen.open_source_licenses', lang)}
            icon={Certificate}
            iconWeight="bold"
            onPress={() => openLegalDocument('licenses')}
            themeColors={themeColors}
          />
        </SettingsGroup>

      </View>
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
  }
});

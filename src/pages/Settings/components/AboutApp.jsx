import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Share, Alert, Platform } from 'react-native';
import { 
  ShieldCheck, FileText, CaretRight, EnvelopeSimple, 
  ShareNetwork, Globe 
} from 'phosphor-react-native';
import Constants from 'expo-constants';
import { TouchableOpacity } from 'react-native-gesture-handler';

import SettingsScreenLayout from '../../../layouts/SettingsScreenLayout';
import { useSchedule } from '../../../context/ScheduleProvider';
import themes from '../../../config/themes';
import { t } from '../../../utils/i18n';

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

  const InfoRow = ({ label, value }) => (
    <View style={[styles.row, { borderColor: themeColors.borderColor }]}>
      <Text style={[styles.label, { color: themeColors.textColor }]}>{label}</Text>
      <Text style={[styles.value, { color: themeColors.textColor2 }]}>{value}</Text>
    </View>
  );

  const ActionRow = ({ label, icon: Icon, onPress, showArrow = true }) => (
    <TouchableOpacity 
      style={[styles.row, { borderColor: themeColors.borderColor }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Icon size={22} color={themeColors.accentColor} weight="regular" style={{ marginRight: 12 }} />
        <Text style={[styles.label, { color: themeColors.textColor }]}>{label}</Text>
      </View>
      {showArrow ? <CaretRight size={18} color={themeColors.textColor2} weight="bold" /> : null}
    </TouchableOpacity>
  );

  return (
    <SettingsScreenLayout title={t('settings.about_screen.title', lang)}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Чистий заголовок */}
        <View style={styles.header}>
          <Text style={[styles.appName, { color: themeColors.textColor }]}>{appName}</Text>
        </View>

        {/* Блок версії */}
        <View style={[styles.section, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
          <InfoRow label={t('settings.about_screen.version', lang)} value={appVersion} />
          <InfoRow label={t('settings.about_screen.platform', lang)} value={platformName} />
        </View>

        {/* Блок підтримки */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
          {t('settings.about_screen.support_section', lang)}
        </Text>
        <View style={[styles.section, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
          <ActionRow 
            label={t('settings.about_screen.website', lang)} 
            icon={Globe} 
            onPress={() => openLink(WEBSITE_URL)} 
          />
          <ActionRow 
            label={t('settings.about_screen.contact_support', lang)} 
            icon={EnvelopeSimple} 
            onPress={() => openLink(`mailto:${SUPPORT_EMAIL}?subject=${appName} Support`)} 
          />
          <ActionRow 
            label={t('settings.about_screen.share_app', lang)} 
            icon={ShareNetwork} 
            onPress={handleShare} 
            showArrow={false}
          />
        </View>

        {/* Блок документів */}
        <Text style={[styles.sectionTitle, { color: themeColors.textColor2 }]}>
          {t('settings.about_screen.legal_section', lang)}
        </Text>
        <View style={[styles.section, { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor }]}>
          <ActionRow 
            label={t('settings.about_screen.privacy_policy', lang)} 
            icon={ShieldCheck} 
            onPress={() => openLink(`${WEBSITE_URL}/privacy.html`)} 
          />
          <ActionRow 
            label={t('settings.about_screen.terms_of_use', lang)} 
            icon={FileText} 
            onPress={() => openLink(`${WEBSITE_URL}/terms.html`)} 
          />
        </View>

        <View style={styles.bottomPadding} />

      </ScrollView>
    </SettingsScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 30, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 20 },
  appName: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  section: { width: '100%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 24 },
  sectionTitle: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', marginLeft: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth 
  },
  left: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '400' },
  bottomPadding: { height: 40 }
});
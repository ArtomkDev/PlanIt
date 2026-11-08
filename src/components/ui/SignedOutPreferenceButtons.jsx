import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Moon, Sun } from 'phosphor-react-native';
import { WEBSITE_ACCENT_DARK } from './PlanItWordmark';
import { useScheduleActions, useScheduleData } from '../../context/ScheduleProvider';
import useAppTheme from '../../hooks/useAppTheme';
import { SUPPORTED_LANGUAGES, t } from '../../utils/i18n';

// Same controls as the planitflow.com header: the language button names the language it switches to,
// the theme button shows the current theme. Sessions change these in settings instead.
export default function SignedOutPreferenceButtons({ style }) {
  const { lang, user, guest } = useScheduleData();
  const { setSignedOutPreferences } = useScheduleActions();
  const { colors, colorScheme } = useAppTheme();
  if (user || guest) return null;

  const isDark = colorScheme === 'dark';
  const languageIndex = SUPPORTED_LANGUAGES.findIndex(item => item.code === lang);
  const nextLanguage = SUPPORTED_LANGUAGES[(languageIndex + 1) % SUPPORTED_LANGUAGES.length];
  const buttonStyle = [styles.button, { backgroundColor: colors.backgroundColor2, borderColor: colors.borderColor }];

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('share.switch_language', lang, { language: nextLanguage.label })}
        onPress={() => setSignedOutPreferences({ language: nextLanguage.code })} style={buttonStyle}>
        <Text style={[styles.languageText, { color: colors.textColor }]}>{nextLanguage.code.toUpperCase()}</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(isDark ? 'share.switch_to_light' : 'share.switch_to_dark', lang)}
        onPress={() => setSignedOutPreferences({ theme: [isDark ? 'light' : 'dark', 'blue'] })} style={buttonStyle}>
        {isDark ? <Moon size={20} weight="duotone" color={WEBSITE_ACCENT_DARK} accessible={false} />
          : <Sun size={20} weight="duotone" color="#F59E0B" accessible={false} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  languageText: { fontSize: 12, fontWeight: '800' },
});

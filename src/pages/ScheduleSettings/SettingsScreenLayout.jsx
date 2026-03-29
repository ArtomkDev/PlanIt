import React, { useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import SettingsHeader from '../../components/SettingsHeader';
import { t } from '../../utils/i18n';

export default function SettingsScreenLayout({ children, contentContainerStyle }) {
  const { global } = useSchedule();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  const [mode, accent] = global?.theme || ['light', 'blue'];
  const themeColors = themes.getColors(mode, accent);
  const lang = global?.language;

  const routeTitles = {
    'Breaks': t('settings.menu.breaks.title', lang),
    'Weeks': t('settings.menu.weeks.title', lang),
    'StartWeek': t('settings.menu.start_date.title', lang),
    'Subjects': t('settings.menu.subjects.title', lang),
    'Teachers': t('settings.menu.teachers.title', lang),
    'Schedule': t('settings.menu.schedule.title', lang),
    'ScheduleSwitcher': t('settings.menu.global_schedule.title', lang),
    'AutoSave': t('settings.menu.autosave.title', lang),
    'Theme': t('settings.menu.themes.title', lang),
    'Language': t('settings.menu.language.title', lang),
    'ResetDB': t('settings.menu.reset_db.title', lang),
    'DeviceService': t('settings.menu.devices.title', lang),
    'AccountSettings': t('settings.menu.account_settings.title', lang),
    'ChangeEmail': t('settings.account_settings.change_email_screen.title', lang),
    'DeleteAccount': t('settings.account_settings.delete_screen.title', lang),
  };
  
  const title = routeTitles[route.name] || route.name;

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 50 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.backgroundColor }]}>
      <SettingsHeader title={title} scrollY={scrollY} />

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          contentContainerStyle,
          { paddingTop: headerHeight + 20 }
        ]}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 80,
  },
});
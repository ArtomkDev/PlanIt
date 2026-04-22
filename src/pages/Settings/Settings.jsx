import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Table, Palette, Translate, SignIn, UserCircle, Cpu, 
  SignOut, Trash, CaretRight, Info
} from 'phosphor-react-native';
import Constants from 'expo-constants';

import { useSchedule } from '../../context/ScheduleProvider';
import themes from '../../config/themes';
import SettingsHeader from '../../components/ui/SettingsHeader';
import { t } from '../../utils/i18n';
import MorphingLoader from '../../components/ui/MorphingLoader';

export default function Settings({ guest, onExitGuest }) {
  const navigation = useNavigation();
  const { user, global, schedule, lang, safeLogout, tabBarHeight } = useSchedule();
  const insets = useSafeAreaInsets();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const headerHeight = 50 + insets.top;
  const safeTabBarHeight = tabBarHeight || (110 + insets.bottom);
  const bottomPadding = safeTabBarHeight + 32; 
  
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const theme = global?.theme || ['light', 'blue'];
  const [mode, accent] = theme;
  const themeColors = themes.getColors(mode, accent);

  const appVersion = Constants.expoConfig?.version;
  const buildNumber = Constants.nativeBuildVersion;
  const appName = Constants.expoConfig?.name;

  const platformLabel = Platform.select({
    ios: 'iOS',
    android: 'Android',
    web: 'Web'
  });

  const versionParts = [];
  if (appVersion) versionParts.push(appVersion);
  if (buildNumber) versionParts.push(`(${buildNumber})`);
  const versionString = versionParts.join(' ');

  const infoParts = [];
  if (appName) infoParts.push(appName);
  if (versionString) infoParts.push(versionString);
  infoParts.push(platformLabel);

  const infoString = infoParts.join(' • ');

  const handleAuthAction = () => {
    if (guest && onExitGuest) {
      onExitGuest();
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('settings.alerts.logout_title', lang),
      t('settings.alerts.logout_confirm', lang),
      [
        { text: t('common.cancel', lang), style: "cancel" },
        { 
          text: t('settings.menu.logout.title', lang), 
          style: "destructive", 
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              await safeLogout(); 
            } catch (error) {
              console.error("Logout error:", error);
              setIsLoggingOut(false);
              Alert.alert(t('common.error', lang), t('settings.alerts.logout_error', lang));
            }
          } 
        }
      ]
    );
  };

  const sections = useMemo(() => ([
    {
      title: t('settings.sections.schedule', lang),
      data: [
        { 
          label: t('settings.menu.global_schedule.title', lang), 
          screen: 'ScheduleSwitcher', 
          icon: Table, 
          desc: t('settings.menu.global_schedule.desc', lang) 
        },
      ],
    },
    {
      title: t('settings.sections.appearance', lang),
      data: [
        { label: t('settings.menu.themes.title', lang), screen: 'Theme', icon: Palette, desc: t('settings.menu.themes.desc', lang) },
        { 
          label: t('settings.menu.language.title', lang), 
          screen: 'Language', 
          icon: Translate, 
          meta: lang.toUpperCase(), 
          desc: t('settings.menu.language.desc', lang) 
        },
      ],
    },
    {
      title: t('settings.sections.account', lang),
      data: !user ? [
        { label: t('settings.menu.login.title', lang), action: handleAuthAction, icon: SignIn, desc: t('settings.menu.login.desc', lang) },
      ] : [
        { label: t('settings.menu.account_settings.title', lang), screen: 'AccountSettings', icon: UserCircle, desc: t('settings.menu.account_settings.desc', lang) },
        { label: t('settings.menu.devices.title', lang), screen: 'DeviceManagement', icon: Cpu, desc: t('settings.menu.devices.desc', lang) },
        { label: t('settings.menu.logout.title', lang), action: handleSignOut, icon: SignOut, desc: t('settings.menu.logout.desc', lang), danger: true },
      ],
    },
    {
      title: t('settings.sections.about', lang),
      data: [
        { 
          label: t('settings.about_screen.title', lang), 
          screen: 'AboutApp',
          icon: Info, 
          desc: t('settings.about_screen.description', lang) 
        },
      ],
    },
    {
      title: t('settings.sections.danger_zone', lang),
      danger: true,
      data: [
        { label: t('settings.menu.reset_db.title', lang), screen: 'ResetDB', icon: Trash, desc: t('settings.menu.reset_db.desc', lang) },
      ],
    },
  ]), [guest, user, lang]);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const sectionPositions = useRef([]);

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const checkPoint = value + headerHeight + 20; 
      let newActiveIndex = 0;

      for (let i = 0; i < sections.length; i++) {
        const sectionY = sectionPositions.current[i];
        if (typeof sectionY === 'number' && checkPoint >= sectionY) {
          newActiveIndex = i;
        } else {
          break;
        }
      }

      setActiveSectionIndex(prev => (prev !== newActiveIndex ? newActiveIndex : prev));
    });

    return () => scrollY.removeListener(listenerId);
  }, [headerHeight, sections]);

  const renderItem = ({ item }) => {
    const IconComponent = item.icon;
    return (
      <TouchableOpacity
        onPress={() => item.action ? item.action() : navigation.navigate(item.screen, { scheduleId: schedule?.id })}
        style={[
          styles.row,
          { backgroundColor: themeColors.backgroundColor2, borderColor: themeColors.borderColor },
        ]}
      >
        <View style={styles.left}>
          {IconComponent && (
            <IconComponent 
              size={20} 
              color={item.danger ? '#ff453a' : themeColors.textColor2} 
              style={{ marginRight: 10 }} 
              weight="regular"
            />
          )}
          <View style={{ flexShrink: 1 }}>
            <Text style={[
              styles.title, 
              { color: item.danger ? '#ff453a' : themeColors.textColor }
            ]}>
              {item.label}
            </Text>
            {!!item.desc && (
              <Text style={[styles.desc, { color: themeColors.textColor2 }]} numberOfLines={1}>
                {item.desc}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.right}>
          {!!item.meta && <Text style={[styles.meta, { color: themeColors.textColor2 }]}>{item.meta}</Text>}
          <CaretRight size={18} color={themeColors.textColor2} weight="bold" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.backgroundColor }}>
      {isLoggingOut && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <MorphingLoader size={60} />
          <Text style={styles.loadingText}>
            {t('settings.alerts.cloud_saving_warning', lang) || "Зачекайте, дані зберігаються у хмару..."}
          </Text>
        </View>
      )}

      <SettingsHeader 
        title={t('common.settings', lang)} 
        subTitle={sections[activeSectionIndex]?.title || ""} 
        subTitleIndex={activeSectionIndex}
        scrollY={scrollY} 
        showBackButton={false} 
      />

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: headerHeight + 20,
            paddingBottom: bottomPadding
          } 
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== 'web' }
        )}
        scrollEventThrottle={16}
      >
        {sections.map((section, sectionIndex) => (
          <View 
            key={`section-${sectionIndex}`}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              sectionPositions.current[sectionIndex] = layout.y;
            }}
          >
            <Text
              style={[
                styles.sectionHeader,
                { color: section.danger ? '#ff453a' : themeColors.textColor2, backgroundColor: themeColors.backgroundColor },
              ]}
            >
              {section.title}
            </Text>

            {section.data.map((item, itemIndex) => (
              <View key={`item-${sectionIndex}-${itemIndex}`}>
                {renderItem({ item })}
                {itemIndex < section.data.length - 1 && <View style={{ height: 10 }} />}
              </View>
            ))}

            <View style={{ height: 12 }} />
          </View>
        ))}

        <View style={styles.appInfoFooter}>
          <Text style={[styles.appInfoText, { color: themeColors.textColor2 }]}>
            {infoString}
          </Text>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 9999
  },
  loadingText: {
    color: '#fff', 
    marginTop: 16, 
    fontSize: 16, 
    fontWeight: '600'
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600' },
  desc: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 12, marginRight: 6 },
  appInfoFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    paddingBottom: 10,
  },
  appInfoText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
    opacity: 0.7,
  }
});
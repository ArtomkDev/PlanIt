import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ArrowRight, Cookie, X } from 'phosphor-react-native';

import {
  readCookieConsent,
  saveCookieConsent,
  subscribeToCookieConsent,
  subscribeToCookiePreferenceRequests,
} from '../../services/cookieConsentService';
import { t } from '../../utils/i18n';
import { getLegalDocumentBrowserUrl } from '../../utils/legalDocumentLinks';

// planitflow.com palette: the banner looks the same in the web app and on the website.
const PALETTE = {
  light: {
    bg: '#f7f7fa',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f8',
    text: '#18181b',
    muted: '#515866',
    border: '#dfe1e8',
    borderStrong: '#c9cdd7',
    brand: '#f45b8a',
    brandStrong: '#b92f60',
    brandSoft: '#fbe7ee',
    shadow: 'rgba(24, 24, 39, 0.12)',
  },
  dark: {
    bg: '#09090b',
    surface: '#18181b',
    surfaceMuted: '#27272a',
    text: '#fafafa',
    muted: '#b4b4bf',
    border: '#27272a',
    borderStrong: '#3f3f46',
    brand: '#3ef7d2',
    brandStrong: '#82ffe6',
    brandSoft: '#0d332e',
    shadow: 'rgba(0, 0, 0, 0.55)',
  },
};

function ConsentCategory({ title, description, badge, isBadgeActive, palette, isLast }) {
  return (
    <View style={[styles.category, !isLast && { borderBottomWidth: 1, borderBottomColor: palette.borderStrong }]}>
      <View style={styles.categoryText}>
        <Text style={[styles.categoryTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.categoryDescription, { color: palette.muted }]}>{description}</Text>
      </View>
      <Text
        style={[
          styles.badge,
          isBadgeActive
            ? { backgroundColor: palette.brandSoft, color: palette.brandStrong, borderColor: palette.brandSoft }
            : { color: palette.muted, borderColor: palette.borderStrong },
        ]}
      >
        {badge}
      </Text>
    </View>
  );
}

export default function CookieConsentBanner({ lang = 'en', isDark = false }) {
  const { width } = useWindowDimensions();
  const palette = isDark ? PALETTE.dark : PALETTE.light;
  const [consent, setConsent] = useState(() => readCookieConsent());
  const [isPreferenceEditorOpen, setIsPreferenceEditorOpen] = useState(false);
  const appearance = useRef(new Animated.Value(0)).current;
  const isWide = width >= 640;
  const shouldShow = !consent || isPreferenceEditorOpen;

  useEffect(() => {
    const unsubscribeConsent = subscribeToCookieConsent((nextConsent) => {
      setConsent(nextConsent);
    });
    const unsubscribePreferences = subscribeToCookiePreferenceRequests(() => {
      setIsPreferenceEditorOpen(true);
    });

    return () => {
      unsubscribeConsent();
      unsubscribePreferences();
    };
  }, []);

  useEffect(() => {
    if (!shouldShow) {
      appearance.setValue(0);
      return undefined;
    }

    let animation;
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!isActive) return;
      animation = Animated.timing(appearance, {
        toValue: 1,
        duration: reduceMotion ? 0 : 220,
        useNativeDriver: false,
      });
      animation.start();
    });

    return () => {
      isActive = false;
      animation?.stop();
    };
  }, [appearance, shouldShow]);

  const chooseAnalytics = (status) => {
    const nextConsent = saveCookieConsent(status);
    setConsent(nextConsent);
    setIsPreferenceEditorOpen(false);
  };

  if (!shouldShow) return null;

  const analyticsBadge = !consent
    ? t('cookie_consent.analytics_optional', lang)
    : t(consent.analytics === 'granted' ? 'cookie_consent.analytics_on' : 'cookie_consent.analytics_off', lang);

  return (
    <Animated.View
      style={[
        styles.banner,
        isWide ? styles.bannerWide : styles.bannerNarrow,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          boxShadow: `0 28px 70px -36px ${palette.shadow}`,
          opacity: appearance,
          transform: [{ translateY: appearance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: palette.brandSoft }]}>
          <Cookie size={24} weight="duotone" color={palette.brand} />
        </View>
        <Text style={[styles.title, { color: palette.text }]} accessibilityRole="header">
          {t('cookie_consent.title', lang)}
        </Text>
        {consent ? (
          <Pressable
            onPress={() => setIsPreferenceEditorOpen(false)}
            style={({ hovered }) => [styles.closeButton, hovered && { backgroundColor: palette.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('cookie_consent.close', lang)}
          >
            <X size={18} weight="bold" color={palette.muted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.description, { color: palette.muted }]}>
        {t('cookie_consent.description', lang)}
      </Text>

      <View style={[styles.categories, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <ConsentCategory
          title={t('cookie_consent.necessary_title', lang)}
          description={t('cookie_consent.necessary_desc', lang)}
          badge={t('cookie_consent.necessary_badge', lang)}
          isBadgeActive
          palette={palette}
        />
        <ConsentCategory
          title={t('cookie_consent.analytics_title', lang)}
          description={t('cookie_consent.analytics_desc', lang)}
          badge={analyticsBadge}
          isBadgeActive={consent?.analytics === 'granted'}
          palette={palette}
          isLast
        />
      </View>

      <View style={styles.actions}>
        {[
          { status: 'denied', label: t('cookie_consent.reject', lang) },
          { status: 'granted', label: t('cookie_consent.accept', lang) },
        ].map(({ status, label }) => (
          <Pressable
            key={status}
            onPress={() => chooseAnalytics(status)}
            style={({ hovered }) => [
              styles.choiceButton,
              { backgroundColor: hovered ? palette.bg : palette.surfaceMuted, borderColor: palette.borderStrong },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.choiceButtonText, { color: palette.text }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => Linking.openURL(getLegalDocumentBrowserUrl('cookies', lang))}
        style={styles.policyLink}
        accessibilityRole="link"
      >
        {({ hovered }) => {
          const color = hovered ? palette.brandStrong : palette.muted;
          return (
            <>
              <Text style={[styles.policyLinkText, { color }]}>{t('cookie_consent.read_policy', lang)}</Text>
              <ArrowRight size={14} weight="bold" color={color} />
            </>
          );
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'fixed',
    zIndex: 10000,
    maxHeight: 'calc(100dvh - 32px)',
    overflowY: 'auto',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  bannerWide: {
    left: 24,
    bottom: 24,
    width: 420,
  },
  bannerNarrow: {
    left: 16,
    right: 16,
    bottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 36,
    height: 36,
    marginRight: -6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  categories: {
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  categoryText: {
    flex: 1,
    minWidth: 0,
  },
  categoryTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  categoryDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  policyLink: {
    alignSelf: 'flex-start',
    minHeight: 36,
    marginTop: 8,
    marginBottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  policyLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

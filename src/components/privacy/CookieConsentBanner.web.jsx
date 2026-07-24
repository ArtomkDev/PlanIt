import React, { useEffect, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  readCookieConsent,
  saveCookieConsent,
  subscribeToCookieConsent,
  subscribeToCookiePreferenceRequests,
} from '../../services/cookieConsentService';
import { t } from '../../utils/i18n';

const COOKIE_POLICY_URL = 'https://planit-hub.web.app/cookies.html';

export default function CookieConsentBanner({ lang = 'en' }) {
  const { width } = useWindowDimensions();
  const [consent, setConsent] = useState(() => readCookieConsent());
  const [isOpen, setIsOpen] = useState(() => !readCookieConsent());
  const isNarrow = width < 700;

  useEffect(() => {
    const unsubscribeConsent = subscribeToCookieConsent((nextConsent) => {
      setConsent(nextConsent);
      if (!nextConsent) setIsOpen(true);
    });
    const unsubscribePreferences = subscribeToCookiePreferenceRequests(() => {
      setIsOpen(true);
    });

    return () => {
      unsubscribeConsent();
      unsubscribePreferences();
    };
  }, []);

  const chooseAnalytics = (status) => {
    const nextConsent = saveCookieConsent(status);
    setConsent(nextConsent);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <TouchableOpacity
        style={styles.preferencesButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('cookie_consent.settings', lang)}
      >
        <Text style={styles.preferencesButtonText}>
          {t('cookie_consent.settings', lang)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[styles.banner, isNarrow && styles.bannerNarrow]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {t('cookie_consent.title', lang)}
        </Text>
        <Text style={styles.description}>
          {t('cookie_consent.description', lang)}
        </Text>
        <Text style={styles.categoryText}>
          <Text style={styles.categoryLabel}>
            {t('cookie_consent.necessary_title', lang)}:{' '}
          </Text>
          {t('cookie_consent.necessary_desc', lang)}
        </Text>
        <Text style={styles.categoryText}>
          <Text style={styles.categoryLabel}>
            {t('cookie_consent.analytics_title', lang)}:{' '}
          </Text>
          {t('cookie_consent.analytics_desc', lang)}
        </Text>
        {consent ? (
          <Text style={styles.currentChoice}>
            {t('cookie_consent.current_choice', lang)}{' '}
            {t(
              consent.analytics === 'granted'
                ? 'cookie_consent.granted'
                : 'cookie_consent.denied',
              lang,
            )}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => Linking.openURL(COOKIE_POLICY_URL)}
          accessibilityRole="link"
        >
          <Text style={styles.policyLink}>
            {t('cookie_consent.read_policy', lang)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.actions, isNarrow && styles.actionsNarrow]}>
        <TouchableOpacity
          style={styles.choiceButton}
          onPress={() => chooseAnalytics('denied')}
          accessibilityRole="button"
        >
          <Text style={styles.choiceButtonText}>
            {t('cookie_consent.reject', lang)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.choiceButton}
          onPress={() => chooseAnalytics('granted')}
          accessibilityRole="button"
        >
          <Text style={styles.choiceButtonText}>
            {t('cookie_consent.accept', lang)}
          </Text>
        </TouchableOpacity>
        {consent ? (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsOpen(false)}
            accessibilityRole="button"
          >
            <Text style={styles.closeButtonText}>
              {t('cookie_consent.close', lang)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'fixed',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 10000,
    maxWidth: 920,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  bannerNarrow: {
    flexDirection: 'column',
    gap: 14,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  categoryText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 5,
  },
  categoryLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  currentChoice: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 6,
  },
  policyLink: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  actions: {
    width: 190,
    justifyContent: 'center',
    gap: 9,
  },
  actionsNarrow: {
    width: '100%',
  },
  choiceButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  closeButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  preferencesButton: {
    position: 'fixed',
    left: 12,
    bottom: 12,
    zIndex: 9999,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#64748B',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  preferencesButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

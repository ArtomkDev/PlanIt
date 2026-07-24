import {
  getAnalytics,
  isSupported,
  logEvent,
  setAnalyticsCollectionEnabled,
  setConsent,
} from 'firebase/analytics';
import { app } from '../../config/firebase';
import {
  readCookieConsent,
  subscribeToCookieConsent,
} from '../../services/cookieConsentService';

let webAnalytics = null;
let analyticsInitializationPromise = null;
let analyticsAllowed =
  readCookieConsent()?.analytics === 'granted';

const DENIED_CONSENT = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};
const GRANTED_ANALYTICS_CONSENT = {
  ...DENIED_CONSENT,
  analytics_storage: 'granted',
};

const deleteAnalyticsCookies = () => {
  if (typeof document === 'undefined') return;

  document.cookie
    .split(';')
    .map((entry) => entry.split('=')[0]?.trim())
    .filter((name) => /^_(ga|gid|gat|gac_|gcl_)/.test(name))
    .forEach((name) => {
      document.cookie =
        `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      if (typeof location !== 'undefined' && location.hostname) {
        document.cookie =
          `${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=Lax`;
        document.cookie =
          `${name}=; Max-Age=0; Path=/; Domain=.${location.hostname}; SameSite=Lax`;
      }
    });
};

const disableAnalytics = () => {
  analyticsAllowed = false;
  if (webAnalytics) {
    setConsent(DENIED_CONSENT);
    setAnalyticsCollectionEnabled(webAnalytics, false);
  }
  deleteAnalyticsCookies();
};

const initializeAnalyticsIfAllowed = async () => {
  if (!analyticsAllowed) return null;
  if (webAnalytics) {
    setConsent(GRANTED_ANALYTICS_CONSENT);
    setAnalyticsCollectionEnabled(webAnalytics, true);
    return webAnalytics;
  }
  if (analyticsInitializationPromise) return analyticsInitializationPromise;

  analyticsInitializationPromise = (async () => {
    const supported = await isSupported();
    if (!supported || !analyticsAllowed) return null;

    setConsent(GRANTED_ANALYTICS_CONSENT);
    const analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    webAnalytics = analytics;
    return analytics;
  })().catch((error) => {
    console.error('Firebase Analytics initialization failed:', error);
    return null;
  }).finally(() => {
    analyticsInitializationPromise = null;
  });

  return analyticsInitializationPromise;
};

if (analyticsAllowed) {
  initializeAnalyticsIfAllowed();
} else {
  deleteAnalyticsCookies();
}

subscribeToCookieConsent((consent) => {
  analyticsAllowed = consent?.analytics === 'granted';
  if (analyticsAllowed) {
    initializeAnalyticsIfAllowed();
  } else {
    disableAnalytics();
  }
});

export const trackScreenView = (routeName) => {
  if (analyticsAllowed && webAnalytics && routeName) {
    logEvent(webAnalytics, 'screen_view', {
      firebase_screen: routeName,
      firebase_screen_class: routeName,
    });
  }
};

export const trackEvent = (eventName, params = {}) => {
  if (analyticsAllowed && webAnalytics) {
    logEvent(webAnalytics, eventName, params);
  }
};

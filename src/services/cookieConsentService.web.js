const COOKIE_CONSENT_STORAGE_KEY = 'planit_cookie_consent_v1';
const COOKIE_CONSENT_VERSION = 1;
const COOKIE_CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const COOKIE_CONSENT_CHANGED_EVENT = 'planit:cookie-consent-changed';
const COOKIE_PREFERENCES_REQUESTED_EVENT =
  'planit:cookie-preferences-requested';
const MAX_TIMEOUT_MS = 2_147_483_647;

let consentExpiryTimer = null;

const getBrowserWindow = () => (
  typeof window !== 'undefined' ? window : null
);

const isConsentStatus = (value) => (
  value === 'granted' || value === 'denied'
);

const createBrowserEvent = (type, options) => {
  const browserWindow = getBrowserWindow();
  const EventConstructor =
    browserWindow?.CustomEvent
    || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
  return EventConstructor ? new EventConstructor(type, options) : null;
};

const removeStoredConsent = () => {
  try {
    getBrowserWindow()?.localStorage?.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in hardened or private browser contexts.
  }
};

const dispatchConsentChange = (consent) => {
  const browserWindow = getBrowserWindow();
  const event = createBrowserEvent(COOKIE_CONSENT_CHANGED_EVENT, {
    detail: consent,
  });
  if (browserWindow && event) browserWindow.dispatchEvent(event);
};

const clearConsentExpiryTimer = () => {
  const browserWindow = getBrowserWindow();
  if (consentExpiryTimer !== null) {
    browserWindow?.clearTimeout?.(consentExpiryTimer);
    consentExpiryTimer = null;
  }
};

const scheduleConsentExpiry = (consent) => {
  const browserWindow = getBrowserWindow();
  clearConsentExpiryTimer();
  if (!browserWindow?.setTimeout || !consent?.expiresAt) return;

  const remainingMs = consent.expiresAt - Date.now();
  if (remainingMs <= 0) {
    removeStoredConsent();
    dispatchConsentChange(null);
    return;
  }

  consentExpiryTimer = browserWindow.setTimeout(() => {
    consentExpiryTimer = null;
    const currentConsent = readCookieConsent();
    if (!currentConsent) {
      dispatchConsentChange(null);
      return;
    }
    scheduleConsentExpiry(currentConsent);
  }, Math.min(remainingMs, MAX_TIMEOUT_MS));
};

export const readCookieConsent = () => {
  try {
    const rawConsent =
      getBrowserWindow()?.localStorage?.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawConsent) return null;

    const consent = JSON.parse(rawConsent);
    const now = Date.now();
    if (
      consent?.version !== COOKIE_CONSENT_VERSION ||
      !isConsentStatus(consent?.analytics) ||
      !Number.isFinite(consent?.updatedAt) ||
      !Number.isFinite(consent?.expiresAt) ||
      consent.updatedAt > now ||
      consent.expiresAt <= consent.updatedAt ||
      consent.expiresAt - consent.updatedAt > COOKIE_CONSENT_MAX_AGE_MS ||
      consent.expiresAt <= now
    ) {
      removeStoredConsent();
      return null;
    }

    return consent;
  } catch {
    removeStoredConsent();
    return null;
  }
};

export const saveCookieConsent = (analyticsStatus) => {
  if (!isConsentStatus(analyticsStatus)) {
    throw new TypeError('Cookie analytics consent must be granted or denied.');
  }

  const browserWindow = getBrowserWindow();
  const now = Date.now();
  const consent = {
    version: COOKIE_CONSENT_VERSION,
    analytics: analyticsStatus,
    updatedAt: now,
    expiresAt: now + COOKIE_CONSENT_MAX_AGE_MS,
  };

  try {
    browserWindow?.localStorage?.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify(consent),
    );
  } catch {
    // Apply the choice for the current page even if persistence is unavailable.
  }

  scheduleConsentExpiry(consent);
  dispatchConsentChange(consent);
  return consent;
};

export const subscribeToCookieConsent = (listener) => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow || typeof listener !== 'function') return () => {};

  const handleChange = (event) => {
    const consent = event.detail || null;
    scheduleConsentExpiry(consent);
    listener(consent);
  };
  const handleStorageChange = (event) => {
    if (
      event.key !== COOKIE_CONSENT_STORAGE_KEY
      && event.key !== null
    ) {
      return;
    }
    const consent = readCookieConsent();
    scheduleConsentExpiry(consent);
    listener(consent);
  };
  browserWindow.addEventListener(
    COOKIE_CONSENT_CHANGED_EVENT,
    handleChange,
  );
  browserWindow.addEventListener('storage', handleStorageChange);
  scheduleConsentExpiry(readCookieConsent());
  return () => {
    browserWindow.removeEventListener(
      COOKIE_CONSENT_CHANGED_EVENT,
      handleChange,
    );
    browserWindow.removeEventListener('storage', handleStorageChange);
  };
};

export const requestCookiePreferences = () => {
  const browserWindow = getBrowserWindow();
  const event = createBrowserEvent(COOKIE_PREFERENCES_REQUESTED_EVENT);
  if (browserWindow && event) browserWindow.dispatchEvent(event);
};

export const subscribeToCookiePreferenceRequests = (listener) => {
  const browserWindow = getBrowserWindow();
  if (!browserWindow || typeof listener !== 'function') return () => {};

  browserWindow.addEventListener(
    COOKIE_PREFERENCES_REQUESTED_EVENT,
    listener,
  );
  return () => {
    browserWindow.removeEventListener(
      COOKIE_PREFERENCES_REQUESTED_EVENT,
      listener,
    );
  };
};

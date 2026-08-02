import { isRunningInExpoGo } from 'expo';

import { AD_UNITS } from '../../config/ads';

const isExpoGo = isRunningInExpoGo();

const EMPTY_STATE = Object.freeze({
  canRequestAds: false,
  initialized: false,
  privacyOptionsRequired: false,
});

let initializationPromise = null;
let mobileAdsInitializationPromise = null;
let googleMobileAdsModule = null;

const loadGoogleMobileAds = () => {
  if (isExpoGo) return null;

  if (!googleMobileAdsModule) {
    try {
      // Expo Go does not contain this custom native module. Keep the require
      // behind the runtime guard so Metro never evaluates it inside Expo Go.
      googleMobileAdsModule = require('react-native-google-mobile-ads');
    } catch (error) {
      if (__DEV__) {
        console.warn('Google Mobile Ads native module is unavailable:', error);
      }
      return null;
    }
  }

  return googleMobileAdsModule;
};

const normalizeConsentState = (
  consentInfo,
  adsModule,
  initialized = false,
) => ({
  canRequestAds: consentInfo?.canRequestAds === true,
  initialized,
  privacyOptionsRequired:
    consentInfo?.privacyOptionsRequirementStatus ===
    adsModule?.AdsConsentPrivacyOptionsRequirementStatus?.REQUIRED,
});

const startMobileAds = async (consentInfo, adsModule) => {
  if (!consentInfo?.canRequestAds) {
    return normalizeConsentState(consentInfo, adsModule);
  }

  const mobileAds = adsModule.default;

  if (!mobileAdsInitializationPromise) {
    mobileAdsInitializationPromise = (async () => {
      await mobileAds().setRequestConfiguration({
        // PlanIt is an educational organizer used by teenagers as well as adults.
        // Keep every served creative suitable for a general audience.
        maxAdContentRating: adsModule.MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
      });
      await mobileAds().initialize();
    })();
  }

  try {
    await mobileAdsInitializationPromise;
  } catch (error) {
    mobileAdsInitializationPromise = null;
    throw error;
  }

  return normalizeConsentState(consentInfo, adsModule, true);
};

const getConsentFallback = async (adsModule) => {
  try {
    return await adsModule.AdsConsent.getConsentInfo();
  } catch (_error) {
    return null;
  }
};

export const initAds = () => {
  if (isExpoGo || !AD_UNITS.BANNER) {
    return Promise.resolve(EMPTY_STATE);
  }

  const adsModule = loadGoogleMobileAds();
  if (!adsModule) return Promise.resolve(EMPTY_STATE);

  if (!initializationPromise) {
    initializationPromise = (async () => {
      let consentInfo;

      try {
        // gatherConsent refreshes consent information on every cold launch and
        // immediately presents a Google-rendered message when one is required.
        consentInfo = await adsModule.AdsConsent.gatherConsent();
      } catch (error) {
        // UMP may still have a valid decision from the previous session. Google
        // explicitly permits checking canRequestAds after a refresh error.
        consentInfo = await getConsentFallback(adsModule);
        if (!consentInfo?.canRequestAds) {
          throw error;
        }
      }

      return startMobileAds(consentInfo, adsModule);
    })();
  }

  return initializationPromise;
};

export const showAdPrivacyOptions = async () => {
  if (isExpoGo) return EMPTY_STATE;

  const adsModule = loadGoogleMobileAds();
  if (!adsModule) return EMPTY_STATE;

  const consentInfo = await adsModule.AdsConsent.showPrivacyOptionsForm();
  return startMobileAds(consentInfo, adsModule);
};

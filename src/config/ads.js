import { Platform } from 'react-native';

const PROD_BANNER_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const GOOGLE_DEMO_PUBLISHER_PREFIX = 'ca-app-pub-3940256099942544';
const GOOGLE_DEMO_BANNER_IDS = {
  android: 'ca-app-pub-3940256099942544/9214589741',
  ios: 'ca-app-pub-3940256099942544/2435281174',
};

const productionBannerId = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID,
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID,
  default: null,
});

const isForcedTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';
const useTestAds = __DEV__ || isForcedTestAds;
// Store screenshots: start Metro with EXPO_PUBLIC_HIDE_ADS=true to keep a dev build ad-free.
const hideAdsForScreenshots = __DEV__ && process.env.EXPO_PUBLIC_HIDE_ADS === 'true';
const testBannerId = Platform.select({
  ...GOOGLE_DEMO_BANNER_IDS,
  default: null,
});

export const AD_UNITS = {
  // Google's own demo unit is mandatory in development/internal builds. This
  // prevents accidental impressions and clicks against the production account.
  BANNER: hideAdsForScreenshots
    ? null
    : useTestAds
      ? testBannerId
      : PROD_BANNER_ID_PATTERN.test(productionBannerId || '') &&
          !productionBannerId.startsWith(GOOGLE_DEMO_PUBLISHER_PREFIX)
        ? productionBannerId
        : null,
};

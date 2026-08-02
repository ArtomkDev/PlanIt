import { Platform } from 'react-native';

const PROD_BANNER_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const GOOGLE_DEMO_PUBLISHER_PREFIX = 'ca-app-pub-3940256099942544';
const GOOGLE_DEMO_BANNER_IDS = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
};

const productionBannerId = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID,
  ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID,
  default: null,
});

const isForcedTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';
const useTestAds = __DEV__ || isForcedTestAds;
const testBannerId = Platform.select({
  ...GOOGLE_DEMO_BANNER_IDS,
  default: null,
});

export const AD_UNITS = {
  // Google's own demo unit is mandatory in development/internal builds. This
  // prevents accidental impressions and clicks against the production account.
  BANNER: useTestAds
    ? testBannerId
    : PROD_BANNER_ID_PATTERN.test(productionBannerId || '') &&
        !productionBannerId.startsWith(GOOGLE_DEMO_PUBLISHER_PREFIX)
      ? productionBannerId
      : null,
};

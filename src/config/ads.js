import { Platform } from 'react-native';

const GOOGLE_TEST_BANNER_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_TEST_ANDROID_BANNER_ID,
  ios: process.env.EXPO_PUBLIC_ADMOB_TEST_IOS_BANNER_ID,
  default: 'test',
});

const ANDROID_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID;
const IOS_BANNER_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID || '';

const isForcedTestAds = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';

export const AD_UNITS = {
  BANNER: (__DEV__ || isForcedTestAds)
    ? GOOGLE_TEST_BANNER_ID
    : Platform.select({
        android: ANDROID_BANNER_ID,
        ios: IOS_BANNER_ID,
        default: GOOGLE_TEST_BANNER_ID,
      }),
};
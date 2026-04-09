import { Platform } from 'react-native';

const GOOGLE_TEST_BANNER_ID = Platform.select({
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
  default: 'test',
});

const ANDROID_BANNER_ID = 'ca-app-pub-7165910523854581/2920026625';
const IOS_BANNER_ID = ''; 

export const AD_UNITS = {
  BANNER: __DEV__
    ? GOOGLE_TEST_BANNER_ID
    : Platform.select({
        android: ANDROID_BANNER_ID,
        ios: IOS_BANNER_ID,
        default: GOOGLE_TEST_BANNER_ID,
      }),
};
import Constants from 'expo-constants';

export const initAds = () => {
  const isExpoGo = Constants.appOwnership === 'expo';
  
  if (!isExpoGo) {
    try {
      const mobileAds = require('react-native-google-mobile-ads').default;
      mobileAds()
        .initialize()
        .then(adapterStatuses => {
          console.log('AdMob successfully initialized', adapterStatuses);
        })
        .catch(error => {
          console.warn('AdMob initialization failed', error);
        });
    } catch (e) {
      console.warn('Google Mobile Ads module not found', e);
    }
  }
};
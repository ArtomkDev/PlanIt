import Constants, { ExecutionEnvironment } from 'expo-constants';

export const initAds = () => {
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (isExpoGo) {
    console.log('Ads initialization skipped (Expo Go)');
    return;
  }

  try {
    const mobileAds = require('react-native-google-mobile-ads').default;
    
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('Ads initialized successfully');
      });
  } catch (error) {
    console.error('Ad initialization error:', error);
  }
};
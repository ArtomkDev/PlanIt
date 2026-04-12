import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let analyticsModule = null;

if (!isExpoGo) {
  try {
    const rnFirebaseAnalytics = require('@react-native-firebase/analytics');
    analyticsModule = rnFirebaseAnalytics.default || rnFirebaseAnalytics;
  } catch (error) {
    console.warn('Firebase Analytics native module load failed:', error);
  }
}

export const trackScreenView = async (screenName) => {
  if (isExpoGo || !analyticsModule) return;

  try {
    await analyticsModule().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (error) {
    console.error('Analytics screen view error:', error);
  }
};

export const trackEvent = async (eventName, params = {}) => {
  if (isExpoGo || !analyticsModule) return;

  try {
    await analyticsModule().logEvent(eventName, params);
  } catch (error) {
    console.error('Analytics event error:', error);
  }
};
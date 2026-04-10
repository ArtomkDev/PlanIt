import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const trackScreenView = async (screenName) => {
  if (isExpoGo) {
    console.log(`Analytics skipped in Expo Go. Screen: ${screenName}`);
    return;
  }

  try {
    const analytics = require('@react-native-firebase/analytics').default;
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (error) {
    console.error('Analytics screen view error:', error);
  }
};

export const trackEvent = async (eventName, params = {}) => {
  if (isExpoGo) {
    console.log(`Analytics skipped in Expo Go. Event: ${eventName}`);
    return;
  }

  try {
    const analytics = require('@react-native-firebase/analytics').default;
    await analytics().logEvent(eventName, params);
  } catch (error) {
    console.error('Analytics event error:', error);
  }
};
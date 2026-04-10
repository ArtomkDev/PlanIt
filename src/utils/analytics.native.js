import analytics from '@react-native-firebase/analytics';

export const trackScreenView = async (routeName) => {
  try {
    await analytics().logScreenView({
      screen_name: routeName,
      screen_class: routeName,
    });
  } catch (error) {
    console.warn('Native Analytics Error:', error);
  }
};

export const trackEvent = async (eventName, params = {}) => {
  try {
    await analytics().logEvent(eventName, params);
  } catch (error) {
    console.warn('Native Analytics Error:', error);
  }
};
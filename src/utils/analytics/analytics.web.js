import { getAnalytics, logEvent, isSupported } from 'firebase/analytics';
import { app } from '../../../firebase';

let webAnalytics = null;

isSupported().then((supported) => {
  if (supported) {
    webAnalytics = getAnalytics(app);
  }
}).catch(console.error);

export const trackScreenView = (routeName) => {
  if (webAnalytics && routeName) {
    logEvent(webAnalytics, 'screen_view', {
      firebase_screen: routeName,
      firebase_screen_class: routeName,
    });
  }
};

export const trackEvent = (eventName, params = {}) => {
  if (webAnalytics) {
    logEvent(webAnalytics, eventName, params);
  }
};
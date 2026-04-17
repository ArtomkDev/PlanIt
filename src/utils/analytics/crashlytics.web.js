export const logCrashlyticsError = (error, context = '') => {
  console.error(`[Web Crashlytics Dummy] Error in ${context}:`, error);
};

export const setCrashlyticsUser = (userId) => {
  console.log(`[Web Crashlytics Dummy] User set: ${userId}`);
};

export const logCrashlyticsMessage = (message) => {
  console.log(`[Web Crashlytics Dummy] Log: ${message}`);
};

export const crashAppToTest = () => {
  console.warn('[Web Crashlytics Dummy] Test crash triggered (Ignored on Web)');
};

export const initGlobalErrorHandling = () => {
  console.log('[Web Crashlytics Dummy] Global error handling initialized');
};
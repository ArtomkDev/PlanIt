export const logCrashlyticsError = (error, context = '') => {
  if (__DEV__) console.error(`Error in ${context}:`, error);
};

export const setCrashlyticsUser = () => {};

export const logCrashlyticsMessage = () => {};

export const crashAppToTest = () => {};

export const initGlobalErrorHandling = () => {};

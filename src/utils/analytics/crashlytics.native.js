import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let crashlyticsModule = null;

if (!isExpoGo) {
  try {
    const rnFirebaseCrashlytics = require('@react-native-firebase/crashlytics');
    crashlyticsModule = rnFirebaseCrashlytics.default || rnFirebaseCrashlytics;
  } catch (error) {
    console.warn('Firebase Crashlytics native module load failed:', error);
  }
}

export const logCrashlyticsError = (error, context = 'UnknownContext') => {
  if (isExpoGo || !crashlyticsModule) return;

  try {
    crashlyticsModule().setAttribute('error_context', context);
    
    if (error instanceof Error) {
      crashlyticsModule().recordError(error);
    } else {
      crashlyticsModule().recordError(new Error(String(error)));
    }
  } catch (err) {
    console.warn('Failed to log error to Crashlytics:', err); 
  }
};

export const setCrashlyticsUser = async (userId) => {
  if (isExpoGo || !crashlyticsModule) return;
  try {
    await crashlyticsModule().setUserId(userId);
  } catch (error) {
    console.warn('Crashlytics setUserId error:', error);
  }
};

export const logCrashlyticsMessage = (message) => {
  if (isExpoGo || !crashlyticsModule) return;
  crashlyticsModule().log(message);
};

export const crashAppToTest = () => {
  if (isExpoGo || !crashlyticsModule) return;
  crashlyticsModule().crash();
};

export const initGlobalErrorHandling = () => {
  if (isExpoGo || !crashlyticsModule) return;

  const originalConsoleError = console.error;
  console.error = (...args) => {
    try {
      const errorObj = args.find(a => a instanceof Error);
      const errorMessage = args.map(a => (typeof a === 'object' && !(a instanceof Error) ? JSON.stringify(a) : String(a))).join(' ');
      
      const finalError = errorObj || new Error(errorMessage);
      logCrashlyticsError(finalError, 'global_console_error');
    } catch (e) {}
    
    originalConsoleError(...args);
  };

  if (global.ErrorUtils) {
    const defaultErrorHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logCrashlyticsError(error, isFatal ? 'fatal_js_error' : 'unhandled_js_error');
      
      if (defaultErrorHandler) {
        defaultErrorHandler(error, isFatal);
      }
    });
  }
};
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let crashlyticsModule = null;
let hasPatchedConsoleError = false;
let hasPatchedGlobalHandler = false;
const consoleErrorReports = new Map();
let consoleErrorWindowStart = 0;
let consoleErrorWindowCount = 0;

const CONSOLE_ERROR_DEDUPE_MS = 60 * 1000;
const CONSOLE_ERROR_RATE_LIMIT = 10;
const CONSOLE_ERROR_RATE_WINDOW_MS = 60 * 1000;
const MAX_MESSAGE_LENGTH = 500;
const MAX_OBJECT_KEYS = 8;
const MAX_ARRAY_ITEMS = 5;
const SENSITIVE_KEY_RE = /(email|token|password|passwd|secret|credential|apikey|api_key|authorization|auth|key)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_TOKEN_RE = /\b[A-Za-z0-9._~+/=-]{32,}\b/g;

if (!isExpoGo) {
  try {
    const rnFirebaseCrashlytics = require('@react-native-firebase/crashlytics');
    crashlyticsModule = rnFirebaseCrashlytics.default || rnFirebaseCrashlytics;
  } catch (error) {
    console.warn('Firebase Crashlytics native module load failed:', error);
  }
}

const sanitizeText = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  return String(value || "")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(LONG_TOKEN_RE, "[REDACTED_TOKEN]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, maxLength);
};

const summarizeValue = (value, depth = 0) => {
  if (value instanceof Error) {
    return `${sanitizeText(value.name || "Error", 80)}: ${sanitizeText(value.message)}`;
  }

  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === "function") return "[Function]";
  if (depth >= 2) return Array.isArray(value) ? "[Array]" : "[Object]";

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => summarizeValue(item, depth + 1));
    const suffix = value.length > MAX_ARRAY_ITEMS ? ", ..." : "";
    return `[${items.join(", ")}${suffix}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
    const parts = keys.map((key) => {
      const safeKey = sanitizeText(key, 60);
      const safeValue = SENSITIVE_KEY_RE.test(key)
        ? "[REDACTED]"
        : summarizeValue(value[key], depth + 1);
      return `${safeKey}: ${safeValue}`;
    });
    const suffix = Object.keys(value).length > MAX_OBJECT_KEYS ? ", ..." : "";
    return `{${parts.join(", ")}${suffix}}`;
  }

  return sanitizeText(value);
};

const createSanitizedError = (error, fallbackMessage = "Unknown error") => {
  if (error instanceof Error) {
    const safeError = new Error(sanitizeText(error.message || fallbackMessage));
    safeError.name = sanitizeText(error.name || "Error", 80);
    return safeError;
  }

  return new Error(sanitizeText(summarizeValue(error) || fallbackMessage));
};

const shouldReportConsoleError = (message) => {
  const now = Date.now();

  if (now - consoleErrorWindowStart > CONSOLE_ERROR_RATE_WINDOW_MS) {
    consoleErrorWindowStart = now;
    consoleErrorWindowCount = 0;
  }

  if (consoleErrorWindowCount >= CONSOLE_ERROR_RATE_LIMIT) return false;

  const key = message.slice(0, 160);
  const lastReportedAt = consoleErrorReports.get(key) || 0;
  if (now - lastReportedAt < CONSOLE_ERROR_DEDUPE_MS) return false;

  consoleErrorReports.set(key, now);
  consoleErrorWindowCount += 1;

  if (consoleErrorReports.size > 100) {
    const cutoff = now - CONSOLE_ERROR_DEDUPE_MS;
    for (const [entryKey, timestamp] of consoleErrorReports.entries()) {
      if (timestamp < cutoff) consoleErrorReports.delete(entryKey);
    }
  }

  return true;
};

export const logCrashlyticsError = (error, context = 'UnknownContext') => {
  if (isExpoGo || !crashlyticsModule) return;

  try {
    crashlyticsModule().setAttribute('error_context', sanitizeText(context, 100));
    crashlyticsModule().recordError(createSanitizedError(error));
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
  crashlyticsModule().log(sanitizeText(message));
};

export const crashAppToTest = () => {
  if (isExpoGo || !crashlyticsModule) return;
  crashlyticsModule().crash();
};

export const initGlobalErrorHandling = () => {
  if (isExpoGo || !crashlyticsModule) return;

  if (!hasPatchedConsoleError) {
    hasPatchedConsoleError = true;
    const originalConsoleError = console.error;
    console.error = (...args) => {
      try {
        const errorObj = args.find(a => a instanceof Error);
        const errorMessage = args.map((arg) => summarizeValue(arg)).join(' ').slice(0, MAX_MESSAGE_LENGTH);

        if (shouldReportConsoleError(errorMessage)) {
          logCrashlyticsError(errorObj || new Error(errorMessage), 'global_console_error');
        }
      } catch (e) {}

      originalConsoleError(...args);
    };
  }

  if (global.ErrorUtils && !hasPatchedGlobalHandler) {
    hasPatchedGlobalHandler = true;
    const defaultErrorHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      logCrashlyticsError(error, isFatal ? 'fatal_js_error' : 'unhandled_js_error');
      
      if (defaultErrorHandler) {
        defaultErrorHandler(error, isFatal);
      }
    });
  }
};

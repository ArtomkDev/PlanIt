const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const compileCommonJsModule = (filePath, loadMock) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(filePath, module);
  testModule.filename = filePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(filePath));

  const originalLoad = Module._load;
  Module._load = loadMock || originalLoad;
  try {
    testModule._compile(transformed, filePath);
    return testModule.exports;
  } finally {
    Module._load = originalLoad;
  }
};

const createBrowserMock = ({ useTimers = false } = {}) => {
  const storage = new Map();
  const listeners = new Map();
  const browserWindow = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    addEventListener: (name, listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener: (name, listener) => {
      listeners.get(name)?.delete(listener);
    },
    dispatchEvent: (event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    ...(useTimers
      ? {
          setTimeout,
          clearTimeout,
        }
      : {}),
  };

  return { browserWindow, storage };
};

test('stores a generic consent choice, publishes changes, and expires it', () => {
  const servicePath = path.resolve(
    __dirname,
    '../src/services/cookieConsentService.web.js',
  );
  const { browserWindow, storage } = createBrowserMock();
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  global.window = browserWindow;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  try {
    const service = compileCommonJsModule(servicePath);
    const observed = [];
    const unsubscribe = service.subscribeToCookieConsent((value) => {
      observed.push(value);
    });
    const consent = service.saveCookieConsent('denied');

    assert.equal(consent.analytics, 'denied');
    assert.equal(consent.version, 1);
    assert.ok(consent.expiresAt > consent.updatedAt);
    assert.deepEqual(service.readCookieConsent(), consent);
    assert.deepEqual(observed, [consent]);

    const stored = JSON.parse(storage.get('planit_cookie_consent_v1'));
    stored.analytics = 'granted';
    storage.set('planit_cookie_consent_v1', JSON.stringify(stored));
    browserWindow.dispatchEvent({
      type: 'storage',
      key: 'planit_cookie_consent_v1',
    });
    assert.equal(observed.at(-1).analytics, 'granted');

    stored.expiresAt = Date.now() - 1;
    storage.set('planit_cookie_consent_v1', JSON.stringify(stored));
    assert.equal(service.readCookieConsent(), null);
    assert.equal(storage.has('planit_cookie_consent_v1'), false);
    unsubscribe();
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
});

test('expires a persisted choice during an open browser session', async () => {
  const servicePath = path.resolve(
    __dirname,
    '../src/services/cookieConsentService.web.js',
  );
  const { browserWindow, storage } = createBrowserMock({ useTimers: true });
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  global.window = browserWindow;
  global.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  };

  try {
    const service = compileCommonJsModule(servicePath);
    const observed = [];
    const unsubscribe = service.subscribeToCookieConsent((value) => {
      observed.push(value);
    });
    const now = Date.now();
    storage.set('planit_cookie_consent_v1', JSON.stringify({
      version: 1,
      analytics: 'granted',
      updatedAt: now,
      expiresAt: now + 25,
    }));
    browserWindow.dispatchEvent({
      type: 'storage',
      key: 'planit_cookie_consent_v1',
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(storage.has('planit_cookie_consent_v1'), false);
    assert.equal(observed.at(-1), null);
    unsubscribe();
  } finally {
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
});

test('does not initialize web Analytics before consent and disables it on withdrawal', async () => {
  const analyticsPath = path.resolve(
    __dirname,
    '../src/utils/analytics/analytics.web.js',
  );
  const calls = [];
  let consentListener = null;
  const analyticsInstance = { name: 'analytics' };
  const firebaseAnalytics = {
    getAnalytics: () => {
      calls.push(['getAnalytics']);
      return analyticsInstance;
    },
    isSupported: async () => {
      calls.push(['isSupported']);
      return true;
    },
    logEvent: (...args) => calls.push(['logEvent', ...args]),
    setAnalyticsCollectionEnabled: (...args) => {
      calls.push(['setAnalyticsCollectionEnabled', ...args]);
    },
    setConsent: (value) => calls.push(['setConsent', value]),
  };
  const consentService = {
    readCookieConsent: () => null,
    subscribeToCookieConsent: (listener) => {
      consentListener = listener;
      return () => {};
    },
  };
  const previousDocument = global.document;
  const previousLocation = global.location;
  global.document = { cookie: '' };
  global.location = { hostname: 'planit-hub.web.app' };

  const originalLoad = Module._load;
  const loadMock = function loadMock(request, parent, isMain) {
    if (request === 'firebase/analytics') return firebaseAnalytics;
    if (request === '../../config/firebase') return { app: {} };
    if (request === '../../services/cookieConsentService') {
      return consentService;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const analytics = compileCommonJsModule(analyticsPath, loadMock);
    assert.deepEqual(calls, []);

    consentListener({ analytics: 'granted' });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(calls[0][0], 'isSupported');
    assert.equal(calls[1][0], 'setConsent');
    assert.equal(calls[1][1].analytics_storage, 'granted');
    assert.equal(calls[1][1].ad_storage, 'denied');
    assert.equal(calls[2][0], 'getAnalytics');

    analytics.trackScreenView('Settings');
    assert.equal(calls.at(-1)[0], 'logEvent');

    consentListener({ analytics: 'denied' });
    assert.ok(
      calls.some(
        ([name, _instance, enabled]) =>
          name === 'setAnalyticsCollectionEnabled' && enabled === false,
      ),
    );
    const logCount = calls.filter(([name]) => name === 'logEvent').length;
    analytics.trackScreenView('Account');
    assert.equal(
      calls.filter(([name]) => name === 'logEvent').length,
      logCount,
    );

    const enableCountBeforeRegrant = calls.filter(
      ([name, _instance, enabled]) =>
        name === 'setAnalyticsCollectionEnabled' && enabled === true,
    ).length;
    consentListener({ analytics: 'granted' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      calls.filter(
        ([name, _instance, enabled]) =>
          name === 'setAnalyticsCollectionEnabled' && enabled === true,
      ).length,
      enableCountBeforeRegrant + 1,
    );
    analytics.trackScreenView('Schedule');
    assert.equal(
      calls.filter(([name]) => name === 'logEvent').length,
      logCount + 1,
    );
  } finally {
    global.document = previousDocument;
    global.location = previousLocation;
  }
});

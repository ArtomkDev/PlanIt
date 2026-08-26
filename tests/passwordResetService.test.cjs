const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/auth/passwordResetService.js',
);

const loadPasswordResetService = ({ currentUser = null } = {}) => {
  const calls = {
    confirmations: [],
    resetEmails: [],
    verifications: [],
    signOuts: 0,
  };
  const auth = { currentUser, languageCode: null };
  const firebaseAuth = {
    confirmPasswordReset: async (_auth, oobCode, password) => {
      calls.confirmations.push({ oobCode, password });
    },
    sendPasswordResetEmail: async (_auth, email, settings) => {
      calls.resetEmails.push({ email, settings });
    },
    verifyPasswordResetCode: async (_auth, oobCode) => {
      calls.verifications.push(oobCode);
      return 'person@example.com';
    },
    signOut: async () => {
      calls.signOuts += 1;
    },
  };

  const source = fs.readFileSync(servicePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: servicePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const testModule = new Module(servicePath, module);
  testModule.filename = servicePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(servicePath));

  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === '../config/firebase') return { auth };
    if (request === 'firebase/auth') return firebaseAuth;
    if (request === 'expo-linking') {
      return { createURL: (route) => `planit://${route.replace(/^\//, '')}` };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    testModule._compile(transformed, servicePath);
    return { service: testModule.exports, auth, calls };
  } finally {
    Module._load = originalLoad;
  }
};

test('detects whether the account already has a password provider', () => {
  const { service } = loadPasswordResetService();

  assert.equal(service.hasPasswordProvider({
    providerData: [{ providerId: 'google.com' }],
  }), false);
  assert.equal(service.hasPasswordProvider({
    providerData: [
      { providerId: 'google.com' },
      { providerId: 'password' },
    ],
  }), true);
});

test('sends a password reset link that is handled inside the app', async () => {
  const previousDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'planit-test.firebaseapp.com';

  try {
    const user = {
      email: 'person@example.com',
      providerData: [{ providerId: 'google.com' }],
    };
    const { service, auth, calls } = loadPasswordResetService({ currentUser: user });

    const email = await service.requestPasswordResetEmail({ user, lang: 'uk' });

    assert.equal(email, user.email);
    assert.equal(auth.languageCode, 'uk');
    assert.equal(calls.resetEmails.length, 1);
    assert.equal(calls.resetEmails[0].email, user.email);
    assert.equal(calls.resetEmails[0].settings.handleCodeInApp, true);
    assert.equal(
      calls.resetEmails[0].settings.url,
      'https://planit-test.firebaseapp.com/?passwordAction=resetPassword&lang=uk',
    );
  } finally {
    if (previousDomain === undefined) {
      delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
    } else {
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = previousDomain;
    }
  }
});

test('extracts reset codes from direct and nested Firebase action links', () => {
  const { service } = loadPasswordResetService();
  const direct = 'https://example.com/action?mode=resetPassword&oobCode=abc123';
  const nested = `https://example.com/__/auth/links?link=${encodeURIComponent(direct)}`;

  assert.deepEqual(service.parsePasswordResetLink(direct), {
    mode: 'resetPassword',
    oobCode: 'abc123',
    purpose: 'resetPassword',
    lang: 'en',
  });
  assert.equal(
    service.createPasswordResetNavigationUrl(nested),
    'planit://password-reset?oobCode=abc123&purpose=resetPassword&lang=en',
  );
  assert.equal(
    service.parsePasswordResetLink(
      'https://example.com/action?mode=verifyEmail&oobCode=abc123',
    ),
    null,
  );
});

test('preserves add-password purpose and language from the continue URL', () => {
  const { service } = loadPasswordResetService();
  const continueUrl =
    'https://planit.example/password-reset?passwordAction=addPassword&lang=uk';
  const actionUrl =
    'https://planit.example/action?mode=resetPassword&oobCode=add-code&continueUrl='
    + encodeURIComponent(continueUrl);
  const nested =
    'https://planit.example/__/auth/links?link=' + encodeURIComponent(actionUrl);

  assert.deepEqual(service.parsePasswordResetLink(nested), {
    mode: 'resetPassword',
    oobCode: 'add-code',
    purpose: 'addPassword',
    lang: 'uk',
  });
  assert.equal(
    service.createPasswordResetNavigationUrl(nested),
    'planit://password-reset?oobCode=add-code&purpose=addPassword&lang=uk',
  );
});

test('requests the authenticated custom add-password email endpoint', async () => {
  const previousProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const previousEndpoint = process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'planit-test';
  delete process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT;

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 204 };
  };

  try {
    const user = {
      email: 'person@example.com',
      providerData: [{ providerId: 'google.com' }],
      getIdToken: async () => 'firebase-id-token',
    };
    const { service } = loadPasswordResetService({ currentUser: user });
    const email = await service.requestAddPasswordEmail({ user, lang: 'uk-UA' });

    assert.equal(email, user.email);
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      'https://europe-west1-planit-test.cloudfunctions.net/sendAddPasswordEmail',
    );
    assert.equal(
      requests[0].options.headers.Authorization,
      'Bearer firebase-id-token',
    );
    assert.deepEqual(JSON.parse(requests[0].options.body), { locale: 'uk' });
  } finally {
    global.fetch = previousFetch;
    if (previousProjectId === undefined) {
      delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    } else {
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = previousProjectId;
    }
    if (previousEndpoint === undefined) {
      delete process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT;
    } else {
      process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT = previousEndpoint;
    }
  }
});

test('normalizes public Cloud Function errors for the client UI', async () => {
  const previousEndpoint = process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT =
    'https://example.com/send-add-password';
  global.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: 'too_many_requests' }),
  });

  try {
    const user = {
      email: 'person@example.com',
      providerData: [{ providerId: 'google.com' }],
      getIdToken: async () => 'firebase-id-token',
    };
    const { service } = loadPasswordResetService({ currentUser: user });
    await assert.rejects(
      () => service.requestAddPasswordEmail({ user, lang: 'en' }),
      (error) => error.code === 'password-reset/too-many-requests',
    );
  } finally {
    global.fetch = previousFetch;
    if (previousEndpoint === undefined) {
      delete process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT;
    } else {
      process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT = previousEndpoint;
    }
  }
});

test('never calls the add-password endpoint for an existing password account', async () => {
  const user = {
    email: 'person@example.com',
    providerData: [{ providerId: 'password' }],
  };
  const { service } = loadPasswordResetService({ currentUser: user });

  await assert.rejects(
    () => service.requestAddPasswordEmail({ user, lang: 'en' }),
    (error) => error.code === 'password-reset/password-already-exists',
  );
});

test('verifies the email code and ends a stale session after reset', async () => {
  const user = {};
  const { service, calls } = loadPasswordResetService({ currentUser: user });

  const email = await service.verifyPasswordResetRequest('verified-code');
  await service.completePasswordReset('verified-code', 'new-secret');

  assert.equal(email, 'person@example.com');
  assert.deepEqual(calls.verifications, ['verified-code']);
  assert.deepEqual(calls.confirmations, [{
    oobCode: 'verified-code',
    password: 'new-secret',
  }]);
  assert.equal(calls.signOuts, 1);
});

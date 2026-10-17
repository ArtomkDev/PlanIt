const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/auth/accountEmailService.js',
);

const loadAccountEmailService = ({ currentUser = null } = {}) => {
  const calls = {
    confirmations: [],
    verifications: [],
    signOuts: 0,
  };
  const auth = { currentUser };
  const firebaseAuth = {
    confirmPasswordReset: async (_auth, oobCode, password) => {
      calls.confirmations.push({ oobCode, password });
    },
    sendPasswordResetEmail: async () => {
      throw new Error('The legacy Firebase email sender must not be used.');
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
  const { service } = loadAccountEmailService();

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

const configureResetEndpoint = (t, endpoint = undefined) => {
  const values = {
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'planit-test',
    EXPO_PUBLIC_PASSWORD_RESET_EMAIL_ENDPOINT: endpoint,
  };
  for (const [key, value] of Object.entries(values)) {
    const previousValue = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    t.after(() => {
      if (previousValue === undefined) delete process.env[key];
      else process.env[key] = previousValue;
    });
  }
};

test('login recovery and settings reset use the branded email endpoint', async (t) => {
  configureResetEndpoint(t);
  const requests = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 204 };
  });
  const user = { email: 'person@example.com' };
  const { service } = loadAccountEmailService({ currentUser: user });

  assert.equal(await service.requestPasswordResetEmailForEmail({
    email: ' person@example.com ',
    lang: 'uk-UA',
  }), user.email);
  assert.equal(await service.requestPasswordResetEmail({ user, lang: 'en' }), user.email);

  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, 'https://europe-west1-planit-test.cloudfunctions.net/sendPasswordResetEmail');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, undefined);
  }
  assert.deepEqual(JSON.parse(requests[0].options.body), { email: user.email, locale: 'uk' });
  assert.deepEqual(JSON.parse(requests[1].options.body), { email: user.email, locale: 'en' });
});

test('reset service rejects missing email without sending a request', async (t) => {
  const fetch = t.mock.method(global, 'fetch');
  const { service } = loadAccountEmailService();

  await assert.rejects(service.requestPasswordResetEmailForEmail({ email: ' ' }), {
    code: 'account-email/email-unavailable',
  });
  await assert.rejects(service.requestPasswordResetEmail(), {
    code: 'account-email/email-unavailable',
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test('reset service requires HTTPS and never falls back to Firebase mail', async (t) => {
  configureResetEndpoint(t, 'http://example.com/send-reset');
  const fetch = t.mock.method(global, 'fetch');
  const { service } = loadAccountEmailService();

  await assert.rejects(service.requestPasswordResetEmailForEmail({ email: 'person@example.com' }), {
    code: 'account-email/service-unavailable',
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test('reset service surfaces throttling, malformed responses, and network failures', async (t) => {
  configureResetEndpoint(t, 'https://example.com/send-reset');
  const { service } = loadAccountEmailService();
  const request = () => service.requestPasswordResetEmailForEmail({ email: 'person@example.com' });
  const fetch = t.mock.method(global, 'fetch', async () => ({
    ok: false,
    json: async () => ({ error: 'too_many_requests' }),
  }));
  await assert.rejects(request(), { code: 'account-email/too-many-requests' });

  fetch.mock.mockImplementation(async () => ({
    ok: false,
    json: async () => { throw new SyntaxError('Not JSON'); },
  }));
  await assert.rejects(request(), { code: 'account-email/email-failed' });

  fetch.mock.mockImplementation(async () => { throw new TypeError('Network unavailable'); });
  await assert.rejects(request(), { code: 'account-email/email-failed' });
});

test('extracts reset codes from direct and nested Firebase action links', () => {
  const { service } = loadAccountEmailService();
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
  const { service } = loadAccountEmailService();
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
    const { service } = loadAccountEmailService({ currentUser: user });
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
    const { service } = loadAccountEmailService({ currentUser: user });
    await assert.rejects(
      () => service.requestAddPasswordEmail({ user, lang: 'en' }),
      (error) => error.code === 'account-email/too-many-requests',
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
  const { service } = loadAccountEmailService({ currentUser: user });

  await assert.rejects(
    () => service.requestAddPasswordEmail({ user, lang: 'en' }),
    (error) => error.code === 'account-email/password-already-exists',
  );
});

test('verifies the email code and ends a stale session after reset', async () => {
  const user = {};
  const { service, calls } = loadAccountEmailService({ currentUser: user });

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

test('registration and email change use authenticated branded endpoints', async (t) => {
  configureResetEndpoint(t);
  const requests = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 204 };
  });
  const user = { email: 'person@example.com', getIdToken: async () => 'firebase-id-token' };
  const { service } = loadAccountEmailService({ currentUser: user });
  assert.equal(await service.requestEmailVerification({ user, lang: 'uk-UA' }), user.email);
  assert.equal(await service.requestEmailChange({ user, newEmail: ' New@Example.com ', lang: 'en' }), 'new@example.com');
  assert.equal(requests[0].url, 'https://europe-west1-planit-test.cloudfunctions.net/sendAccountVerificationEmail');
  assert.deepEqual(JSON.parse(requests[0].options.body), { locale: 'uk' });
  assert.equal(requests[1].url, 'https://europe-west1-planit-test.cloudfunctions.net/sendEmailChangeEmail');
  assert.deepEqual(JSON.parse(requests[1].options.body), { locale: 'en', newEmail: 'new@example.com' });
  for (const request of requests) assert.equal(request.options.headers.Authorization, 'Bearer firebase-id-token');
});

test('account verification and email change reject missing account data', async () => {
  const { service } = loadAccountEmailService();
  await assert.rejects(service.requestEmailVerification(), { code: 'account-email/email-unavailable' });
  await assert.rejects(service.requestEmailChange(), { code: 'account-email/email-unavailable' });
  await assert.rejects(service.requestEmailChange({ user: { email: 'person@example.com' }, newEmail: ' ' }), {
    code: 'account-email/invalid-email',
  });
});

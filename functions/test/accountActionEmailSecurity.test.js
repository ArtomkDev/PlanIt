import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as accountEmailConfig from '../src/accountEmailConfig.js';

import {
  createAccountActionEmailContent,
  normalizeAccountEmailLocale,
} from '../src/accountActionEmailTemplates.js';

const source = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const firebaseActionLink = 'https://planit-hub.firebaseapp.com/__/auth/action'
  + '?mode=resetPassword&oobCode=secret-code&apiKey=test-key';
const defaultUser = {
  uid: 'user-123',
  email: 'person@example.com',
  emailVerified: true,
  displayName: 'Артем',
  providerData: [{ providerId: 'google.com' }],
};

const loadHandlers = ({
  userRecord = defaultUser,
  lookupError,
  smtpError,
  generationError,
  authAgeSeconds = 0,
  invalidToken = false,
  actionLink = firebaseActionLink,
} = {}) => {
  const mail = [];
  const generatedLinks = [];
  const lookups = [];
  const limits = new Map();
  let now = Date.now();
  const firebaseAuth = {
    verifyIdToken: async () => {
      if (invalidToken) throw new Error('Invalid token');
      return { uid: defaultUser.uid, auth_time: Math.floor(now / 1000) - authAgeSeconds };
    },
    getUser: async () => userRecord,
    getUserByEmail: async (email) => {
      lookups.push(email);
      if (lookupError) throw lookupError;
      return userRecord;
    },
    generatePasswordResetLink: async (email, settings) => {
      if (generationError) throw generationError;
      generatedLinks.push({ email, settings });
      const url = new URL(actionLink);
      url.searchParams.set('continueUrl', settings.url);
      return url.toString();
    },
    generateEmailVerificationLink: async (email, settings) => {
      generatedLinks.push({ email, settings, mode: 'verifyEmail' });
      const url = new URL(firebaseActionLink);
      url.searchParams.set('mode', 'verifyEmail');
      url.searchParams.set('continueUrl', settings.url);
      return url.toString();
    },
    generateVerifyAndChangeEmailLink: async (email, newEmail, settings) => {
      if (generationError) throw generationError;
      generatedLinks.push({ email, newEmail, settings, mode: 'verifyAndChangeEmail' });
      const url = new URL(firebaseActionLink);
      url.searchParams.set('mode', 'verifyAndChangeEmail');
      url.searchParams.set('continueUrl', settings.url);
      return url.toString();
    },
  };
  const context = vm.createContext({
    URL,
    Date: { now: () => now },
    process: { env: { GCLOUD_PROJECT: 'planit-hub' } },
    console: { error: () => {} },
    createHash,
    createAccountActionEmailContent,
    normalizeAccountEmailLocale,
    ...accountEmailConfig,
    getApps: () => [{}],
    getAuth: () => firebaseAuth,
    getFirestore: () => ({
      collection: () => ({ doc: (key) => key }),
      runTransaction: async (callback) => callback({
        get: async (key) => ({ data: () => limits.get(key) }),
        set: (key, value) => limits.set(key, value),
      }),
    }),
    defineSecret: () => ({ value: () => 'abcdefghijklmnop' }),
    defineString: () => ({ value: () => '' }),
    onRequest: (_options, handler) => handler,
    createRemoteJWKSet: () => ({}),
    nodemailer: {
      createTransport: () => ({
        sendMail: async (message) => {
          if (smtpError) throw smtpError;
          mail.push(message);
        },
      }),
    },
  });
  const executable = source
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace(/^export /gm, '');
  vm.runInContext(executable + '\nglobalThis.handlers = { sendAddPasswordEmail, sendPasswordResetEmail, sendAccountVerificationEmail, sendEmailChangeEmail };', context);

  const invoke = async (name, {
    body = { email: defaultUser.email, locale: 'uk' },
    method = 'POST',
    ip = '192.0.2.1',
    authorization,
  } = {}) => {
    const result = { status: null, body: null, headers: {} };
    const response = {
      set: (key, value) => { result.headers[key] = value; },
      status: (status) => { result.status = status; return response; },
      json: (body) => { result.body = JSON.parse(JSON.stringify(body)); },
      send: () => {},
    };
    await context.handlers[name]({ method, body, ip, get: () => authorization }, response);
    return result;
  };

  return { invoke, mail, generatedLinks, lookups, limits, advanceTime: (ms) => { now += ms; } };
};

test('add-password mail requires authentication, a verified email, and no password provider', async () => {
  const unauthenticated = loadHandlers();
  assert.equal((await unauthenticated.invoke('sendAddPasswordEmail')).status, 401);
  assert.equal(unauthenticated.mail.length, 0);

  for (const [userRecord, status] of [
    [{ ...defaultUser, emailVerified: false }, 403],
    [{ ...defaultUser, providerData: [{ providerId: 'password' }] }, 409],
  ]) {
    const app = loadHandlers({ userRecord });
    assert.equal((await app.invoke('sendAddPasswordEmail', { authorization: 'Bearer valid-token' })).status, status);
    assert.equal(app.mail.length, 0);
  }
});

test('add-password mail keeps the branded template, website, and action context', async () => {
  const app = loadHandlers();
  const result = await app.invoke('sendAddPasswordEmail', { authorization: 'Bearer valid-token' });

  assert.equal(result.status, 204);
  assert.equal(result.body, null);
  assert.equal(app.mail[0].subject, 'Створіть пароль для PlanIt');
  assert.match(app.mail[0].html, /https:\/\/planit-hub.firebaseapp.com\/uk\/auth\/action\?/);
  assert.equal(new URL(app.generatedLinks[0].settings.url).searchParams.get('passwordAction'), 'addPassword');
});

test('public reset sends a localized branded email to the account owner without authentication', async () => {
  const app = loadHandlers({ userRecord: { ...defaultUser, providerData: [{ providerId: 'password' }] } });
  const result = await app.invoke('sendPasswordResetEmail', {
    body: {
      email: ' Person@Example.com ',
      locale: 'uk-UA',
      continueUrl: 'https://attacker.example',
      to: 'attacker@example.com',
    },
  });

  assert.equal(result.status, 204);
  assert.equal(result.body, null);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(app.lookups, ['person@example.com']);
  assert.equal(app.mail[0].to, defaultUser.email);
  assert.equal(app.mail[0].subject, 'Відновіть пароль для PlanIt');
  assert.equal(app.mail[0].from.address, 'planit.app.support@gmail.com');
  assert.match(app.mail[0].html, /<h1\b/);
  assert.match(app.mail[0].html, /<img src="cid:planit-wordmark"/);
  assert.equal(app.mail[0].attachments.length, 1);
  assert.equal(app.mail[0].attachments[0].cid, 'planit-wordmark');
  assert.doesNotMatch(app.mail[0].text, /attacker|додавання пароля/);

  const link = new URL(app.mail[0].text.split('\n').find((line) => line.startsWith('https://')));
  assert.equal(link.origin + link.pathname, 'https://planit-hub.firebaseapp.com/uk/auth/action');
  assert.equal(link.searchParams.get('mode'), 'resetPassword');
  assert.equal(link.searchParams.get('oobCode'), 'secret-code');
  assert.equal(link.searchParams.get('apiKey'), 'test-key');
  assert.equal(link.searchParams.get('lang'), 'uk');
  assert.equal(new URL(link.searchParams.get('continueUrl')).searchParams.get('passwordAction'), 'resetPassword');
});

test('unknown and disabled accounts return the same empty success without email', async () => {
  for (const options of [
    { lookupError: { code: 'auth/user-not-found' } },
    { userRecord: { ...defaultUser, disabled: true } },
  ]) {
    const app = loadHandlers(options);
    const result = await app.invoke('sendPasswordResetEmail');
    assert.equal(result.status, 204);
    assert.equal(result.body, null);
    assert.equal(app.mail.length, 0);
    assert.equal(app.generatedLinks.length, 0);
  }
});

test('recipient cooldown is shared across IP addresses without revealing account existence', async () => {
  for (const options of [{}, { lookupError: { code: 'auth/user-not-found' } }]) {
    const app = loadHandlers(options);
    assert.equal((await app.invoke('sendPasswordResetEmail')).status, 204);
    assert.equal((await app.invoke('sendPasswordResetEmail', { ip: '192.0.2.2' })).status, 204);
    assert.equal(app.lookups.length, 1);
    assert.equal(app.mail.length, options.lookupError ? 0 : 1);
    app.advanceTime(60_001);
    assert.equal((await app.invoke('sendPasswordResetEmail')).status, 204);
    assert.equal(app.lookups.length, 2);
  }
});

test('add-password and reset-password requests share the account cooldown', async () => {
  const app = loadHandlers();
  assert.equal((await app.invoke('sendAddPasswordEmail', { authorization: 'Bearer valid-token' })).status, 204);
  assert.equal((await app.invoke('sendPasswordResetEmail')).status, 204);
  assert.equal(app.mail.length, 1);
});

test('public reset limits requests per IP and stores hashed recipient and IP keys', async () => {
  const app = loadHandlers({ lookupError: { code: 'auth/user-not-found' } });
  for (let index = 0; index < 10; index += 1) {
    assert.equal((await app.invoke('sendPasswordResetEmail', {
      body: { email: `person${index}@example.com` },
    })).status, 204);
  }
  const blocked = await app.invoke('sendPasswordResetEmail');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'too_many_requests');
  assert.equal(app.lookups.length, 10);
  for (const key of app.limits.keys()) {
    assert.match(key, /^reset-(?:ip|email)-[a-f0-9]{64}$/);
  }
  app.advanceTime(10 * 60 * 1000 + 1);
  assert.equal((await app.invoke('sendPasswordResetEmail')).status, 204);
});

test('public reset rejects unsupported methods and invalid addresses before account lookup', async () => {
  const app = loadHandlers();
  assert.equal((await app.invoke('sendPasswordResetEmail', { method: 'GET' })).status, 405);
  for (const email of [undefined, {}, '', 'bad-address', 'a\r\nb@example.com', 'a'.repeat(255) + '@example.com']) {
    const result = await app.invoke('sendPasswordResetEmail', { body: { email } });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'invalid_email');
  }
  assert.equal(app.lookups.length, 0);
  assert.equal(app.mail.length, 0);
});

test('SMTP failures never expose codes or release the recipient cooldown', async () => {
  const app = loadHandlers({ smtpError: new Error('smtp-secret') });
  const result = await app.invoke('sendPasswordResetEmail');
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'internal_error' });
  assert.equal((await app.invoke('sendPasswordResetEmail')).status, 204);
  assert.equal(app.generatedLinks.length, 1);
});

test('invalid generated links fail without sending mail or exposing a code', async () => {
  const app = loadHandlers({ actionLink: 'https://example.com/?mode=resetPassword&oobCode=secret-code' });
  const result = await app.invoke('sendPasswordResetEmail');
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: 'email_service_unavailable' });
  assert.equal(app.mail.length, 0);
});

test('nested Firebase mobile links are rewritten to the English website handler', async () => {
  const app = loadHandlers({
    actionLink: 'https://planit-hub.firebaseapp.com/__/auth/links?link=' + encodeURIComponent(firebaseActionLink),
  });
  const result = await app.invoke('sendPasswordResetEmail', { body: { email: defaultUser.email, locale: 'de' } });
  assert.equal(result.status, 204);
  assert.equal(app.mail[0].subject, 'Reset your PlanIt password');
  assert.match(app.mail[0].text, /https:\/\/planit-hub.firebaseapp.com\/en\/auth\/action\?/);
});

test('registration verification uses the authenticated account email and the branded handler', async () => {
  const app = loadHandlers({ userRecord: { ...defaultUser, emailVerified: false } });
  const result = await app.invoke('sendAccountVerificationEmail', {
    authorization: 'Bearer valid-token',
    body: { locale: 'uk', email: 'attacker@example.com' },
  });
  assert.equal(result.status, 204);
  assert.equal(app.mail[0].to, defaultUser.email);
  assert.equal(app.mail[0].subject, 'Підтвердьте вашу пошту для PlanIt');
  assert.match(app.mail[0].text, /\/uk\/auth\/action\?mode=verifyEmail/);
  const continueUrl = new URL(app.generatedLinks[0].settings.url);
  assert.equal(continueUrl.searchParams.get('accountAction'), 'verifyEmail');
  assert.equal(continueUrl.searchParams.has('passwordAction'), false);
  assert.equal((await app.invoke('sendAccountVerificationEmail', { authorization: 'Bearer valid-token' })).status, 429);
});

test('verification rejects missing or invalid authentication and skips verified accounts', async () => {
  const app = loadHandlers();
  assert.equal((await app.invoke('sendAccountVerificationEmail')).status, 401);
  const invalid = loadHandlers({ invalidToken: true });
  assert.equal((await invalid.invoke('sendAccountVerificationEmail', { authorization: 'Bearer invalid-token' })).status, 401);
  assert.equal((await app.invoke('sendAccountVerificationEmail', { authorization: 'Bearer valid-token' })).status, 204);
  assert.equal(app.mail.length, 0);
});

test('email change requires recent reauthentication and a verified account', async () => {
  for (const [options, status] of [
    [{ authAgeSeconds: 301 }, 401],
    [{ userRecord: { ...defaultUser, emailVerified: false } }, 403],
    [{ userRecord: { ...defaultUser, disabled: true } }, 403],
  ]) {
    const app = loadHandlers(options);
    const result = await app.invoke('sendEmailChangeEmail', {
      authorization: 'Bearer valid-token',
      body: { newEmail: 'new@example.com' },
    });
    assert.equal(result.status, status);
    assert.equal(app.generatedLinks.length, 0);
  }
});

test('email change sends a confirmation only to the normalized new address', async () => {
  const app = loadHandlers();
  const result = await app.invoke('sendEmailChangeEmail', {
    authorization: 'Bearer valid-token',
    body: { newEmail: ' New@Example.com ', locale: 'uk' },
  });
  assert.equal(result.status, 204);
  assert.equal(result.body, null);
  assert.equal(app.mail.length, 1);
  assert.equal(app.mail[0].to, 'new@example.com');
  assert.equal(app.mail[0].subject, 'Підтвердьте нову пошту для PlanIt');
  assert.match(app.mail[0].text, /\/uk\/auth\/action\?mode=verifyAndChangeEmail/);
  assert.equal(app.generatedLinks[0].email, defaultUser.email);
  assert.equal(app.generatedLinks[0].newEmail, 'new@example.com');
});

test('email change rejects invalid or unchanged addresses and normalizes conflicts', async () => {
  const app = loadHandlers();
  for (const newEmail of ['', 'bad-address', defaultUser.email, {}, 'a\r\nb@example.com']) {
    assert.equal((await app.invoke('sendEmailChangeEmail', {
      authorization: 'Bearer valid-token', body: { newEmail },
    })).status, 400);
  }
  assert.equal(app.mail.length, 0);
  const conflicting = loadHandlers({ generationError: { code: 'auth/email-already-exists' } });
  const result = await conflicting.invoke('sendEmailChangeEmail', {
    authorization: 'Bearer valid-token', body: { newEmail: 'taken@example.com' },
  });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'email_already_in_use');
});

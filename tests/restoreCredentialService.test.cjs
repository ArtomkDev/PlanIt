const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../src/services/restoreCredentialService.android.js');
const compiled = babel.transformFileSync(filename).code;
const DAY_MS = 24 * 60 * 60 * 1000;

function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function loadService(t, { supported = true, state = null, keyExists = true, created = '{"id":"new-key"}', responses = {} } = {}) {
  const events = [];
  const requests = [];
  const native = {
    isSupported: supported,
    state,
    readState: async () => native.state,
    writeState: async value => { native.state = value; events.push(`state:${value}`); },
    create: async requestJson => { events.push(`create:${JSON.parse(requestJson).challenge}`); return created; },
    get: async requestJson => {
      const { challenge } = JSON.parse(requestJson);
      events.push(`get:${challenge}`);
      if (!keyExists) return null;
      return JSON.stringify({ id: 'restored-key', response: { clientDataJSON: challenge } });
    },
    clear: async () => { events.push('clear'); },
  };
  const manualLogins = [];
  const signIns = [];
  t.mock.method(global, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, body, authorization: init.headers.Authorization });
    const reply = responses[body.action];
    if (reply instanceof Error) throw reply;
    const [status, payload] = typeof reply === 'function' ? await reply() : reply || [200, {
      registrationOptions: { options: { challenge: 'register-challenge' } },
      register: { registered: true },
      authenticationOptions: { options: { challenge: 'server-challenge', rpId: 'planitflow.com' } },
      signIn: { customToken: 'custom-token' },
    }[body.action]];
    return { ok: status < 400, status, json: async () => payload };
  });
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'planit-hub';

  const mocks = {
    'react-native': { NativeModules: { RestoreCredentials: native } },
    'firebase/auth': { signInWithCustomToken: async (_auth, token) => { signIns.push(token); } },
    '../config/firebase': { auth: {} },
    '../utils/authFlags': { setManualLogin: value => manualLogins.push(value) },
    '../utils/deviceService': { getDeviceId: async () => 'installation-0001' },
  };
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(compiled, filename);
  return { service: mod.exports, native, events, requests, manualLogins, signIns };
}

const user = uid => ({ uid, getIdToken: async () => `id-token-${uid}` });

test('signed-in users get one registered restore key per installation and month', async t => {
  const env = loadService(t);
  await env.service.syncRestoreCredential(user('owner'));

  assert.deepEqual(env.requests.map(request => [request.body.action, request.authorization]), [
    ['registrationOptions', 'Bearer id-token-owner'],
    ['register', 'Bearer id-token-owner'],
  ]);
  assert.equal(env.requests[0].url, 'https://europe-west1-planit-hub.cloudfunctions.net/restoreCredentials');
  assert.deepEqual(env.requests[1].body, {
    action: 'register', deviceId: 'installation-0001', response: { id: 'new-key' },
  });
  assert.equal(JSON.parse(env.native.state).uid, 'owner');

  await env.service.syncRestoreCredential(user('owner'));
  assert.equal(env.requests.length, 2);

  env.native.state = JSON.stringify({ uid: 'owner', syncedAt: Date.now() - 31 * DAY_MS });
  await env.service.syncRestoreCredential(user('owner'));
  env.native.state = JSON.stringify({ uid: 'owner', syncedAt: Date.now() });
  await env.service.syncRestoreCredential(user('other'));
  assert.equal(env.requests.filter(request => request.body.action === 'register').length, 3);
});

test('concurrent token refreshes share one registration and sign-out waits for it', async t => {
  const options = gate();
  const env = loadService(t, { responses: { registrationOptions: () => options.promise } });
  const first = env.service.syncRestoreCredential(user('owner'));
  const second = env.service.syncRestoreCredential(user('owner'));
  const clearing = env.service.clearRestoreCredential();
  await new Promise(setImmediate);
  assert.equal(env.events.includes('clear'), false);

  options.resolve([200, { options: { challenge: 'register-challenge' } }]);
  await Promise.all([first, second, clearing]);
  assert.equal(env.requests.filter(request => request.body.action === 'registrationOptions').length, 1);
  assert.deepEqual(env.events.slice(-2), ['state:{}', 'clear']);
});

test('devices without a restore provider remember the check without registering a key', async t => {
  const env = loadService(t, { created: null });
  await env.service.syncRestoreCredential(user('owner'));
  assert.deepEqual(env.requests.map(request => request.body.action), ['registrationOptions']);
  assert.equal(JSON.parse(env.native.state).uid, 'owner');
});

test('a transferred key signs in once with a server challenge and a new-device login', async t => {
  const env = loadService(t);
  assert.equal(await env.service.restoreSignIn(), true);

  assert.deepEqual(env.requests.map(request => [request.body.action, request.authorization]), [
    ['authenticationOptions', undefined],
    ['signIn', undefined],
  ]);
  assert.deepEqual(env.requests[1].body.response, {
    id: 'restored-key', response: { clientDataJSON: 'server-challenge' },
  });
  assert.deepEqual(env.signIns, ['custom-token']);
  assert.deepEqual(env.manualLogins, [true]);
  assert.equal(env.native.state, null, 'the restored session registers this installation next');
});

test('restore checks run only on installations without local restore state', async t => {
  const initialized = loadService(t, { state: '{}' });
  assert.equal(await initialized.service.restoreSignIn(), false);
  assert.deepEqual(initialized.events, []);

  const fresh = loadService(t, { keyExists: false });
  assert.equal(await fresh.service.restoreSignIn(), false);
  assert.equal(fresh.requests.length, 0, 'a local probe avoids server calls without a key');
  assert.equal(fresh.native.state, '{}');
});

test('rejected restore keys are removed while transient failures are retried later', async t => {
  const rejected = loadService(t, { responses: { signIn: [401, { error: 'restore_credential_unknown' }] } });
  await assert.rejects(rejected.service.restoreSignIn(), { code: 'restore-credentials/restore-credential-unknown' });
  assert.deepEqual(rejected.events.slice(-2), ['state:{}', 'clear']);
  assert.equal(rejected.manualLogins.includes(true), false);

  const offline = loadService(t, { responses: { authenticationOptions: new Error('offline') } });
  await assert.rejects(offline.service.restoreSignIn(), { code: 'restore-credentials/network-failed' });
  assert.equal(offline.native.state, null);
  assert.equal(offline.events.includes('clear'), false);

  const unavailable = loadService(t, { responses: { signIn: [500, { error: 'internal_error' }] } });
  await assert.rejects(unavailable.service.restoreSignIn());
  assert.equal(unavailable.native.state, null);
});

test('devices below Android 9 never touch Credential Manager', async t => {
  const env = loadService(t, { supported: false });
  await env.service.syncRestoreCredential(user('owner'));
  await env.service.clearRestoreCredential();
  assert.equal(await env.service.restoreSignIn(), false);
  assert.deepEqual(env.events, []);
  assert.equal(env.requests.length, 0);
});

import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoCBOR } from '@simplewebauthn/server/helpers';

import website from '../src/website.generated.cjs';

const source = fs.readFileSync(new URL('../src/restoreCredentials.js', import.meta.url), 'utf8');
const RP_ID = 'planitflow.com';
const DEV_ORIGIN = 'android:apk-key-hash:'
  + Buffer.from('C2428ECFD76A86EC5E9570ECAFEC70EE366AE23A59AEA4238F82D4C56A46F616', 'hex')
    .toString('base64url');
const DEVICE_ID = 'installation-0001';

const createFirestore = () => {
  const docs = new Map();
  const ref = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => snapshot(path),
    set: async (data) => { docs.set(path, data); },
    update: async (patch) => { docs.set(path, { ...docs.get(path), ...patch }); },
    delete: async () => { docs.delete(path); },
  });
  const snapshot = (path) => {
    const data = docs.get(path);
    return { id: path.split('/').pop(), ref: ref(path), exists: docs.has(path), data: () => data };
  };
  const query = (name, filters) => ({
    where: (field, operator, value) => {
      assert.equal(operator, '==');
      return query(name, [...filters, [field, value]]);
    },
    get: async () => ({
      docs: [...docs.keys()]
        .filter((path) => path.startsWith(name + '/'))
        .filter((path) => filters.every(([field, value]) => docs.get(path)[field] === value))
        .map(snapshot),
    }),
  });
  return {
    docs,
    doc: ref,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`), ...query(name, []) }),
    runTransaction: async (callback) => callback({
      get: (target) => target.get(),
      set: (target, data) => { docs.set(target.path, data); },
      delete: (target) => { docs.delete(target.path); },
    }),
  };
};

const loadEndpoint = () => {
  let handler;
  const db = createFirestore();
  const users = new Map([['user-1', { uid: 'user-1', disabled: false }]]);
  const auth = {
    verifyIdToken: async (token, checkRevoked) => {
      assert.equal(checkRevoked, true);
      if (!token.startsWith('token-')) throw new Error('invalid token');
      return { uid: token.slice('token-'.length) };
    },
    getUser: async (uid) => {
      if (!users.has(uid)) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
      return users.get(uid);
    },
    createCustomToken: async (uid) => `custom-token:${uid}`,
  };
  const context = vm.createContext({
    Buffer,
    URL,
    Uint8Array,
    Promise,
    console: { error: () => {} },
    createHash,
    website,
    getAuth: () => auth,
    getFirestore: () => db,
    Timestamp: {
      fromMillis: (millis) => ({ toMillis: () => millis }),
      now: () => ({ toMillis: () => Date.now() }),
    },
    onRequest: (_options, callback) => { handler = callback; },
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
  });
  vm.runInContext(
    source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '').replace(/^export /gm, ''),
    context,
  );

  const call = async (body, token) => {
    const response = {
      statusCode: 0,
      body: null,
      set() {},
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; },
    };
    await handler({
      method: 'POST',
      body,
      get: (name) => (name === 'Authorization' && token ? `Bearer ${token}` : undefined),
    }, response);
    return response;
  };
  return { call, db, users };
};

const createAuthenticator = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credentialId = Buffer.from(`restore-key-${Math.random()}`);
  const rpIdHash = createHash('sha256').update(RP_ID).digest();
  const clientData = (type, challenge, origin) => Buffer.from(JSON.stringify({
    type, challenge, origin,
  })).toString('base64url');

  return {
    id: credentialId.toString('base64url'),
    register(options, { origin = DEV_ORIGIN } = {}) {
      const coseKey = isoCBOR.encode(new Map([
        [1, 2], [3, -7], [-1, 1],
        [-2, Buffer.from(jwk.x, 'base64url')],
        [-3, Buffer.from(jwk.y, 'base64url')],
      ]));
      const credentialLength = Buffer.alloc(2);
      credentialLength.writeUInt16BE(credentialId.length);
      // AT flag only: restore keys are created without user presence.
      const authData = Buffer.concat([
        rpIdHash, Buffer.from([0x40]), Buffer.alloc(4), Buffer.alloc(16),
        credentialLength, credentialId, coseKey,
      ]);
      const attestationObject = isoCBOR.encode(new Map([
        ['fmt', 'none'], ['attStmt', new Map()], ['authData', authData],
      ]));
      return {
        id: this.id,
        rawId: this.id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: clientData('webauthn.create', options.challenge, origin),
          attestationObject: Buffer.from(attestationObject).toString('base64url'),
        },
      };
    },
    assert(options, { userHandle = options.userHandle ?? 'user-1', counter = 0 } = {}) {
      const counterBytes = Buffer.alloc(4);
      counterBytes.writeUInt32BE(counter);
      const authenticatorData = Buffer.concat([rpIdHash, Buffer.from([0x00]), counterBytes]);
      const clientDataJSON = clientData('webauthn.get', options.challenge, DEV_ORIGIN);
      const signature = sign('sha256', Buffer.concat([
        authenticatorData,
        createHash('sha256').update(Buffer.from(clientDataJSON, 'base64url')).digest(),
      ]), privateKey);
      return {
        id: this.id,
        rawId: this.id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON,
          authenticatorData: authenticatorData.toString('base64url'),
          signature: signature.toString('base64url'),
          userHandle: Buffer.from(userHandle).toString('base64url'),
        },
      };
    },
  };
};

const register = async (endpoint, authenticator, deviceId = DEVICE_ID) => {
  const { body: { options } } = await endpoint.call({ action: 'registrationOptions' }, 'token-user-1');
  return endpoint.call({
    action: 'register',
    deviceId,
    response: authenticator.register(options),
  }, 'token-user-1');
};

const restore = async (endpoint, authenticator, assertion = {}) => {
  const { body: { options } } = await endpoint.call({ action: 'authenticationOptions' });
  return endpoint.call({ action: 'signIn', response: authenticator.assert(options, assertion) });
};

const credentialPaths = (endpoint) => [...endpoint.db.docs.keys()]
  .filter((path) => path.startsWith('_internalRestoreCredentials/'));

test('a registered restore key signs its owner in with a custom token', async () => {
  const endpoint = loadEndpoint();
  const authenticator = createAuthenticator();

  const { body: { options } } = await endpoint.call({ action: 'registrationOptions' }, 'token-user-1');
  assert.equal(options.rp.id, RP_ID);
  assert.equal(Buffer.from(options.user.id, 'base64url').toString(), 'user-1');
  assert.equal(options.pubKeyCredParams.map(({ alg }) => alg).join(), '-7,-257');
  const registration = await endpoint.call({
    action: 'register', deviceId: DEVICE_ID, response: authenticator.register(options),
  }, 'token-user-1');
  assert.equal(registration.statusCode, 200);

  const { body: { options: requestOptions } } = await endpoint.call({ action: 'authenticationOptions' });
  assert.equal(requestOptions.allowCredentials.length, 0);
  assert.equal(requestOptions.userVerification, 'discouraged');
  const assertion = authenticator.assert(requestOptions);
  const signIn = await endpoint.call({ action: 'signIn', response: assertion });
  assert.equal(signIn.statusCode, 200);
  assert.equal(signIn.body.customToken, 'custom-token:user-1');

  const replay = await endpoint.call({ action: 'signIn', response: assertion });
  assert.deepEqual([replay.statusCode, replay.body.error], [400, 'challenge_invalid']);
});

test('registration requires a Firebase session and an app signing certificate origin', async () => {
  const endpoint = loadEndpoint();
  const authenticator = createAuthenticator();

  const anonymous = await endpoint.call({ action: 'registrationOptions' });
  assert.deepEqual([anonymous.statusCode, anonymous.body.error], [401, 'unauthenticated']);

  const { body: { options } } = await endpoint.call({ action: 'registrationOptions' }, 'token-user-1');
  const foreign = await endpoint.call({
    action: 'register',
    deviceId: DEVICE_ID,
    response: authenticator.register(options, { origin: 'android:apk-key-hash:another-app' }),
  }, 'token-user-1');
  assert.deepEqual([foreign.statusCode, foreign.body.error], [400, 'restore_credential_invalid']);

  const { body: { options: otherUserOptions } } = await endpoint.call(
    { action: 'registrationOptions' },
    'token-user-2',
  );
  const crossUser = await endpoint.call({
    action: 'register', deviceId: DEVICE_ID, response: authenticator.register(otherUserOptions),
  }, 'token-user-1');
  assert.deepEqual([crossUser.statusCode, crossUser.body.error], [400, 'challenge_invalid']);
  assert.deepEqual(credentialPaths(endpoint), []);
});

test('re-registering an installation replaces its previous restore key', async () => {
  const endpoint = loadEndpoint();
  const first = createAuthenticator();
  const second = createAuthenticator();
  const otherDevice = createAuthenticator();

  assert.equal((await register(endpoint, first)).statusCode, 200);
  assert.equal((await register(endpoint, otherDevice, 'installation-0002')).statusCode, 200);
  assert.equal((await register(endpoint, second)).statusCode, 200);

  assert.deepEqual(credentialPaths(endpoint).sort(), [
    `_internalRestoreCredentials/${otherDevice.id}`,
    `_internalRestoreCredentials/${second.id}`,
  ].sort());
  assert.equal((await restore(endpoint, first)).statusCode, 401);
  assert.equal((await restore(endpoint, second)).statusCode, 200);
});

test('restore rejects mismatched user handles and deleted accounts', async () => {
  const endpoint = loadEndpoint();
  const authenticator = createAuthenticator();
  await register(endpoint, authenticator);

  const mismatch = await restore(endpoint, authenticator, { userHandle: 'user-2' });
  assert.deepEqual([mismatch.statusCode, mismatch.body.error], [401, 'restore_credential_unknown']);

  endpoint.users.set('user-1', { uid: 'user-1', disabled: true });
  const disabled = await restore(endpoint, authenticator);
  assert.deepEqual([disabled.statusCode, disabled.body.error], [403, 'user_disabled']);

  endpoint.users.set('user-1', { uid: 'user-1', disabled: false });
  endpoint.db.docs.set('deleted_accounts/user-1', { deletedAt: 1 });
  const deleted = await restore(endpoint, authenticator);
  assert.deepEqual([deleted.statusCode, deleted.body.error], [401, 'restore_credential_unknown']);
  assert.deepEqual(credentialPaths(endpoint), []);
});

test('challenges are bound to their purpose', async () => {
  const endpoint = loadEndpoint();
  const authenticator = createAuthenticator();
  const { body: { options } } = await endpoint.call({ action: 'authenticationOptions' });

  const registration = await endpoint.call({
    action: 'register', deviceId: DEVICE_ID, response: authenticator.register(options),
  }, 'token-user-1');
  assert.deepEqual([registration.statusCode, registration.body.error], [400, 'challenge_invalid']);

  const unknownAction = await endpoint.call({ action: 'delete' });
  assert.deepEqual([unknownAction.statusCode, unknownAction.body.error], [400, 'action_invalid']);
});

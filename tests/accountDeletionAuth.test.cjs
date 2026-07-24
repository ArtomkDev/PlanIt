const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/auth/authServices.js',
);

const loadAuthService = ({
  platform = 'web',
  currentUser,
  popupResult = null,
  appleCredential = null,
} = {}) => {
  const calls = {
    credentialReauth: [],
    popupReauth: [],
    revokedTokens: [],
  };
  const auth = { currentUser };

  class EmailAuthProvider {
    static credential(email, password) {
      return { kind: 'password', email, password };
    }
  }

  class GoogleAuthProvider {
    static credential(idToken) {
      return { kind: 'google', idToken };
    }
  }

  class OAuthProvider {
    constructor(providerId) {
      this.providerId = providerId;
    }

    credential(options) {
      return { kind: 'oauth', providerId: this.providerId, ...options };
    }

    static credentialFromResult(result) {
      return result?.credential || null;
    }
  }

  const firebaseAuth = {
    EmailAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    linkWithCredential: async () => ({}),
    reauthenticateWithCredential: async (user, credential) => {
      calls.credentialReauth.push({ user, credential });
      return { user };
    },
    reauthenticateWithPopup: async (user, provider) => {
      calls.popupReauth.push({ user, provider });
      return popupResult;
    },
    revokeAccessToken: async (_auth, token) => {
      calls.revokedTokens.push(token);
    },
    unlink: async () => ({}),
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
  const mockedLoad = function mockedLoad(request, parent, isMain) {
    if (request === '../config/firebase') return { auth };
    if (request === 'firebase/auth') return firebaseAuth;
    if (request === 'react-native') return { Platform: { OS: platform } };
    if (request === 'expo-constants') {
      return { __esModule: true, default: { appOwnership: 'standalone' } };
    }
    if (request === 'expo-crypto') {
      return {
        CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
        digestStringAsync: async () => 'hashed-nonce',
        getRandomBytesAsync: async () => new Uint8Array(32),
      };
    }
    if (request === 'expo-apple-authentication') {
      return {
        signInAsync: async (options) => {
          calls.appleSignInOptions = options;
          return appleCredential;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  Module._load = mockedLoad;

  try {
    testModule._compile(transformed, servicePath);
    return {
      service: testModule.exports,
      calls,
      runWithRuntimeMocks: async (callback) => {
        Module._load = mockedLoad;
        try {
          return await callback();
        } finally {
          Module._load = originalLoad;
        }
      },
    };
  } finally {
    Module._load = originalLoad;
  }
};

const makeUser = (providers = ['password']) => ({
  uid: 'user-1',
  email: 'person@example.com',
  providerData: providers.map((providerId) => ({ providerId })),
  getIdToken: async () => 'firebase-id-token',
});

test('discovers linked deletion providers in a stable order', () => {
  const user = makeUser(['apple.com', 'password', 'google.com', 'custom']);
  const { service } = loadAuthService({ currentUser: user });

  assert.deepEqual(service.getAccountDeletionProviders(user), [
    'password',
    'google.com',
    'apple.com',
  ]);
});

test('reauthenticates a password account and stamps a short-lived proof', async () => {
  const user = makeUser();
  const { service, calls } = loadAuthService({ currentUser: user });

  const verification = await service.reauthenticateForAccountDeletion({
    providerId: 'password',
    password: 'correct horse battery staple',
    user,
  });

  assert.equal(calls.credentialReauth.length, 1);
  assert.deepEqual(calls.credentialReauth[0].credential, {
    kind: 'password',
    email: user.email,
    password: 'correct horse battery staple',
  });
  assert.equal(verification.providerId, 'password');
  assert.equal(verification.userId, user.uid);
  assert.equal(
    service.isAccountDeletionVerificationValid(verification, user),
    true,
  );

  verification.verifiedAt -= service.ACCOUNT_REAUTH_MAX_AGE_MS + 1;
  assert.equal(
    service.isAccountDeletionVerificationValid(verification, user),
    false,
  );
});

test('reauthenticates Apple on web and revokes the returned access token', async () => {
  const user = makeUser(['apple.com']);
  const { service, calls } = loadAuthService({
    currentUser: user,
    popupResult: {
      credential: { accessToken: 'apple-access-token' },
    },
  });

  const verification = await service.reauthenticateForAccountDeletion({
    providerId: 'apple.com',
    user,
  });
  const revocation = await service.revokeAppleAuthorizationForDeletion(
    verification,
    user,
  );

  assert.equal(calls.popupReauth.length, 1);
  assert.equal(verification.appleAccessToken, 'apple-access-token');
  assert.deepEqual(calls.revokedTokens, ['apple-access-token']);
  assert.deepEqual(revocation, { status: 'revoked' });
});

test('refuses Apple deletion verification when no revocable token is returned', async () => {
  const user = makeUser(['apple.com']);
  const { service } = loadAuthService({
    currentUser: user,
    popupResult: { credential: {} },
  });

  await assert.rejects(
    () => service.reauthenticateForAccountDeletion({
      providerId: 'apple.com',
      user,
    }),
    (error) => error.code === 'account-deletion/missing-provider-token',
  );
});

test('fails closed when native Apple revocation is not configured', async () => {
  const previousEndpoint =
    process.env.EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT;
  const previousProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT;
  delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  try {
    const user = makeUser(['apple.com']);
    const { service } = loadAuthService({
      platform: 'ios',
      currentUser: user,
    });

    await assert.rejects(
      () => service.revokeAppleAuthorizationForDeletion(
        {
          providerId: 'apple.com',
          appleAuthorizationCode: 'apple-authorization-code',
        },
        user,
      ),
      (error) =>
        error.code === 'account-deletion/apple-revocation-config-missing',
    );
  } finally {
    if (previousEndpoint === undefined) {
      delete process.env.EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT;
    } else {
      process.env.EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT =
        previousEndpoint;
    }
    if (previousProjectId === undefined) {
      delete process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
    } else {
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = previousProjectId;
    }
  }
});

test('reauthenticates Google through a web popup', async () => {
  const user = makeUser(['google.com']);
  const { service, calls } = loadAuthService({
    currentUser: user,
    popupResult: { user },
  });

  const verification = await service.reauthenticateForAccountDeletion({
    providerId: 'google.com',
    user,
  });

  assert.equal(calls.popupReauth.length, 1);
  assert.equal(verification.providerId, 'google.com');
  assert.equal(verification.userId, user.uid);
});

test('reauthenticates native Apple with a hashed nonce and keeps the authorization code', async () => {
  const user = makeUser(['apple.com']);
  const { service, calls, runWithRuntimeMocks } = loadAuthService({
    platform: 'ios',
    currentUser: user,
    appleCredential: {
      identityToken: 'apple-identity-token',
      authorizationCode: 'apple-authorization-code',
    },
  });

  const verification = await runWithRuntimeMocks(() =>
    service.reauthenticateForAccountDeletion({
      providerId: 'apple.com',
      user,
    })
  );

  assert.equal(calls.appleSignInOptions.nonce, 'hashed-nonce');
  assert.deepEqual(calls.appleSignInOptions.requestedScopes, []);
  assert.equal(calls.credentialReauth.length, 1);
  assert.equal(
    calls.credentialReauth[0].credential.rawNonce,
    '00'.repeat(32),
  );
  assert.equal(
    verification.appleAuthorizationCode,
    'apple-authorization-code',
  );
});

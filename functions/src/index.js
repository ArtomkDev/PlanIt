import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import {
  SignJWT,
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
} from 'jose';

if (getApps().length === 0) {
  initializeApp();
}

const APPLE_CLIENT_ID = defineSecret('APPLE_CLIENT_ID');
const APPLE_KEY_ID = defineSecret('APPLE_KEY_ID');
const APPLE_PRIVATE_KEY = defineSecret('APPLE_PRIVATE_KEY');
const APPLE_TEAM_ID = defineSecret('APPLE_TEAM_ID');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = new URL(`${APPLE_ISSUER}/auth/keys`);
const APPLE_TOKEN_URL = `${APPLE_ISSUER}/auth/token`;
const APPLE_REVOKE_URL = `${APPLE_ISSUER}/auth/revoke`;
const APPLE_JWKS = createRemoteJWKSet(APPLE_KEYS_URL);
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_AUTHORIZATION_CODE_LENGTH = 4096;
const MAX_FIREBASE_REAUTH_AGE_SECONDS = 5 * 60;

class PublicFunctionError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.publicCode = code;
  }
}

const postAppleForm = async (url, parameters) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return response;
};

const createAppleClientSecret = async () => {
  const privateKeyValue = APPLE_PRIVATE_KEY.value().replace(/\\n/g, '\n');
  const privateKey = await importPKCS8(privateKeyValue, 'ES256');

  return new SignJWT({})
    .setProtectedHeader({
      alg: 'ES256',
      kid: APPLE_KEY_ID.value(),
    })
    .setIssuer(APPLE_TEAM_ID.value())
    .setSubject(APPLE_CLIENT_ID.value())
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
};

const getFirebaseIdentity = async (request) => {
  const authorization = String(request.get('Authorization') || '');
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) {
    throw new PublicFunctionError(401, 'unauthenticated');
  }

  try {
    const identity = await getAuth().verifyIdToken(match[1], true);
    const authAgeSeconds =
      Math.floor(Date.now() / 1000) - Number(identity.auth_time || 0);
    if (
      !Number.isFinite(authAgeSeconds) ||
      authAgeSeconds < 0 ||
      authAgeSeconds > MAX_FIREBASE_REAUTH_AGE_SECONDS
    ) {
      throw new PublicFunctionError(401, 'recent_reauthentication_required');
    }
    return identity;
  } catch (error) {
    if (error instanceof PublicFunctionError) throw error;
    throw new PublicFunctionError(401, 'invalid_firebase_token');
  }
};

const exchangeAuthorizationCode = async (
  authorizationCode,
  clientSecret,
) => {
  const response = await postAppleForm(APPLE_TOKEN_URL, {
    client_id: APPLE_CLIENT_ID.value(),
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });

  if (!response.ok) {
    throw new PublicFunctionError(502, 'apple_code_exchange_failed');
  }

  const tokenResponse = await response.json();
  if (
    typeof tokenResponse.id_token !== 'string' ||
    (
      typeof tokenResponse.refresh_token !== 'string' &&
      typeof tokenResponse.access_token !== 'string'
    )
  ) {
    throw new PublicFunctionError(502, 'apple_token_response_invalid');
  }

  return tokenResponse;
};

const assertAppleIdentityMatchesFirebaseUser = async (
  firebaseUserId,
  appleIdentityToken,
) => {
  let appleIdentity;
  try {
    appleIdentity = await jwtVerify(appleIdentityToken, APPLE_JWKS, {
      audience: APPLE_CLIENT_ID.value(),
      issuer: APPLE_ISSUER,
    });
  } catch {
    throw new PublicFunctionError(502, 'apple_identity_invalid');
  }

  const firebaseUser = await getAuth().getUser(firebaseUserId);
  const linkedAppleProvider = firebaseUser.providerData.find(
    ({ providerId }) => providerId === 'apple.com',
  );

  if (
    !linkedAppleProvider ||
    linkedAppleProvider.uid !== appleIdentity.payload.sub
  ) {
    throw new PublicFunctionError(403, 'apple_identity_mismatch');
  }
};

const revokeAppleToken = async (tokenResponse, clientSecret) => {
  const isRefreshToken = typeof tokenResponse.refresh_token === 'string';
  const token = isRefreshToken
    ? tokenResponse.refresh_token
    : tokenResponse.access_token;
  const response = await postAppleForm(APPLE_REVOKE_URL, {
    client_id: APPLE_CLIENT_ID.value(),
    client_secret: clientSecret,
    token,
    token_type_hint: isRefreshToken ? 'refresh_token' : 'access_token',
  });

  if (!response.ok) {
    throw new PublicFunctionError(502, 'apple_token_revocation_failed');
  }
};

export const revokeAppleAuthorization = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [
      APPLE_CLIENT_ID,
      APPLE_KEY_ID,
      APPLE_PRIVATE_KEY,
      APPLE_TEAM_ID,
    ],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    response.set('Content-Type', 'application/json; charset=utf-8');

    if (request.method !== 'POST') {
      response.set('Allow', 'POST');
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    try {
      const firebaseIdentity = await getFirebaseIdentity(request);
      const authorizationCode =
        typeof request.body?.authorizationCode === 'string'
          ? request.body.authorizationCode.trim()
          : '';

      if (
        !authorizationCode ||
        authorizationCode.length > MAX_AUTHORIZATION_CODE_LENGTH
      ) {
        throw new PublicFunctionError(400, 'authorization_code_invalid');
      }

      const clientSecret = await createAppleClientSecret();
      const tokenResponse = await exchangeAuthorizationCode(
        authorizationCode,
        clientSecret,
      );
      await assertAppleIdentityMatchesFirebaseUser(
        firebaseIdentity.uid,
        tokenResponse.id_token,
      );
      await revokeAppleToken(tokenResponse, clientSecret);

      response.status(204).send();
    } catch (error) {
      const status = error instanceof PublicFunctionError
        ? error.status
        : 500;
      const publicCode = error instanceof PublicFunctionError
        ? error.publicCode
        : 'internal_error';
      response.status(status).json({ error: publicCode });
    }
  },
);

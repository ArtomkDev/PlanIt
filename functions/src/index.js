import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import nodemailer from 'nodemailer';
import {
  SignJWT,
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
} from 'jose';

import { createAddPasswordEmailContent } from './passwordActionEmailTemplates.js';

if (getApps().length === 0) {
  initializeApp();
}

const APPLE_CLIENT_ID = defineSecret('APPLE_CLIENT_ID');
const APPLE_KEY_ID = defineSecret('APPLE_KEY_ID');
const APPLE_PRIVATE_KEY = defineSecret('APPLE_PRIVATE_KEY');
const APPLE_TEAM_ID = defineSecret('APPLE_TEAM_ID');
const SMTP_APP_PASSWORD = defineSecret('SMTP_APP_PASSWORD');
const PASSWORD_RESET_CONTINUE_URL = defineString(
  'PASSWORD_RESET_CONTINUE_URL',
  { default: '' },
);

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS_URL = new URL(`${APPLE_ISSUER}/auth/keys`);
const APPLE_TOKEN_URL = `${APPLE_ISSUER}/auth/token`;
const APPLE_REVOKE_URL = `${APPLE_ISSUER}/auth/revoke`;
const APPLE_JWKS = createRemoteJWKSet(APPLE_KEYS_URL);
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_AUTHORIZATION_CODE_LENGTH = 4096;
const MAX_FIREBASE_REAUTH_AGE_SECONDS = 5 * 60;
const PASSWORD_EMAIL_COOLDOWN_MS = 60 * 1000;
const IOS_BUNDLE_ID = 'com.artomk.planit';
const ANDROID_PACKAGE_NAME = 'com.artomk.planit';
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const SMTP_USER = 'planit.app.support@gmail.com';
const PASSWORD_ACTION_HANDLER_BASE_URL = 'https://planit-hub.firebaseapp.com';
const NESTED_ACTION_LINK_PARAMS = ['link', 'deep_link_id'];
let smtpTransporter = null;

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

const getVerifiedFirebaseIdentity = async (request) => {
  const authorization = String(request.get('Authorization') || '');
  const match = authorization.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) {
    throw new PublicFunctionError(401, 'unauthenticated');
  }

  try {
    return await getAuth().verifyIdToken(match[1], true);
  } catch {
    throw new PublicFunctionError(401, 'invalid_firebase_token');
  }
};

const getFirebaseIdentity = async (request) => {
  const identity = await getVerifiedFirebaseIdentity(request);
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

const getPasswordEmailRateLimitRef = (userId) => (
  getFirestore().collection('_internalPasswordEmailRateLimits').doc(userId)
);

const claimPasswordEmailRateLimit = async (userId) => {
  const rateLimitRef = getPasswordEmailRateLimitRef(userId);
  const now = Date.now();

  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const nextAllowedAt = Number(snapshot.data()?.nextAllowedAt) || 0;
    if (nextAllowedAt > now) {
      throw new PublicFunctionError(429, 'too_many_requests');
    }
    transaction.set(rateLimitRef, {
      nextAllowedAt: now + PASSWORD_EMAIL_COOLDOWN_MS,
      updatedAt: now,
    });
  });

};


const getPasswordResetContinueUrl = (locale) => {
  const configuredUrl = PASSWORD_RESET_CONTINUE_URL.value().trim();
  const projectId =
    process.env.GCLOUD_PROJECT
    || process.env.GCP_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT;
  const fallbackUrl = projectId
    ? 'https://' + projectId + '.firebaseapp.com/'
    : '';

  let continueUrl;
  try {
    continueUrl = new URL(configuredUrl || fallbackUrl);
  } catch {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }
  if (continueUrl.protocol !== 'https:') {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  continueUrl.searchParams.set('passwordAction', 'addPassword');
  continueUrl.searchParams.set('lang', locale);
  return continueUrl.toString();
};

const findPasswordActionUrl = (url, depth = 0) => {
  if (url.searchParams.get('mode') && url.searchParams.get('oobCode')) {
    return url;
  }
  if (depth >= 2) return null;

  for (const paramName of NESTED_ACTION_LINK_PARAMS) {
    const nestedLink = url.searchParams.get(paramName);
    if (!nestedLink) continue;

    try {
      const nestedUrl = new URL(nestedLink);
      const actionUrl = findPasswordActionUrl(nestedUrl, depth + 1);
      if (actionUrl) return actionUrl;
    } catch {
      // Ignore malformed nested links and fail with a public error below.
    }
  }

  return null;
};

const buildPasswordActionLink = (firebaseActionLink, locale) => {
  let generatedUrl;
  let actionUrl;
  try {
    generatedUrl = new URL(firebaseActionLink);
    actionUrl = new URL(
      '/' + locale + '/auth/action',
      PASSWORD_ACTION_HANDLER_BASE_URL,
    );
  } catch {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  const passwordActionUrl = findPasswordActionUrl(generatedUrl);
  if (!passwordActionUrl) {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  for (const [key, value] of passwordActionUrl.searchParams) {
    actionUrl.searchParams.append(key, value);
  }
  actionUrl.searchParams.set('lang', locale);

  for (const requiredParam of ['mode', 'oobCode', 'apiKey']) {
    if (!actionUrl.searchParams.get(requiredParam)) {
      throw new PublicFunctionError(503, 'email_service_unavailable');
    }
  }

  return actionUrl.toString();
};

const getSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;

  const appPassword = SMTP_APP_PASSWORD.value().replace(/\s/g, '');
  if (!/^[A-Za-z0-9]{16}$/.test(appPassword)) {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: appPassword,
    },
    connectionTimeout: REQUEST_TIMEOUT_MS,
    greetingTimeout: REQUEST_TIMEOUT_MS,
    socketTimeout: REQUEST_TIMEOUT_MS,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return smtpTransporter;
};

const sendAddPasswordMessage = async ({ userRecord, locale, actionLink }) => {
  const message = createAddPasswordEmailContent({
    locale,
    displayName: userRecord.displayName,
    actionLink,
  });
  await getSmtpTransporter().sendMail({
    from: {
      name: 'PlanIt',
      address: SMTP_USER,
    },
    to: userRecord.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
};

export const sendAddPasswordEmail = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: true,
    secrets: [
      SMTP_APP_PASSWORD,
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
      const firebaseIdentity = await getVerifiedFirebaseIdentity(request);
      const userRecord = await getAuth().getUser(firebaseIdentity.uid);
      if (!userRecord.email || userRecord.emailVerified !== true) {
        throw new PublicFunctionError(403, 'verified_email_required');
      }
      if (
        userRecord.providerData.some(
          ({ providerId }) => providerId === 'password',
        )
      ) {
        throw new PublicFunctionError(409, 'password_already_exists');
      }

      const locale = String(request.body?.locale || '')
        .toLowerCase()
        .startsWith('uk')
        ? 'uk'
        : 'en';
      await claimPasswordEmailRateLimit(userRecord.uid);
      const firebaseActionLink = await getAuth().generatePasswordResetLink(
        userRecord.email,
        {
          url: getPasswordResetContinueUrl(locale),
          handleCodeInApp: true,
          iOS: {
            bundleId: IOS_BUNDLE_ID,
          },
          android: {
            packageName: ANDROID_PACKAGE_NAME,
            installApp: false,
          },
        },
      );
      const actionLink = buildPasswordActionLink(firebaseActionLink, locale);
      await sendAddPasswordMessage({
        userRecord,
        locale,
        actionLink,
      });

      response.status(204).send();
    } catch (error) {
      const status = error instanceof PublicFunctionError
        ? error.status
        : 500;
      const publicCode = error instanceof PublicFunctionError
        ? error.publicCode
        : 'internal_error';
      if (!(error instanceof PublicFunctionError)) {
        console.error('sendAddPasswordEmail failed', {
          code: error?.code || 'unknown',
          name: error?.name || 'Error',
        });
      }
      response.status(status).json({ error: publicCode });
    }
  },
);

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

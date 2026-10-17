import { createHash } from 'node:crypto';
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

import {
  createAccountActionEmailContent,
  normalizeAccountEmailLocale,
} from './accountActionEmailTemplates.js';
import {
  ACCOUNT_ACTION_HANDLER_BASE_URL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
} from './accountEmailConfig.js';

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
const ACCOUNT_EMAIL_COOLDOWN_MS = 60 * 1000;
const IOS_BUNDLE_ID = 'com.artomk.planit';
const ANDROID_PACKAGE_NAME = 'com.artomk.planit';
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

const getAccountEmailRateLimitRef = (key) => (
  getFirestore().collection('_internalPasswordEmailRateLimits').doc(key)
);

const claimAccountEmailRateLimit = async (key, {
  cooldownMs = ACCOUNT_EMAIL_COOLDOWN_MS,
  maxRequests = 1,
} = {}) => {
  const rateLimitRef = getAccountEmailRateLimitRef(key);
  const now = Date.now();

  await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const data = snapshot.data();
    const nextAllowedAt = Number(data?.nextAllowedAt) || 0;
    const activeWindow = nextAllowedAt > now;
    const requestCount = activeWindow ? Number(data?.requestCount) || 1 : 0;
    if (requestCount >= maxRequests) {
      throw new PublicFunctionError(429, 'too_many_requests');
    }
    transaction.set(rateLimitRef, {
      nextAllowedAt: activeWindow ? nextAllowedAt : now + cooldownMs,
      requestCount: requestCount + 1,
      updatedAt: now,
    });
  });
};

const getAccountActionContinueUrl = (locale, purpose) => {
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

  continueUrl.searchParams.set('accountAction', purpose);
  if (purpose === 'addPassword' || purpose === 'resetPassword') {
    continueUrl.searchParams.set('passwordAction', purpose);
  } else {
    continueUrl.searchParams.delete('passwordAction');
  }
  continueUrl.searchParams.set('lang', locale);
  return continueUrl.toString();
};

const findAccountActionUrl = (url, depth = 0) => {
  if (url.searchParams.get('mode') && url.searchParams.get('oobCode')) {
    return url;
  }
  if (depth >= 2) return null;

  for (const paramName of NESTED_ACTION_LINK_PARAMS) {
    const nestedLink = url.searchParams.get(paramName);
    if (!nestedLink) continue;

    try {
      const nestedUrl = new URL(nestedLink);
      const actionUrl = findAccountActionUrl(nestedUrl, depth + 1);
      if (actionUrl) return actionUrl;
    } catch {
      // Ignore malformed nested links and fail with a public error below.
    }
  }

  return null;
};

const buildAccountActionLink = (firebaseActionLink, locale) => {
  let generatedUrl;
  let actionUrl;
  try {
    generatedUrl = new URL(firebaseActionLink);
    actionUrl = new URL(
      '/' + locale + '/auth/action',
      ACCOUNT_ACTION_HANDLER_BASE_URL,
    );
  } catch {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  const accountActionUrl = findAccountActionUrl(generatedUrl);
  if (!accountActionUrl) {
    throw new PublicFunctionError(503, 'email_service_unavailable');
  }

  for (const [key, value] of accountActionUrl.searchParams) {
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

const sendAccountActionMessage = async ({ userRecord, locale, purpose, newEmail }) => {
  const settings = {
    url: getAccountActionContinueUrl(locale, purpose),
    handleCodeInApp: true,
    iOS: {
      bundleId: IOS_BUNDLE_ID,
    },
    android: {
      packageName: ANDROID_PACKAGE_NAME,
      installApp: false,
    },
  };
  let firebaseActionLink;
  if (purpose === 'verifyEmail') {
    firebaseActionLink = await getAuth().generateEmailVerificationLink(userRecord.email, settings);
  } else if (purpose === 'verifyAndChangeEmail') {
    firebaseActionLink = await getAuth().generateVerifyAndChangeEmailLink(userRecord.email, newEmail, settings);
  } else {
    firebaseActionLink = await getAuth().generatePasswordResetLink(userRecord.email, settings);
  }
  const actionLink = buildAccountActionLink(firebaseActionLink, locale);
  const message = createAccountActionEmailContent({
    purpose,
    locale,
    displayName: userRecord.displayName,
    actionLink,
    inlineLogo: true,
  });
  await getSmtpTransporter().sendMail({
    from: {
      name: 'PlanIt',
      address: SMTP_USER,
    },
    to: purpose === 'verifyAndChangeEmail' ? newEmail : userRecord.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
};

const respondWithAccountEmailError = (error, response, functionName) => {
  if (error?.code === 'auth/email-already-exists') {
    error = new PublicFunctionError(409, 'email_already_in_use');
  }
  const isPublicError = error instanceof PublicFunctionError;
  if (!isPublicError) {
    console.error(functionName + ' failed', {
      code: error?.code || 'unknown',
      name: error?.name || 'Error',
    });
  }
  response.status(isPublicError ? error.status : 500).json({
    error: isPublicError ? error.publicCode : 'internal_error',
  });
};

const onAccountEmailRequest = (functionName, handler) => onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: true,
    secrets: [SMTP_APP_PASSWORD],
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
      await handler(request);
      response.status(204).send();
    } catch (error) {
      respondWithAccountEmailError(error, response, functionName);
    }
  },
);

export const sendAddPasswordEmail = onAccountEmailRequest('sendAddPasswordEmail', async (request) => {
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

  const locale = normalizeAccountEmailLocale(request.body?.locale);
  await claimAccountEmailRateLimit(userRecord.uid);
  await sendAccountActionMessage({
    userRecord,
    locale,
    purpose: 'addPassword',
  });
});

export const sendPasswordResetEmail = onAccountEmailRequest('sendPasswordResetEmail', async (request) => {
  const email = typeof request.body?.email === 'string'
    ? request.body.email.trim().toLowerCase()
    : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PublicFunctionError(400, 'invalid_email');
  }

  const ipHash = createHash('sha256').update(request.ip || 'unknown').digest('hex');
  await claimAccountEmailRateLimit('reset-ip-' + ipHash, {
    cooldownMs: 10 * 60 * 1000,
    maxRequests: 10,
  });

  let userRecord;
  try {
    const emailHash = createHash('sha256').update(email).digest('hex');
    await claimAccountEmailRateLimit('reset-email-' + emailHash);
    userRecord = await getAuth().getUserByEmail(email);
    if (userRecord.disabled) {
      return;
    }
    await claimAccountEmailRateLimit(userRecord.uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found' || error?.publicCode === 'too_many_requests') {
      // Unknown accounts and recipient cooldowns have the same public response.
      return;
    }
    throw error;
  }

  await sendAccountActionMessage({
    userRecord,
    locale: normalizeAccountEmailLocale(request.body?.locale),
    purpose: 'resetPassword',
  });
});

export const sendAccountVerificationEmail = onAccountEmailRequest('sendAccountVerificationEmail', async (request) => {
  const identity = await getVerifiedFirebaseIdentity(request);
  const userRecord = await getAuth().getUser(identity.uid);
  if (!userRecord.email || userRecord.disabled) {
    throw new PublicFunctionError(403, 'email_unavailable');
  }
  if (userRecord.emailVerified) {
    return;
  }
  await claimAccountEmailRateLimit(userRecord.uid);
  await sendAccountActionMessage({
    userRecord,
    locale: normalizeAccountEmailLocale(request.body?.locale),
    purpose: 'verifyEmail',
  });
});

export const sendEmailChangeEmail = onAccountEmailRequest('sendEmailChangeEmail', async (request) => {
  const identity = await getFirebaseIdentity(request);
  const userRecord = await getAuth().getUser(identity.uid);
  if (!userRecord.email || !userRecord.emailVerified || userRecord.disabled) {
    throw new PublicFunctionError(403, 'verified_email_required');
  }
  const newEmail = typeof request.body?.newEmail === 'string'
    ? request.body.newEmail.trim().toLowerCase()
    : '';
  if (newEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    throw new PublicFunctionError(400, 'invalid_email');
  }
  if (newEmail === userRecord.email.toLowerCase()) {
    throw new PublicFunctionError(400, 'email_unchanged');
  }
  await claimAccountEmailRateLimit(userRecord.uid);
  const recipientHash = createHash('sha256').update(newEmail).digest('hex');
  await claimAccountEmailRateLimit('change-email-' + recipientHash);
  await sendAccountActionMessage({
    userRecord,
    newEmail,
    locale: normalizeAccountEmailLocale(request.body?.locale),
    purpose: 'verifyAndChangeEmail',
  });
});

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

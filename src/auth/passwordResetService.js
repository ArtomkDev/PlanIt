import * as Linking from 'expo-linking';
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  signOut,
  verifyPasswordResetCode,
} from 'firebase/auth';

import { auth } from '../config/firebase';

const IOS_BUNDLE_ID = 'com.artomk.planit';
const ANDROID_PACKAGE_NAME = 'com.artomk.planit';
const PASSWORD_RESET_MODE = 'resetPassword';
export const PASSWORD_ACTION_ADD = 'addPassword';
export const PASSWORD_ACTION_RESET = 'resetPassword';
const NESTED_LINK_PARAMS = ['link', 'deep_link_id'];
const REQUEST_TIMEOUT_MS = 12_000;
const normalizeHost = (value) => (value || '')
  .trim()
  .replace(/^https?:\/\//, '')
  .split('/')[0];


const getConfiguredActionUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_PASSWORD_RESET_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  if (authDomain) {
    const normalizedDomain = authDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    return `https://${normalizedDomain}/`;
  }

  return Linking.createURL('/password-reset');
};

const normalizePasswordAction = (value) => (
  value === PASSWORD_ACTION_ADD ? PASSWORD_ACTION_ADD : PASSWORD_ACTION_RESET
);

const normalizePasswordActionLanguage = (value) => (
  String(value || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
);

const withPasswordActionContext = (urlValue, { purpose, lang } = {}) => {
  try {
    const url = new URL(urlValue);
    url.searchParams.set('passwordAction', normalizePasswordAction(purpose));
    url.searchParams.set('lang', normalizePasswordActionLanguage(lang));
    return url.toString();
  } catch {
    return urlValue;
  }
};

export const hasPasswordProvider = (user = auth.currentUser) =>
  Boolean(
    user?.providerData?.some(
      ({ providerId }) => providerId === 'password',
    ),
  );

export const getPasswordResetActionCodeSettings = ({
  purpose = PASSWORD_ACTION_RESET,
  lang = 'en',
} = {}) => {
  const linkDomain = normalizeHost(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_LINK_DOMAIN,
  );
  const isDefaultFirebaseDomain =
    linkDomain.endsWith('.firebaseapp.com')
    || linkDomain.endsWith('.web.app');

  return {
    url: withPasswordActionContext(getConfiguredActionUrl(), { purpose, lang }),
    handleCodeInApp: true,
    ...(linkDomain && !isDefaultFirebaseDomain ? { linkDomain } : {}),
    iOS: {
      bundleId: IOS_BUNDLE_ID,
    },
    android: {
      packageName: ANDROID_PACKAGE_NAME,
      installApp: false,
    },
  };
};

export const requestPasswordResetEmailForEmail = async ({
  email,
  lang = 'en',
} = {}) => {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    const error = new Error('The account email is unavailable.');
    error.code = 'password-reset/email-unavailable';
    throw error;
  }

  auth.languageCode = lang === 'uk' ? 'uk' : 'en';
  await sendPasswordResetEmail(
    auth,
    normalizedEmail,
    getPasswordResetActionCodeSettings({
      purpose: PASSWORD_ACTION_RESET,
      lang,
    }),
  );

  return normalizedEmail;
};

export const requestPasswordResetEmail = ({
  user = auth.currentUser,
  lang = 'en',
} = {}) => {
  return requestPasswordResetEmailForEmail({ email: user?.email, lang });
};

const getAddPasswordEmailEndpoint = () => {
  const configuredEndpoint =
    process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT?.trim();
  if (configuredEndpoint) return configuredEndpoint;

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  return projectId
    ? 'https://europe-west1-' + projectId + '.cloudfunctions.net/sendAddPasswordEmail'
    : '';
};

const createPasswordActionError = (code, message) => {
  const error = new Error(message || code);
  error.code = 'password-reset/' + code;
  return error;
};

export const requestAddPasswordEmail = async ({
  user = auth.currentUser,
  lang = 'en',
} = {}) => {
  const email = user?.email?.trim();
  if (!user || !email) {
    throw createPasswordActionError(
      'email-unavailable',
      'The account email is unavailable.',
    );
  }
  if (hasPasswordProvider(user)) {
    throw createPasswordActionError(
      'password-already-exists',
      'This account already has a password.',
    );
  }

  const endpoint = getAddPasswordEmailEndpoint();
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw createPasswordActionError(
      'service-unavailable',
      'The add-password email service is not configured.',
    );
  }
  if (endpointUrl.protocol !== 'https:') {
    throw createPasswordActionError(
      'service-unavailable',
      'The add-password email service must use HTTPS.',
    );
  }

  const firebaseIdToken = await user.getIdToken();
  const abortController =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = setTimeout(() => abortController?.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpointUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + firebaseIdToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locale: normalizePasswordActionLanguage(lang),
      }),
      ...(abortController ? { signal: abortController.signal } : {}),
    });
  } catch {
    throw createPasswordActionError(
      'email-failed',
      'The add-password email could not be sent.',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let publicCode = 'email-failed';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') {
        publicCode = body.error.replaceAll('_', '-');
      }
    } catch {
      // A non-JSON server error intentionally maps to the generic public code.
    }
    throw createPasswordActionError(publicCode, 'The add-password email failed.');
  }

  return email;
};

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const readPasswordActionContext = (url) => {
  const continueUrl = parseUrl(url.searchParams.get('continueUrl'));
  return {
    purpose: normalizePasswordAction(
      url.searchParams.get('passwordAction')
      || continueUrl?.searchParams.get('passwordAction'),
    ),
    lang: normalizePasswordActionLanguage(
      url.searchParams.get('lang')
      || continueUrl?.searchParams.get('lang'),
    ),
  };
};

const findPasswordResetRequest = (value, depth = 0) => {
  if (!value || depth > 2) return null;

  const url = parseUrl(value);
  if (!url) return null;

  const mode = url.searchParams.get('mode');
  const oobCode = url.searchParams.get('oobCode');
  if (mode === PASSWORD_RESET_MODE && oobCode) {
    return {
      mode: PASSWORD_RESET_MODE,
      oobCode,
      ...readPasswordActionContext(url),
    };
  }

  for (const paramName of NESTED_LINK_PARAMS) {
    const nestedUrl = url.searchParams.get(paramName);
    const nestedRequest = findPasswordResetRequest(nestedUrl, depth + 1);
    if (nestedRequest) return nestedRequest;
  }

  return null;
};

export const parsePasswordResetLink = (url) => {
  return findPasswordResetRequest(url);
};

export const createPasswordResetNavigationUrl = (url) => {
  const resetRequest = parsePasswordResetLink(url);
  if (!resetRequest) return url;

  const params = new URLSearchParams({
    oobCode: resetRequest.oobCode,
    purpose: resetRequest.purpose,
    lang: resetRequest.lang,
  });
  return 'planit://password-reset?' + params.toString();
};

export const verifyPasswordResetRequest = (oobCode) => {
  if (!oobCode) {
    const error = new Error('The password reset code is missing.');
    error.code = 'password-reset/code-missing';
    return Promise.reject(error);
  }

  return verifyPasswordResetCode(auth, oobCode);
};

export const completePasswordReset = async (oobCode, newPassword) => {
  await confirmPasswordReset(auth, oobCode, newPassword);

  if (auth.currentUser) {
    // Password resets revoke refresh tokens. Do not leave the UI authenticated
    // with a stale local session after the password has changed.
    await signOut(auth).catch(() => {});
  }
};

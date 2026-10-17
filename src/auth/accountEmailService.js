import {
  confirmPasswordReset,
  signOut,
  verifyPasswordResetCode,
} from 'firebase/auth';

import { auth } from '../config/firebase';

const PASSWORD_RESET_MODE = 'resetPassword';
export const PASSWORD_ACTION_ADD = 'addPassword';
export const PASSWORD_ACTION_RESET = 'resetPassword';
const NESTED_LINK_PARAMS = ['link', 'deep_link_id'];
const REQUEST_TIMEOUT_MS = 12_000;

const normalizePasswordAction = (value) => (
  value === PASSWORD_ACTION_ADD ? PASSWORD_ACTION_ADD : PASSWORD_ACTION_RESET
);

const normalizeAccountEmailLanguage = (value) => (
  String(value || '').toLowerCase().startsWith('uk') ? 'uk' : 'en'
);

export const hasPasswordProvider = (user = auth.currentUser) =>
  Boolean(
    user?.providerData?.some(
      ({ providerId }) => providerId === 'password',
    ),
  );

export const requestPasswordResetEmailForEmail = async ({
  email,
  lang = 'en',
} = {}) => {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    throw createAccountEmailError('email-unavailable', 'The account email is unavailable.');
  }

  await requestAccountActionEmail({
    purpose: PASSWORD_ACTION_RESET,
    email: normalizedEmail,
    lang,
  });

  return normalizedEmail;
};

export const requestPasswordResetEmail = ({
  user = auth.currentUser,
  lang = 'en',
} = {}) => {
  return requestPasswordResetEmailForEmail({ email: user?.email, lang });
};

const getAccountEmailEndpoint = (purpose) => {
  const endpoints = {
    addPassword: ['sendAddPasswordEmail', process.env.EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT],
    resetPassword: ['sendPasswordResetEmail', process.env.EXPO_PUBLIC_PASSWORD_RESET_EMAIL_ENDPOINT],
    verifyEmail: ['sendAccountVerificationEmail', process.env.EXPO_PUBLIC_ACCOUNT_VERIFICATION_EMAIL_ENDPOINT],
    verifyAndChangeEmail: ['sendEmailChangeEmail', process.env.EXPO_PUBLIC_EMAIL_CHANGE_EMAIL_ENDPOINT],
  };
  const [functionName, endpoint] = endpoints[purpose];
  const configuredEndpoint = endpoint?.trim();
  if (configuredEndpoint) return configuredEndpoint;

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  return projectId
    ? 'https://europe-west1-' + projectId + '.cloudfunctions.net/' + functionName
    : '';
};

const createAccountEmailError = (code, message) => {
  const error = new Error(message || code);
  error.code = 'account-email/' + code;
  return error;
};

const requestAccountActionEmail = async ({ purpose, email, user, lang, newEmail }) => {
  const endpoint = getAccountEmailEndpoint(purpose);
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw createAccountEmailError(
      'service-unavailable',
      'The account email service is not configured.',
    );
  }
  if (endpointUrl.protocol !== 'https:') {
    throw createAccountEmailError(
      'service-unavailable',
      'The account email service must use HTTPS.',
    );
  }

  const firebaseIdToken = user ? await user.getIdToken() : null;
  const abortController =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = setTimeout(() => abortController?.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(endpointUrl.toString(), {
      method: 'POST',
      headers: {
        ...(firebaseIdToken ? { Authorization: 'Bearer ' + firebaseIdToken } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locale: normalizeAccountEmailLanguage(lang),
        ...(purpose === PASSWORD_ACTION_RESET ? { email } : {}),
        ...(purpose === 'verifyAndChangeEmail' ? { newEmail } : {}),
      }),
      ...(abortController ? { signal: abortController.signal } : {}),
    });
  } catch {
    throw createAccountEmailError(
      'email-failed',
      'The account email could not be sent.',
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
    throw createAccountEmailError(publicCode, 'The account email failed.');
  }
};

export const requestAddPasswordEmail = async ({
  user = auth.currentUser,
  lang = 'en',
} = {}) => {
  const email = user?.email?.trim();
  if (!user || !email) {
    throw createAccountEmailError('email-unavailable', 'The account email is unavailable.');
  }
  if (hasPasswordProvider(user)) {
    throw createAccountEmailError(
      'password-already-exists',
      'This account already has a password.',
    );
  }

  await requestAccountActionEmail({ purpose: PASSWORD_ACTION_ADD, user, lang });
  return email;
};

export const requestEmailVerification = async ({
  user = auth.currentUser,
  lang = 'en',
} = {}) => {
  if (!user?.email) {
    throw createAccountEmailError('email-unavailable', 'The account email is unavailable.');
  }
  await requestAccountActionEmail({ purpose: 'verifyEmail', user, lang });
  return user.email;
};

export const requestEmailChange = async ({
  user = auth.currentUser,
  newEmail,
  lang = 'en',
} = {}) => {
  if (!user?.email) {
    throw createAccountEmailError('email-unavailable', 'The account email is unavailable.');
  }
  const normalizedEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
  if (!normalizedEmail) {
    throw createAccountEmailError('invalid-email', 'The new email is unavailable.');
  }
  await requestAccountActionEmail({ purpose: 'verifyAndChangeEmail', user, newEmail: normalizedEmail, lang });
  return normalizedEmail;
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
    lang: normalizeAccountEmailLanguage(
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

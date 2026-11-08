import { NativeModules } from 'react-native';
import { signInWithCustomToken } from 'firebase/auth';

import { auth } from '../config/firebase';
import { WEBSITE_URL } from '../config/website.cjs';
import { setManualLogin } from '../utils/authFlags';
import { getDeviceId } from '../utils/deviceService';

const RestoreCredentials = NativeModules.RestoreCredentials;
const isSupported = RestoreCredentials?.isSupported === true;
const RP_ID = new URL(WEBSITE_URL).hostname;
const REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
// Only detects whether a restore key exists; this assertion is never sent.
const PROBE_CHALLENGE = 'cGxhbml0LXJlc3RvcmUtcHJvYmU';
let pendingSync = null;

const createRestoreCredentialError = (code, { rejected = false } = {}) => {
  const error = new Error(code);
  error.code = 'restore-credentials/' + code;
  error.rejected = rejected;
  return error;
};

const getEndpoint = () => {
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw createRestoreCredentialError('service-unavailable');
  return 'https://europe-west1-' + projectId + '.cloudfunctions.net/restoreCredentials';
};

const requestRestoreCredentials = async (body, user = null) => {
  const endpoint = getEndpoint();
  const idToken = user ? await user.getIdToken() : null;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...(idToken ? { Authorization: 'Bearer ' + idToken } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });
  } catch {
    throw createRestoreCredentialError('network-failed');
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof result.error === 'string' ? result.error.replaceAll('_', '-') : 'request-failed';
    // Client errors are final for this key; server errors and throttling are retried later.
    throw createRestoreCredentialError(code, {
      rejected: response.status >= 400 && response.status < 500 && response.status !== 429,
    });
  }
  return result;
};

// The state lives outside Auto Backup. Its absence means this installation has
// never had a session or restore check, which is when a transferred key can exist.
const readState = async () => {
  const state = await RestoreCredentials.readState();
  if (state === null) return null;
  try {
    return JSON.parse(state);
  } catch {
    return {};
  }
};

const writeState = (state) => RestoreCredentials.writeState(JSON.stringify(state));

const registerRestoreCredential = async (user) => {
  const state = await readState();
  if (state?.uid === user.uid && Date.now() - state.syncedAt < REFRESH_INTERVAL_MS) return;

  const { options } = await requestRestoreCredentials({ action: 'registrationOptions' }, user);
  const registrationJson = await RestoreCredentials.create(JSON.stringify(options));
  if (registrationJson) {
    await requestRestoreCredentials({
      action: 'register',
      deviceId: await getDeviceId(),
      response: JSON.parse(registrationJson),
    }, user);
  }
  await writeState({ uid: user.uid, syncedAt: Date.now() });
};

export const syncRestoreCredential = (user) => {
  if (!isSupported) return Promise.resolve();
  if (!pendingSync) {
    pendingSync = registerRestoreCredential(user).finally(() => { pendingSync = null; });
  }
  return pendingSync;
};

export const clearRestoreCredential = async () => {
  if (!isSupported) return;
  await pendingSync?.catch(() => {});
  await writeState({});
  await RestoreCredentials.clear();
};

export const restoreSignIn = async () => {
  if (!isSupported || (await readState()) !== null) return false;

  const hasRestoreKey = await RestoreCredentials.get(JSON.stringify({
    challenge: PROBE_CHALLENGE,
    rpId: RP_ID,
    allowCredentials: [],
    userVerification: 'discouraged',
  }));
  if (!hasRestoreKey) {
    await writeState({});
    return false;
  }

  try {
    const { options } = await requestRestoreCredentials({ action: 'authenticationOptions' });
    const authenticationJson = await RestoreCredentials.get(JSON.stringify(options));
    if (!authenticationJson) throw createRestoreCredentialError('missing-credential');
    const { customToken } = await requestRestoreCredentials({
      action: 'signIn',
      response: JSON.parse(authenticationJson),
    });
    // A restored device is a new sign-in: notify the account and reactivate the installation.
    setManualLogin(true);
    await signInWithCustomToken(auth, customToken);
    return true;
  } catch (error) {
    setManualLogin(false);
    if (error.rejected) {
      await writeState({});
      await RestoreCredentials.clear().catch(() => {});
    }
    throw error;
  }
};

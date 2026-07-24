import { auth } from '../config/firebase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  revokeAccessToken,
  unlink,
} from 'firebase/auth';

export const ACCOUNT_REAUTH_MAX_AGE_MS = 5 * 60 * 1000;

const createAuthFlowError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

export const createAppleSignInNonce = async () => {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const rawNonce = Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  return { rawNonce, hashedNonce };
};

const reauthenticateWithPassword = async (user, password) => {
  if (!password) {
    throw createAuthFlowError(
      'account-deletion/password-required',
      'A password is required to verify this account.',
    );
  }
  if (!user.email) {
    throw createAuthFlowError(
      'account-deletion/email-unavailable',
      'The account email is unavailable.',
    );
  }

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  return { providerId: 'password' };
};

const reauthenticateWithGoogle = async (user) => {
  if (Platform.OS === 'web') {
    const result = await reauthenticateWithPopup(
      user,
      new GoogleAuthProvider(),
    );
    return { providerId: 'google.com', userCredential: result };
  }

  if (Constants.appOwnership === 'expo') {
    throw createAuthFlowError(
      'account-deletion/provider-unavailable',
      'Google verification is unavailable in Expo Go.',
    );
  }

  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response?.data?.idToken || response?.idToken;

  if (!idToken) {
    throw createAuthFlowError(
      'account-deletion/missing-provider-token',
      'Google did not return an identity token.',
    );
  }

  await reauthenticateWithCredential(
    user,
    GoogleAuthProvider.credential(idToken),
  );
  return { providerId: 'google.com' };
};

const reauthenticateWithApple = async (user) => {
  const provider = new OAuthProvider('apple.com');

  if (Platform.OS === 'web') {
    const result = await reauthenticateWithPopup(user, provider);
    const credential = OAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw createAuthFlowError(
        'account-deletion/missing-provider-token',
        'Apple did not return an access token.',
      );
    }

    return {
      providerId: 'apple.com',
      appleAccessToken: credential.accessToken,
    };
  }

  if (Platform.OS !== 'ios') {
    throw createAuthFlowError(
      'account-deletion/provider-unavailable',
      'Apple verification is unavailable on this platform.',
    );
  }

  const AppleAuthentication = require('expo-apple-authentication');
  const { rawNonce, hashedNonce } = await createAppleSignInNonce();
  const appleCredential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [],
  });

  if (!appleCredential.identityToken) {
    throw createAuthFlowError(
      'account-deletion/missing-provider-token',
      'Apple did not return an identity token.',
    );
  }
  if (!appleCredential.authorizationCode) {
    throw createAuthFlowError(
      'account-deletion/missing-provider-token',
      'Apple did not return an authorization code.',
    );
  }

  const firebaseCredential = provider.credential({
    idToken: appleCredential.identityToken,
    rawNonce,
  });
  await reauthenticateWithCredential(user, firebaseCredential);

  return {
    providerId: 'apple.com',
    appleAuthorizationCode: appleCredential.authorizationCode,
  };
};

export const getAccountDeletionProviders = (user = auth.currentUser) => {
  if (!user) return [];

  const linkedProviders = new Set(
    user.providerData.map(({ providerId }) => providerId),
  );
  return ['password', 'google.com', 'apple.com'].filter((providerId) =>
    linkedProviders.has(providerId)
  );
};

export const reauthenticateForAccountDeletion = async ({
  providerId,
  password = '',
  user = auth.currentUser,
}) => {
  if (!user) {
    throw createAuthFlowError(
      'account-deletion/no-current-user',
      'No authenticated user is available.',
    );
  }

  let providerResult;
  if (providerId === 'password') {
    providerResult = await reauthenticateWithPassword(user, password);
  } else if (providerId === 'google.com') {
    providerResult = await reauthenticateWithGoogle(user);
  } else if (providerId === 'apple.com') {
    providerResult = await reauthenticateWithApple(user);
  } else {
    throw createAuthFlowError(
      'account-deletion/unsupported-provider',
      'This sign-in provider cannot verify account deletion.',
    );
  }

  return {
    ...providerResult,
    userId: user.uid,
    verifiedAt: Date.now(),
  };
};

export const isAccountDeletionVerificationValid = (
  verification,
  user = auth.currentUser,
) => {
  if (!verification || !user || verification.userId !== user.uid) {
    return false;
  }

  const verificationAge = Date.now() - Number(verification.verifiedAt);
  return (
    Number.isFinite(verificationAge) &&
    verificationAge >= 0 &&
    verificationAge <= ACCOUNT_REAUTH_MAX_AGE_MS
  );
};

/**
 * Revokes Sign in with Apple authorization when the current platform exposes
 * enough credentials. Native Apple authorization codes must be handled by a
 * trusted backend because Apple's token endpoint requires a private secret.
 */
export const revokeAppleAuthorizationForDeletion = async (
  verification,
  user = auth.currentUser,
) => {
  if (verification?.providerId !== 'apple.com') {
    return { status: 'not-applicable' };
  }

  if (verification.appleAuthorizationRevoked === true) {
    return { status: 'revoked' };
  }

  if (verification.appleAccessToken) {
    await revokeAccessToken(auth, verification.appleAccessToken);
    return { status: 'revoked' };
  }

  const authorizationCode = verification.appleAuthorizationCode;
  const configuredEndpoint =
    process.env.EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT?.trim();
  const firebaseProjectId =
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const endpoint = configuredEndpoint || (
    firebaseProjectId
      ? `https://europe-west1-${firebaseProjectId}.cloudfunctions.net/revokeAppleAuthorization`
      : ''
  );

  if (!authorizationCode) {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-credential-missing',
      'Apple did not return an authorization code that can be revoked.',
    );
  }

  if (!endpoint) {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-config-missing',
      'The Apple token revocation endpoint is not configured.',
    );
  }

  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-config-invalid',
      'The Apple token revocation endpoint is invalid.',
    );
  }

  if (endpointUrl.protocol !== 'https:') {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-config-invalid',
      'The Apple token revocation endpoint must use HTTPS.',
    );
  }

  const firebaseIdToken = await user.getIdToken(true);
  const abortController =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = setTimeout(() => abortController?.abort(), 12_000);
  let response;

  try {
    response = await fetch(endpointUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseIdToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ authorizationCode }),
      ...(abortController ? { signal: abortController.signal } : {}),
    });
  } catch {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-failed',
      'The Apple authorization could not be revoked.',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw createAuthFlowError(
      'account-deletion/apple-revocation-failed',
      'The Apple authorization could not be revoked.',
    );
  }

  return { status: 'revoked' };
};

export const linkGoogleAccount = async (idToken) => {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await linkWithCredential(auth.currentUser, credential);
    return { success: true, user: userCredential.user };
  } catch (error) {
    if (error.code === 'auth/credential-already-in-use') {
       throw new Error("Цей Google акаунт вже прив'язаний до іншого профілю.");
    }
    throw error;
  }
};

export const linkAppleAccount = async (idToken, rawNonce) => {
  try {
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({ idToken, rawNonce });
    const userCredential = await linkWithCredential(auth.currentUser, credential);
    return { success: true, user: userCredential.user };
  } catch (error) {
    throw error;
  }
};

export const unlinkProvider = async (providerId) => {
  try {
    await unlink(auth.currentUser, providerId);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const getLinkedProviders = () => {
  const user = auth.currentUser;
  if (!user) return [];
  return user.providerData.map(provider => provider.providerId);
};

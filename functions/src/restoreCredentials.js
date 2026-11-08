import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

import website from './website.generated.cjs';

const RP_ID = new URL(website.WEBSITE_URL).hostname;
// SHA-256 fingerprints published in the Digital Asset Links file: Play App
// Signing, the development keystore in credentials/, and the upload key.
const ANDROID_SIGNING_CERT_SHA256 = [
  '88:14:E0:C8:18:35:85:57:C2:BD:12:82:9F:A4:11:B6:E1:F2:E5:07:38:2B:7D:D2:0B:4E:4E:D6:B6:BE:DA:5E',
  'C2:42:8E:CF:D7:6A:86:EC:5E:95:70:EC:AF:EC:70:EE:36:6A:E2:3A:59:AE:A4:23:8F:82:D4:C5:6A:46:F6:16',
  '84:78:40:2C:0E:73:64:2C:62:13:CB:A1:29:20:C4:91:5E:9F:02:EB:11:43:38:37:EE:86:24:8F:17:B3:4C:3A',
];
const EXPECTED_ORIGINS = ANDROID_SIGNING_CERT_SHA256.map((fingerprint) => (
  'android:apk-key-hash:'
  + Buffer.from(fingerprint.replaceAll(':', ''), 'hex').toString('base64url')
));
const SUPPORTED_ALGORITHM_IDS = [-7, -257];
const CHALLENGES_COLLECTION = '_internalRestoreCredentialChallenges';
const CREDENTIALS_COLLECTION = '_internalRestoreCredentials';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
// Clients re-register monthly, so only keys of abandoned installations expire.
const CREDENTIAL_TTL_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_WEBAUTHN_USER_ID_BYTES = 64;
const MAX_CREDENTIAL_ID_LENGTH = 1024;
const DEVICE_ID_RE = /^[a-zA-Z0-9_-]{16,96}$/;

class RestoreCredentialError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.publicCode = code;
  }
}

const hashChallenge = (challenge) => createHash('sha256').update(challenge).digest('hex');

const getBearerIdentity = async (request) => {
  const match = String(request.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) throw new RestoreCredentialError(401, 'unauthenticated');
  try {
    return await getAuth().verifyIdToken(match[1], true);
  } catch {
    throw new RestoreCredentialError(401, 'invalid_firebase_token');
  }
};

const storeChallenge = async (challenge, purpose, uid = null) => {
  await getFirestore().collection(CHALLENGES_COLLECTION).doc(hashChallenge(challenge)).set({
    purpose,
    uid,
    expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS),
  });
};

const readClientChallenge = (response) => {
  try {
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'),
    );
    if (typeof clientData.challenge === 'string' && clientData.challenge) {
      return clientData.challenge;
    }
  } catch {
    // Reported below as an invalid credential response.
  }
  throw new RestoreCredentialError(400, 'restore_credential_invalid');
};

// Challenges are single use: they are deleted before the response is verified.
const consumeChallenge = async (challenge, purpose, uid = null) => {
  const db = getFirestore();
  const reference = db.collection(CHALLENGES_COLLECTION).doc(hashChallenge(challenge));
  const stored = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    transaction.delete(reference);
    return snapshot.data();
  });
  if (
    !stored
    || stored.purpose !== purpose
    || stored.uid !== uid
    || stored.expiresAt.toMillis() < Date.now()
  ) {
    throw new RestoreCredentialError(400, 'challenge_invalid');
  }
};

const readCredentialResponse = (body) => {
  const response = body?.response;
  if (
    !response
    || typeof response.id !== 'string'
    || !response.id
    || response.id.length > MAX_CREDENTIAL_ID_LENGTH
    || typeof response.response !== 'object'
  ) {
    throw new RestoreCredentialError(400, 'restore_credential_invalid');
  }
  return response;
};

const verifyOrReject = async (verify) => {
  try {
    const result = await verify();
    if (result.verified) return result;
  } catch {
    // Library errors describe a malformed or forged response.
  }
  throw new RestoreCredentialError(400, 'restore_credential_invalid');
};

const createRegistrationOptions = async (uid) => {
  const userId = Buffer.from(uid, 'utf8');
  if (userId.length > MAX_WEBAUTHN_USER_ID_BYTES) {
    throw new RestoreCredentialError(409, 'restore_credential_unsupported');
  }
  const options = await generateRegistrationOptions({
    rpName: 'PlanIt',
    rpID: RP_ID,
    userName: uid,
    userID: new Uint8Array(userId),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: SUPPORTED_ALGORITHM_IDS,
  });
  await storeChallenge(options.challenge, 'registration', uid);
  return options;
};

const registerCredential = async (uid, body) => {
  const response = readCredentialResponse(body);
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
  if (!DEVICE_ID_RE.test(deviceId)) {
    throw new RestoreCredentialError(400, 'device_id_invalid');
  }
  const challenge = readClientChallenge(response);
  await consumeChallenge(challenge, 'registration', uid);
  const { registrationInfo } = await verifyOrReject(() => verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
    // Restore keys are created silently, without a user gesture.
    requireUserPresence: false,
    requireUserVerification: false,
    supportedAlgorithmIDs: SUPPORTED_ALGORITHM_IDS,
  }));

  const { credential } = registrationInfo;
  const db = getFirestore();
  const credentials = db.collection(CREDENTIALS_COLLECTION);
  const reference = credentials.doc(credential.id);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const [existing, replaced] = await Promise.all([
      transaction.get(reference),
      transaction.get(credentials.where('uid', '==', uid).where('deviceId', '==', deviceId)),
    ]);
    if (existing.exists && existing.data().uid !== uid) {
      throw new RestoreCredentialError(409, 'restore_credential_conflict');
    }
    replaced.docs.forEach((snapshot) => {
      if (snapshot.id !== credential.id) transaction.delete(snapshot.ref);
    });
    transaction.set(reference, {
      uid,
      deviceId,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + CREDENTIAL_TTL_MS),
    });
  });
};

const createAuthenticationOptions = async () => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: [],
    userVerification: 'discouraged',
  });
  await storeChallenge(options.challenge, 'authentication');
  return options;
};

const getRestorableUser = async (uid) => {
  if ((await getFirestore().doc(`deleted_accounts/${uid}`).get()).exists) return null;
  try {
    return await getAuth().getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
};

const signInWithCredential = async (body) => {
  const response = readCredentialResponse(body);
  const challenge = readClientChallenge(response);
  await consumeChallenge(challenge, 'authentication');

  const reference = getFirestore().collection(CREDENTIALS_COLLECTION).doc(response.id);
  const snapshot = await reference.get();
  if (!snapshot.exists) {
    throw new RestoreCredentialError(401, 'restore_credential_unknown');
  }
  const stored = snapshot.data();
  const userHandle = typeof response.response.userHandle === 'string'
    ? Buffer.from(response.response.userHandle, 'base64url').toString('utf8')
    : '';
  if (userHandle !== stored.uid) {
    throw new RestoreCredentialError(401, 'restore_credential_unknown');
  }

  const { authenticationInfo } = await verifyOrReject(() => verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: EXPECTED_ORIGINS,
    expectedRPID: RP_ID,
    credential: {
      id: snapshot.id,
      publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
      counter: stored.counter,
    },
    requireUserVerification: false,
    // Android retrieves restore keys without UI, so UP and UV are both unset.
    advancedFIDOConfig: { userVerification: 'discouraged' },
  }));

  const user = await getRestorableUser(stored.uid);
  if (!user) {
    await reference.delete();
    throw new RestoreCredentialError(401, 'restore_credential_unknown');
  }
  if (user.disabled) {
    throw new RestoreCredentialError(403, 'user_disabled');
  }

  await reference.update({
    counter: authenticationInfo.newCounter,
    lastUsedAt: Timestamp.now(),
  });
  return { customToken: await getAuth().createCustomToken(user.uid) };
};

export const restoreCredentials = onRequest(
  {
    region: 'europe-west1',
    timeoutSeconds: 30,
    memory: '256MiB',
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
      const action = request.body?.action;
      let result;
      if (action === 'registrationOptions') {
        const { uid } = await getBearerIdentity(request);
        result = { options: await createRegistrationOptions(uid) };
      } else if (action === 'register') {
        const { uid } = await getBearerIdentity(request);
        await registerCredential(uid, request.body);
        result = { registered: true };
      } else if (action === 'authenticationOptions') {
        result = { options: await createAuthenticationOptions() };
      } else if (action === 'signIn') {
        result = await signInWithCredential(request.body);
      } else {
        throw new RestoreCredentialError(400, 'action_invalid');
      }
      response.status(200).json(result);
    } catch (error) {
      const isPublicError = error instanceof RestoreCredentialError;
      if (!isPublicError) {
        console.error('restoreCredentials failed', {
          code: error?.code || 'unknown',
          name: error?.name || 'Error',
        });
      }
      response.status(isPublicError ? error.status : 500).json({
        error: isPublicError ? error.publicCode : 'internal_error',
      });
    }
  },
);

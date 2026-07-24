# Account deletion deployment

The client-side deletion workflow is intentionally fail-closed:

1. Reauthenticate with a linked password, Google, or Apple provider.
2. Revoke Sign in with Apple authorization when an Apple credential is used.
3. Create the immutable `deleted_accounts/{uid}` tombstone.
4. Delete known Firestore data, owned `shared_schedules`, and every object below
   `users/{uid}/attachments`.
5. Clear account-specific data cached on the current device.
6. Delete the Firebase Authentication user.

Firebase Auth is not deleted when a required cloud cleanup step fails. The
tombstone prevents other active devices or still-valid ID tokens from
recreating account data while deletion is in progress or after it completes.

## Required deployment order

Deploy the backend and rules before releasing a client that uses this flow:

```powershell
Set-Location functions
npm ci
Set-Location ..

firebase functions:secrets:set APPLE_CLIENT_ID
firebase functions:secrets:set APPLE_KEY_ID
firebase functions:secrets:set APPLE_PRIVATE_KEY
firebase functions:secrets:set APPLE_TEAM_ID

firebase deploy --only functions:revokeAppleAuthorization,firestore:rules,storage
```

The first deployment of Storage rules using `firestore.exists()` requires
enabling the Firebase-managed IAM connection between Cloud Storage Security
Rules and the default Firestore database. Accept that prompt or configure the
equivalent Firebase service-agent permission before release.

The client derives the standard function URL from
`EXPO_PUBLIC_FIREBASE_PROJECT_ID`. Configure this override only if the function
is exposed through a different HTTPS URL:

```text
EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT=https://europe-west1-PROJECT_ID.cloudfunctions.net/revokeAppleAuthorization
```

Rebuild the native app after adding or changing the override. Never place
`APPLE_PRIVATE_KEY`, `APPLE_KEY_ID`, or `APPLE_TEAM_ID` in an `EXPO_PUBLIC_*`
variable, the client repository, EAS Update payloads, or app binaries.

## Apple secret values

- `APPLE_CLIENT_ID`: the App ID used as the `client_id`/`aud` for the native
  authorization code. For the current iOS app this is normally
  `com.artomk.planit`; verify it against the Apple/Firebase provider
  configuration before deployment.
- `APPLE_KEY_ID`: the identifier of the Sign in with Apple private key.
- `APPLE_PRIVATE_KEY`: the complete PKCS#8 `.p8` private key.
- `APPLE_TEAM_ID`: the Apple Developer Team ID that issued the key.

The function verifies the caller's Firebase ID token with revocation checking,
exchanges the one-time Apple authorization code over TLS, verifies Apple's
signed identity token and audience, compares its `sub` with the Firebase user's
linked `apple.com` provider UID, and only then revokes the Apple refresh or
access token. Token material is never returned or logged.

## Verification checklist

- Run `npm.cmd run test:account-deletion` from the repository root.
- Run `npm.cmd audit --omit=dev --omit=optional` in `functions/`.
- Deploy rules to a non-production Firebase project and test:
  - password, Google, Apple web, and Apple native deletion;
  - an account with more than 400 schedule documents;
  - nested Storage attachments;
  - active and expired owned shares;
  - retry after a forced Firestore or Storage failure;
  - an unverified account after it creates its deletion tombstone;
  - a second signed-in device attempting to write after the tombstone exists.
- Confirm the function returns HTTP 204 only after Apple revocation succeeds.
- Confirm no `.p8`, authorization code, access token, or refresh token appears
  in client logs, Crashlytics, function logs, or repository history.

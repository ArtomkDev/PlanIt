# PlanIt Firebase Functions

## Android widget synchronization

`syncScheduleWidgets` sends a silent FCM invalidation when a schedule document
changes or is deleted. Only active Android installations displaying that schedule
receive it. The message contains identifiers and a version; the widget fetches
the latest document with its existing Firebase session and checks the device's
active status. Outdated and duplicate pushes cannot replace a newer snapshot.

FCM uses normal priority for these silent updates. Delivery can be delayed by
Doze, battery restrictions or connectivity. A unique, network-constrained Android
WorkManager task checks the cloud approximately every 15 minutes as a fallback.
Unsynced local edits and guest schedules are retained. No notification permission
prompt or visible notification is needed for widget synchronization.

Day navigation uses a native cache of the two weeks before and after the viewed
day, plus today. Cached taps update RemoteViews directly without starting React
Native or waiting for cloud requests. The cache is refilled near its edges and
expires at the next lesson boundary, midnight or a timezone change.

Deploy the rules and trigger before releasing a new Android binary (the binary
must include `expo-task-manager` and the widget scheduler plugin changes):

```powershell
firebase deploy --project planit-hub --only "firestore:rules,functions:syncScheduleWidgets"
```

On two physical devices, select a widget schedule, close the receiving app, and
edit a lesson on the other device. Check the silent update, then repeat offline,
after reconnection, after deleting the schedule, and after revoking the receiving
device. Force-stop suppresses Android background delivery until the app is opened
again. Verify that an unrelated schedule and unsaved local changes remain intact.

## Branded account emails

`sendAddPasswordEmail` sends the **Create password** email for authenticated,
verified Google/Apple accounts that do not have a password yet.

`sendPasswordResetEmail` sends the **Reset password** email for both the login
screen's **Forgot password?** action and password recovery in account settings.
It accepts a POST body with `email` and `locale` (`uk` or `en`) without requiring
a session. Unknown or disabled accounts and recipient cooldowns return the same
empty success response. Requests are limited to one email per recipient per
minute and ten requests per IP address per ten minutes; recipient and IP keys
are hashed before storage.

`sendAccountVerificationEmail` sends the initial and repeated registration
verification email to the authenticated account's address. Already verified
accounts receive no duplicate email.

`sendEmailChangeEmail` requires a verified account and reauthentication within
five minutes. It sends confirmation to the new address; the account address
changes only after the signed link is redeemed on the website.

All four functions use the same SMTP sender, HTML layout, and branded website
handler with action-specific Ukrainian and English copy. Generated Firebase action links
are emailed directly and never returned to the client. The client does not fall
back to the default Firebase email sender when the custom service fails.

The shared layout in `src/accountActionEmailTemplates.js` uses the PlanIt.
wordmark, mint and pink website accents, responsive spacing, and an authored
dark palette. SMTP messages embed `assets/email-wordmark-light.png` and
`assets/email-wordmark-dark.png` as inline CID images so the logo does not depend
on fonts installed on the reader's device. The light variant (ink with a pink dot
on a white badge) is the default; clients that support
`prefers-color-scheme: dark` swap in the white variant with a mint dot.
Body text uses Arial/Helvetica. Essential formatting is inline for email clients
that remove stylesheets. The fallback displays the complete signed URL as
copyable text with visual wrapping; it never inserts characters into the URL.
The plain-text alternative also includes the complete URL.

The `light dark` color-scheme declarations let every mail app follow the reader's
theme. Clients that support `prefers-color-scheme` use the authored dark palette.
Gmail apps ignore it and invert the colors themselves; images are not inverted,
which is why the light wordmark carries its own white badge. Browser previews do
not verify Gmail's inverted rendering.

Configure the Gmail app password before deployment:

```powershell
firebase functions:secrets:set SMTP_APP_PASSWORD
firebase deploy --project planit-hub --only "functions:sendAddPasswordEmail,functions:sendPasswordResetEmail,functions:sendAccountVerificationEmail,functions:sendEmailChangeEmail"
```

Enter only the 16-character Google app password when prompted. Do not put it in
the repository, a command-line argument, a screenshot, or a chat message. The
function sends through `smtp.gmail.com:465` as `planit.app.support@gmail.com`.

The optional `PASSWORD_RESET_CONTINUE_URL` Firebase parameter can point to a
custom HTTPS continue/state URL. When omitted, the function uses
`https://planitflow.com/`. Existing `functions/.env.<project>` overrides must use
this production website origin as well. The continue URL includes `passwordAction`
(`addPassword` or `resetPassword`) for password links, plus `accountAction` and
`lang` for all links so the website shows the right flow.

Deploy the updated website from `../planit-website` and all four functions before
releasing the updated app. The website supports `resetPassword`, `verifyEmail`,
`verifyAndChangeEmail`, and `recoverEmail`. The app derives the function
URLs from `EXPO_PUBLIC_FIREBASE_PROJECT_ID`. Optional
`EXPO_PUBLIC_ADD_PASSWORD_EMAIL_ENDPOINT` and
`EXPO_PUBLIC_PASSWORD_RESET_EMAIL_ENDPOINT` values can override the respective
HTTPS endpoints. Verification and email change have equivalent
`EXPO_PUBLIC_ACCOUNT_VERIFICATION_EMAIL_ENDPOINT` and
`EXPO_PUBLIC_EMAIL_CHANGE_EMAIL_ENDPOINT` overrides.

The Firebase-generated `/__/auth/action` link is rewritten before sending so
the user opens the branded website handler:

```text
https://planitflow.com/{uk|en}/auth/action
```

The original Firebase `mode`, `oobCode`, `apiKey`, `continueUrl`, and `lang`
query parameters are preserved for the website handler.

For reliable inbox delivery, configure SPF and DKIM for the sender domain in
the selected SMTP provider.

## Firebase-generated notifications and older app versions

Firebase itself sends the address-change/recovery notification to the previous
address when an email change is confirmed. Older app versions may also still
request default Firebase emails. Configure those project-level templates and
their action URL as part of this release; deploying the functions alone does
not update them.

Preview the templates without credentials or any remote changes:

```powershell
npm.cmd --prefix functions run configure:auth-emails -- --project planit-hub --locale uk
```

Apply with Google Application Default Credentials that can access the existing
`SMTP_APP_PASSWORD` secret and update the project's Authentication configuration:

```powershell
npm.cmd --prefix functions run configure:auth-emails -- --project planit-hub --locale uk --apply
```

The script reads the SMTP password directly from Secret Manager and never prints
it. It patches only notification templates, SMTP settings, the default notification
locale, and the action-handler URL; sign-in providers and authorized domains are
not changed. System templates use the selected project default locale; messages
sent through the four functions use the language requested by the app.

The current `planit-hub` project rejects system-template updates with
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, including when custom SMTP is included.
On 2026-10-25, an update restricted to `notification.sendEmail.callbackUri`
was rejected with the same error. The system callback therefore still uses
the Firebase default; do not report the local `planitflow.com` callback preview
as a published system setting or keep repeating the rejected update.
Publishing the shared functions template succeeds independently. Do not treat
a local configuration preview as a published system template: Firebase-generated
notifications retain their existing formatting until the project accepts an update.

The four application email functions were published with `planitflow.com` action
links and `PASSWORD_RESET_CONTINUE_URL=https://planitflow.com/` on 2026-10-25.
The domain is present in Firebase Authentication's authorized domains. The
deployment completed for all four functions; the CLI then reported that the
Artifact Registry cleanup policy was not configured. Check function state before
repeating a deployment after that post-deployment error.

## Native Apple account deletion

The iOS app calls `revokeAppleAuthorization` before deleting an Apple-linked
account. Its default URL is derived from `EXPO_PUBLIC_FIREBASE_PROJECT_ID` in
`europe-west1`; `EXPO_PUBLIC_APPLE_TOKEN_REVOCATION_ENDPOINT` is an optional
HTTPS override. The function verifies recent Firebase authentication and checks
that the Apple identity belongs to the same account before revoking the token.

Configure `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and
`APPLE_PRIVATE_KEY` in Firebase Secret Manager before deployment. The native
client ID must match the iOS bundle identifier (`com.artomk.planit`). Use an
Apple Sign in with Apple key from the same developer team. Supply the private
key through a local file, rather than a command-line value or app environment:

```powershell
firebase functions:secrets:set APPLE_CLIENT_ID --project planit-hub
firebase functions:secrets:set APPLE_TEAM_ID --project planit-hub
firebase functions:secrets:set APPLE_KEY_ID --project planit-hub
firebase functions:secrets:set APPLE_PRIVATE_KEY --project planit-hub --data-file "<private-key.p8>"
firebase deploy --project planit-hub --only "functions:revokeAppleAuthorization"
```

Verify all four email endpoints and the Apple endpoint in the configured
project before releasing. A GET request should return `405 Method Not Allowed`;
`404` means the app cannot reach its required handler at that address. This
read-only smoke check does not send emails or revoke credentials. Complete an
authenticated deletion test on an iOS build after deployment.

# PlanIt Firebase Functions

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
dark palette. SMTP messages embed `assets/email-wordmark.png` as an inline CID
image so the logo does not depend on fonts installed on the reader's device.
Body text uses Arial/Helvetica. Essential formatting is inline for email clients
that remove stylesheets. The fallback displays the complete signed URL as
copyable text with visual wrapping; it never inserts characters into the URL.
The plain-text alternative also includes the complete URL.

The `light only` color-scheme meta tag disables forced recoloring in supported
Gmail apps on Google accounts. CSS restores `light dark` on the root for clients
that support the authored dark palette. Older Gmail versions and non-Google
accounts can still recolor HTML; browser previews do not verify their rendering.

Configure the Gmail app password before deployment:

```powershell
firebase functions:secrets:set SMTP_APP_PASSWORD
firebase deploy --project planit-hub --only "functions:sendAddPasswordEmail,functions:sendPasswordResetEmail,functions:sendAccountVerificationEmail,functions:sendEmailChangeEmail"
```

Enter only the 16-character Google app password when prompted. Do not put it in
the repository, a command-line argument, a screenshot, or a chat message. The
function sends through `smtp.gmail.com:465` as `planit.app.support@gmail.com`.

The optional `PASSWORD_RESET_CONTINUE_URL` Firebase parameter can point to a
custom HTTPS continue/state URL. When omitted, the function uses the current
project's `firebaseapp.com` domain. The continue URL includes `passwordAction`
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
https://planit-hub.firebaseapp.com/{uk|en}/auth/action
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
Publishing the shared functions template succeeds independently. Do not treat
a local configuration preview as a published system template: Firebase-generated
notifications retain their existing formatting until the project accepts an update.

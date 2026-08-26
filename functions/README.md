# PlanIt Firebase Functions

## Personalized add-password email

`sendAddPasswordEmail` sends the dedicated **Create password** email for
Google/Apple accounts. It deliberately does not return the generated Firebase
action link to the client.

Configure the Gmail app password before deployment:

```powershell
firebase functions:secrets:set SMTP_APP_PASSWORD
firebase deploy --only functions:sendAddPasswordEmail
```

Enter only the 16-character Google app password when prompted. Do not put it in
the repository, a command-line argument, a screenshot, or a chat message. The
function sends through `smtp.gmail.com:465` as `planit.app.support@gmail.com`.

The optional `PASSWORD_RESET_CONTINUE_URL` Firebase parameter can point to a
custom HTTPS continue/state URL. When omitted, the function uses the current
project's `firebaseapp.com` domain.

The Firebase-generated `/__/auth/action` link is rewritten before sending so
the user opens the branded website handler:

```text
https://planit-hub.firebaseapp.com/{uk|en}/auth/action
```

The original Firebase `mode`, `oobCode`, `apiKey`, `continueUrl`, and `lang`
query parameters are preserved for the website handler.

For reliable inbox delivery, configure SPF and DKIM for the sender domain in
the selected SMTP provider.

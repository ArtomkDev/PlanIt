# Firebase environments

| Environment | Firebase project | Used by | Local config |
| --- | --- | --- | --- |
| Production | `planit-hub` ("PlanIt") | release APK/AAB, `build:web`, `deploy:web`, EAS `production` | `.env`, `google-services.json`, `GoogleService-Info.plist` |
| Development | `planitflow-dev` ("PlanIt Dev") | `expo start` / `npm run dev`, `npm run build:dev` | `.env.development`, `google-services.dev.json`, `GoogleService-Info.dev.plist` |

The project IDs live in `src/config/firebaseProjects.cjs`. `planit-hub` cannot be
renamed and stays production because every installed build is bound to it.

Both projects use the Blaze plan, Firestore `(default)` Standard edition, Email/Password
and Google sign-in, email-enumeration protection, and the same password policy
(enforced; upper, lower, numeric; 10–128 characters). Development has its own users,
data, Storage bucket and budget alert, and never shares data with production.

## How the environment is chosen

Expo loads `.env.<NODE_ENV>` before `.env`. Development commands set
`NODE_ENV=development`, so `.env.development` overrides the production Firebase values;
release scripts and `expo export` use `NODE_ENV=production` and read only `.env`.
`GOOGLE_SERVICES_FILE` and `GOOGLE_SERVICE_INFO_PLIST` select the native config files.

`app.config.js` refuses to start a development run against `planit-hub` and refuses
native config files that belong to a different project than
`EXPO_PUBLIC_FIREBASE_PROJECT_ID`. `scripts/build-aab.ps1` and `scripts/check-web.cjs`
refuse release builds that are not on `planit-hub`.

All env and native config files are gitignored. Recreate the development ones with:

```powershell
npx.cmd --yes --package=firebase-tools@15.34.1 firebase apps:sdkconfig ANDROID 1:13958402718:android:920d70d3e56d65096d218f --project planitflow-dev -o google-services.dev.json
npx.cmd --yes --package=firebase-tools@15.34.1 firebase apps:sdkconfig IOS 1:13958402718:ios:0b4a9906a9c78b346d218f --project planitflow-dev -o GoogleService-Info.dev.plist
npx.cmd --yes --package=firebase-tools@15.34.1 firebase apps:sdkconfig WEB 1:13958402718:web:9424fecd48d39a836d218f --project planitflow-dev
```

Native config is compiled into the APK, so rebuild the development client
(`npm.cmd run build:dev`) after switching environments.

## Deploying

`.firebaserc` maps `default` and `dev` to `planitflow-dev` and `prod` to `planit-hub`,
so a command without `--project` can only reach development. Always name the project:

```powershell
npx.cmd --yes --package=firebase-tools@15.34.1 firebase deploy --project dev --only "firestore:rules,storage"
npx.cmd --yes --package=firebase-tools@15.34.1 firebase deploy --project prod --only "firestore:rules,storage"
```

Each project has its own Functions secrets and parameters. Development uses the
production `SMTP_APP_PASSWORD`, the same `not-configured` placeholders for the four
`APPLE_*` secrets, and `functions/.env.planitflow-dev`
(`PASSWORD_RESET_CONTINUE_URL=https://planitflow-dev.firebaseapp.com/`), which is
gitignored like `functions/.env.planit-hub`. The Firebase CLI requires every secret
referenced by the codebase to exist, even for a partial `--only` deploy.
`syncScheduleWidgets` uses a retry policy, so its first deploy to a project needs
`--force`.
Account-action emails link to the production website handler on `WEBSITE_URL`, which
cannot apply development action codes; verify development email/password accounts
through Google sign-in or the Admin SDK until a development handler exists.

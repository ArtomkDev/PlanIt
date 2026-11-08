# Production web deployment

The application is https://app.planitflow.com. The website, guides, and legal
documents remain at https://planitflow.com in the separate `planit-website`
repository. Its `/app` and `/app/` routes redirect to the application.

Hosting cleanup on 25 October 2026: the Firebase console shows **Connected** for
both custom domains. Only the two production Hosting sites and their `live`
channels remain. `www` has been removed from Hosting and DNS; the app CNAME, apex
A and both verification TXT records remain. The website was independently
published through `hosting:website` with build `4f154d032980`, version
`ccfe2b3016cec2bb`. The app remains on version `407655a29fb35ff2`, build
`1e95a84a53ff`. Website lint/build, 67 unit tests, 12 export tests, all 15 live
indexable pages and the app's live file/routing checks passed. Earlier account-test
limitations in the historical checkpoint below are separate from this cleanup.

On 7 November 2026 the app moved from the legacy `planit-demo` site to
`planitflow-app` (the live release was cloned, then `app.planitflow.com` was
re-attached). `planit-demo` keeps the pre-move releases for rollback. Development
uses the separate `planitflow-dev` project; see [FIREBASE_ENVIRONMENTS.md](FIREBASE_ENVIRONMENTS.md).

| Repository | Firebase project | Hosting target | Site | Output |
| --- | --- | --- | --- | --- |
| PlanIt | planit-hub | app | planitflow-app | dist |
| planit-website | planit-hub | website | planit-hub | out |

## Application releases

Open the release menu with `npm.cmd run build` in an interactive terminal.
Use ↑ and ↓ to move, Enter to select, and Esc to go back or exit.
It includes Android APK and AAB builds with current, patch, minor, and major
version choices, a development client build, web build and publication, and
legal document workflows.
If a build fails after a version bump, select the current version to retry.
Legal publication updates the separate website from the sibling
`planit-website` checkout.

Run from `D:\GitHub\ArtomkDev\PlanIt` with the existing public Firebase values
in the Expo environment. Keep private credentials outside `EXPO_PUBLIC_*`.

```powershell
npm.cmd run test:web
npm.cmd run build:web
npm.cmd run preview:web
```

`build:web` checks the production project and target, checks the legal generation,
exports with a fresh Metro cache (`expo export --platform web --clear`), adds the
noindex directive, and records/verifies every exported file in `dist/release.json`.
`check:web` rejects unhashed immutable assets, source maps, unexpected private files,
and private environment values found in the export. Firebase's public client
configuration is intentionally shipped to the browser; authorization belongs to
Firebase Auth and the existing rules.

`preview:web` uses Expo's production server at http://localhost:5002. Open `/`
to inspect rendering and client navigation. Expo SDK 57's static server does not
apply Firebase rewrites when refreshing a nested route. The Firebase emulator's
Windows `glob-slasher` dependency also changes URL slashes to backslashes, so it
does not provide reliable Hosting-rule verification on this machine.

Publish with the complete application-only workflow:

```powershell
npm.cmd run deploy:web -- --account artomk.dev@gmail.com --non-interactive
npm.cmd run check:web:live
```

The deploy script reruns the focused tests, builds, verifies the mapping immediately
before upload, and invokes the pinned Firebase CLI with
`--project planit-hub --only hosting:app`. It does not deploy any backend services
or the website. The account argument is needed if the CLI's default account lacks
project access. For an already verified build, the equivalent upload is:

```powershell
node scripts/check-web.cjs --config
npx.cmd --yes --package=firebase-tools@15.34.1 firebase deploy --project planit-hub --only hosting:app --account artomk.dev@gmail.com --non-interactive
```

To test actual Firebase routing and headers before a production release:

```powershell
npx.cmd --yes --package=firebase-tools@15.34.1 firebase hosting:channel:deploy web-check --expires 1d --project planit-hub --only app --account artomk.dev@gmail.com --non-interactive
node scripts/check-web.cjs --url <Firebase-issued-preview-URL>
```

The URL check compares the release and all assets byte for byte, tests nested
routes, real asset 404s, noindex, cache policy, and reserved Firebase auth helpers.
It uses normal certificate validation. Browser/account tests are additional to
these HTTP checks.

## Domains, authentication, and caching

Firebase issued the CNAME target for `app.planitflow.com`. DNS was added
in Dynadot with a five-minute TTL. The apex A record and both existing TXT records
are preserved. Following the user's updated two-domain requirement, the `www`
custom-domain attachment and its CNAME were removed. Only `planitflow.com` and
`app.planitflow.com` remain as connected custom domains.

The deployment targets are `app` and `website`; the previous website target name
`legal` was removed from configuration and the legal-publication wrapper was
updated. The task-created `prelaunch-web` channel and both stale preview Auth
domains were removed. Firebase's mandatory `web.app` / `firebaseapp.com` aliases
remain. The default site ID cannot be changed or deleted. The user explicitly
chose to retain Firebase Hosting with these two custom domains after reviewing
that limitation; recreating sites would not remove the mandatory aliases.

`src/config/website.cjs` is the source of truth for public origins:
`WEBSITE_URL` serves the website and legal documents; `WEB_APP_URL` serves public
share links and native share app links. Visitor-preview buttons use `/share/<code>`
on the current web origin, including localhost. Copy/share buttons use the public
`WEB_APP_URL` on every platform. Share records store codes, not domains.

There is no separate share-domain environment variable or fallback Firebase host.
Legal document browser addresses are assembled from `WEBSITE_URL`, language and
document slug; generated legal content does not store domain copies.

Firebase Functions deploys a separate package. `npm run config:sync` generates
`functions/src/website.generated.cjs` from the canonical configuration; do not edit
that file manually. `npm run config:check` detects stale generated configuration,
and the Functions predeploy hook synchronizes it automatically.

After changing an origin, synchronize configuration, rebuild the web/native apps,
and redeploy affected Functions. Review DNS/Hosting, Firebase Authorized Domains,
OAuth callbacks, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, and native association files
on the new host. Existing installed native builds retain their old app-link hosts.
Keep an old domain and redirect its share paths when existing external links must
continue working; changing configuration alone cannot redirect those links.

The Firebase client still targets `planit-hub`. Since 1 November 2026 the web
build uses `authDomain=app.planitflow.com`, so the Google popup and its consent
screen show the app's own domain instead of `planit-hub.firebaseapp.com`. Its
OAuth callback is `https://app.planitflow.com/__/auth/handler`, which Firebase
Hosting serves on the connected custom domain. That URI is registered in the
Google Cloud web OAuth client next to the previous
`https://planit-hub.firebaseapp.com/__/auth/handler`; keep both. Native app-link
intent filters stay on `planit-hub.firebaseapp.com` through
`EXPO_PUBLIC_FIREBASE_AUTH_LINK_DOMAIN`. Email/password and Google are enabled
in the live project; Apple is not configured as a web provider.
The app domain and the Firebase Hosting alias were added to Authorized Domains
during the initial deployment; the application no longer uses the alias for sharing.
Register `https://<domain>/__/auth/handler` with every OAuth provider before
changing `authDomain` again. Google shows the app name instead of the domain
only after the OAuth branding is verified.
See [Firebase's popup/redirect guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices).

The four existing branded account-email Functions use the website's localized
`/{uk,en}/auth/action` pages. The website validates signed action codes and
continuation origins, and maps the currently published website-root continuation
to the app while retaining query and fragment. No Functions deployment is needed.
The project's default Firebase system-template callback update is rejected with
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`; those automatic system emails retain the
Firebase default. This existing restriction is documented in `functions/README.md`.
Do not report a locally generated template preview as a published setting.

The existing Functions return successful CORS preflights for the app origin.
No client App Check initialization or enforced App Check service was found.
No new Firebase client, backend, CORS layer, or service worker was added.

HTML and mutable files revalidate. Only checked content-hashed Expo bundles and
assets are immutable. The SPA rewrite covers React Navigation's app routes,
including `MainLayout/...`, password recovery, legal pages, and sharing. Missing
asset requests are not rewritten, and `/__/auth/*` remains reserved for Firebase.
If adding a new top-level navigation route, update the Hosting route pattern and
its focused test. All application responses carry `X-Robots-Tag: noindex`; the
shell also has a robots meta tag. `robots.txt` permits crawling so noindex can be
read. The marketing website's sitemap contains only website pages.

## Independent website release

Run from `D:\GitHub\ArtomkDev\planit-website`:

```powershell
npm.cmd run site:update
```

The existing workflow checks lint, tests, TypeScript/build, export integrity,
metadata and route continuity, then deploys only `hosting:website` with explicit
project/account selection and verifies the live website. `APP_URL` /
`NEXT_PUBLIC_APP_URL` is separate from `SITE_URL`. Do not use the website's
deployment command from the application repository or run unrestricted deploys.

## Rollback

In Firebase Console → Hosting → select the correct site → Previous releases →
open the desired release menu → Roll back. This republishes the retained Hosting
version without changing DNS, Auth, Functions, database, rules, or the other site.
After rollback, verify HTTPS, routing and sign-in against that release. The local
byte-for-byte checker will intentionally fail if the rolled-back release differs
from the current local build; use the matching saved build to compare it.

Before this deployment:

| Site | Previous release | Previous version |
| --- | --- | --- |
| planit-demo | 1779782257182000 (2026-05-26) | c9f35bf2f261cb33 |
| planit-hub | 1792951345724000 (2026-10-25) | 2879dfbfa47a3470 |

The previous app predates this production setup, so an emergency rollback also
restores its previous URL/routing behavior. Keep the new DNS connection; release
rollback is independent of the certificate and domain attachment.

## Deployment checkpoint — 25 October 2026

- Application build: `1e95a84a53ff` (full ID in `dist/release.json`), Hosting
  release `1792955460095000`, version `407655a29fb35ff2`.
- Website build: `e2ac3427da3b`, Hosting release `1792954867521000`, version
  `8335110404c9c5df`.
- App: 127 focused tests passed. Expo export and private-value checks passed.
  Live HTTPS checks matched every exported file and verified route responses,
  noindex, caching, missing-asset 404s, and Firebase helper endpoints.
- Website: lint, 67 unit tests, TypeScript/production build, 12 export tests,
  export/SEO checks and live verification passed. All 15 indexable pages, legal
  asset integrity, Google verification file, canonical/hreflang, sitemap and
  redirects were verified. `/app` and `/app/` preserve query strings in their
  301 Location. Browser verification retained the fragment through the redirect;
  React Navigation consumes unrelated query parameters when opening Auth.
- Browser: guest onboarding created only `Deployment check 2026-10-25`, and that
  guest schedule survived reload on the new origin. Legal-page direct entry,
  refresh, Back/Forward, and the final settings-route refresh were verified.
- The web linking table fixes nested-screen restoration. Native linking retains
  the existing wildcard configuration. Web sign-out now shows a browser confirm;
  native sign-out retains the existing alert flow.
- The OAuth popup reached the existing Google callback, but the completed session
  belonged to the browser's default account rather than the approved review
  account. Only identity and restored cloud data were inspected; no real schedule
  was edited and no verification/recovery email was sent. A sign-out confirmation
  was opened after the fix. The automation tool then stopped because it could not
  determine the Windows browser URL reliably enough for its policy checks; actual
  sign-out completion is not verified. Dismiss/complete that confirmation manually
  before continuing with the review account.
- Authenticated startup logged `FirebaseError: Missing or insufficient permissions`.
  Schedule data was readable, but the failing operation is not yet isolated.
  Do not treat cloud registration/sharing/email scenarios as fully verified.
- The last domain API result was `HOST_ACTIVE`, `OWNERSHIP_ACTIVE`,
  `CERT_PROPAGATING`. Normal HTTPS validation succeeds, but Firebase's final
  **Connected** status has not yet been verified.
- Both Graphify code graphs were updated. All pre-existing changes in both
  repositories were preserved. No native build/version change or backend
  deployment was performed. The task-created `prelaunch-web` preview expires
  after one day; the production release is independent of that channel.
- Automatic approval review rejected both the recursive temporary-folder cleanup
  and a narrower exact-file deletion with only `blocked by policy` as the stated
  reason. Task helpers and baseline snapshots remain outside the repositories in
  `C:\Users\artom\AppData\Local\Temp\planit-web-deploy-20261025`. The local preview
  server was stopped. Final diff checks passed after audit whitespace cleanup.

Remaining before marking the deployment fully verified: confirm Firebase
Connected, complete sign-out, sign in explicitly as the approved review account,
verify cloud schedules and sharing with disposable data, isolate the permission
error, and test delivered verification/recovery links. Password changes require
the user to complete credential entry and submission.

## Auth domain release — 1 November 2026

- Application build `8f9712dc1d3f` was published with
  `authDomain=app.planitflow.com` from the uncommitted working tree at the
  user's request. The previous application release (build `1e95a84a53ff`,
  version `407655a29fb35ff2`) is the rollback target.
- `build:web` and `check:web:live` passed. `test:password-reset`,
  `test:native-guards`, and the hosting/sharing tests passed; `test:sessions`
  failed because its `Root.jsx` mocks did not cover the new
  `./navigation/mainLayoutLinking` import, so the verified build was uploaded
  with the direct Hosting command instead of `deploy:web`. The mock was added
  afterwards and the complete `test:web` suite passes.
- The live Google account chooser uses
  `redirect_uri=https://app.planitflow.com/__/auth/handler` and shows
  `planitflow.com`. No account was selected during the check.

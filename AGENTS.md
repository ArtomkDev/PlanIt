# PlanIt Engineering Instructions

## Working model

- Scale the process to the change. Fix isolated typos, labels, and obvious local style issues directly. For meaningful features, shared-code changes, non-local bug fixes, or refactors, use `$engineering-workflow` and follow: understand -> search -> design -> implement -> verify -> critically review -> improve if needed -> clean up -> finish.
- Search before creating. Determine the existing owner, similar implementations, consumers, tests, and platform variants before adding a component, hook, provider, service, utility, configuration module, or abstraction.
- Analyze the blast radius before changing shared code. Passing tests is necessary evidence, not proof that the design, placement, API, reuse, platform behavior, or maintainability is sound.
- Make the smallest coherent change. Do not refactor, rename, move, reformat, or modernize unrelated code.
- For substantial work, record `git status --short` before editing. Preserve every pre-existing change and review the final diff and status before finishing.

## Project map

PlanIt is an Expo/React Native application targeting Android, iOS, and React Native Web.

- `index.js` registers Expo and the Android widget task; `App.js` delegates to `src/Root.jsx`. Root providers, auth/guest routing, deep links, analytics, and navigation begin in `src/Root.jsx`, `src/layouts/`, and `src/navigation/`.
- Put cross-feature UI in `src/components/`, feature screens and local UI in `src/pages/`, shared hooks in `src/hooks/`, application state/providers in `src/context/`, side-effecting domain or external operations in `src/services/`, shared logic in `src/utils/`, integration/default configuration in `src/config/`, translations in `src/locales/`, and widgets in `src/widgets/`.
- `ScheduleProvider` is the center of schedule state/actions. Firebase initialization is in `src/config/firebase.js`; schedule persistence is in `src/config/firestore.js`; focused external behavior belongs in existing services. Do not add a parallel store, sync engine, Firebase client, or data-access layer.
- Inspect existing UI primitives before styling controls locally, especially `src/components/ui/AppSwitch.jsx`, `src/components/ui/SettingsKit/`, `BottomSheet.jsx`, `SettingsHeader.jsx`, `GradientBackground.jsx`, and `MorphingLoader.jsx`.
- Preserve `.native`, `.web`, and `.android` variants. Durable native configuration belongs in `app.config.js` and `plugins/`; `android/` and `ios/` are generated Expo prebuild output unless a task explicitly targets them.
- `content/legal/` is authoritative; generate `src/config/legalDocuments.generated.js` with the existing `legal:*` scripts. `functions/` is a separate Node 22 ESM Firebase Functions package.

## Skill routing

- Use `$engineering-workflow` for the design pass, impact analysis, verification, and post-implementation engineering audit on meaningful changes.
- Use `$architecture-guardian` when adding features/files, changing shared code, refactoring, or deciding between a local fix and a reusable source of truth.
- Use `$production-code-quality` whenever production source or project configuration is written or refactored.
- Use `$repository-hygiene` whenever repository files may change or verification may create artifacts.
- Use `$skill-management` for requests to add, install, import, create, update, or reorganize Codex skills.
- Use `$react-native-best-practices` for jank, slow startup, memory, bundle size, or animation performance work. Judge Android performance on a release build on a low-end device; debug and dev-client builds are several times slower and use far more memory.
- For architecture and relationship questions, query the existing Graphify graph first with `npm.cmd run graphify:query -- "<question>"`; use `path` or `explain` through `npm.cmd run graphify -- ...` when focused traversal helps. Confirm important conclusions in source.

## Non-negotiable quality and safety

- Match nearby naming, imports, component composition, state flow, error handling, theme access, localization, and platform patterns. Do not create a second architecture beside the current one.
- Prefer one authoritative implementation for one responsibility, but extract only when callers share the same concept and responsibility and a stable, smaller API provides a real maintenance benefit.
- Keep code direct and human-readable. Avoid tutorial comments, obvious JSDoc, speculative layers, generic utility dumping grounds, needless wrappers, broad error swallowing, duplicated fallback logic, debug logging, dead code, and unused imports or variables.
- Brand logos (Google, Apple, Telegram, WhatsApp, Instagram, Facebook, and others) come only from `src/components/ui/BrandIcons.jsx`, built from official or simple-icons paths. Never use icon-library recreations such as Phosphor `*Logo` icons, never recolor or tint a mark (Google "G" stays full-color; Apple is black or white only), and never use a brand logo as a generic icon. Without an official mark, use a neutral non-brand icon. Keep brand buttons in the app's border and radius style, and check the brand's guidelines before adding a mark.
- Never use the repository root as scratch space. Put disposable exports, screenshots, copied fixtures, and one-off scripts in the OS temp directory when possible, then remove task-created artifacts.
- Never use `git reset --hard`, `git clean -fd`, or broad restore operations. Do not delete untracked, ignored, generated, credential, native, release, dependency, or Graphify content without establishing its exact purpose and ownership.

## Verification

- For local Android development and widget work, build and install a development client with `npm.cmd run build:dev -- -Install -DeviceSerial <serial>` and run Metro with `npm.cmd run dev-start`. Keep Fast Refresh available; do not replace the development client with a release, preview, or standalone APK unless the user explicitly requests that build type.
- Before installing an APK as a development build, verify the actual APK is debuggable and includes Expo Dev Launcher. A filename containing `Dev` is insufficient. JavaScript changes use Metro/Fast Refresh; native dependencies, widgets, and Expo plugin changes require rebuilding the dev APK. A standalone verification build must not become the delivered build for a development task.
- Use the narrowest relevant existing `test:*` script. Run `npm.cmd run legal:check` for legal generation changes and `npm.cmd --prefix functions run check` plus `npm.cmd --prefix functions test` for Functions changes. The root package has no repository-wide lint or typecheck script; do not claim otherwise.
- Verify beyond tests: inspect changed code in context, callers/imports, representative consumers, platform variants, state and failure paths, accessibility, localization, theme behavior, and the final diff as applicable.
- After source-code changes, update the AST graph with `npm.cmd run graphify:update-code`. Use the semantic update only when changed documents/images require it and a supported backend is available. Agent-instruction-only changes do not require a graph rebuild.
- Finish only after accounting for final `git status --short`, removing task-created temporary artifacts, and deciding whether the implementation should be kept or materially improved.

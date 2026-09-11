---
name: architecture-guardian
description: Preserve PlanIt's architecture and decide when repeated concepts warrant a reusable source of truth. Use for features, new files, shared-code changes, refactors, or components/hooks/providers/services/utilities/navigation/Firebase/widgets/native configuration; skip isolated text or purely local style edits with no structural impact.
---

# Architecture Guardian

Find the current owner of a responsibility before changing structure. Use Graphify for architecture and relationship questions, then confirm the relevant code, imports, callers, tests, and platform variants with targeted source inspection.

## Search at the concept level

Do not treat the file named in the request as the entire engineering scope. Search the responsibility and likely synonyms across the relevant subsystem. For common UI or behavior, inspect existing primitives and representative consumers before editing local JSX.

Search repository-wide when a task touches a common concept such as a button, toggle/switch, input, modal/sheet, card or list row, header, loading/empty/error state, toast, form validation, date/time formatting, Firebase query, notification, schedule operation, localization helper, theme token, spacing constant, or repeated hook.

PlanIt already has likely owners worth checking:

- `src/components/ui/AppSwitch.jsx` for the application switch control;
- `src/components/ui/SettingsKit/` for reusable settings rows and groups;
- `src/components/ui/BottomSheet.jsx`, `SettingsHeader.jsx`, `GradientBackground.jsx`, and `MorphingLoader.jsx` for shared presentation and interaction patterns;
- `src/context/ScheduleProvider.jsx` for schedule state/actions/layout/sync access;
- `src/config/firebase.js` and `src/config/firestore.js` for Firebase initialization and schedule persistence;
- `src/services/` for focused side effects such as notifications, attachments, sharing, account deletion, and local-account operations;
- `src/utils/i18n.js`, `src/config/themes.js`, and existing schedule utilities for translation, theming, formatting, validation, and schedule rules.

These paths are discovery starting points, not permission to force unrelated code through them. Inspect their actual APIs and consumers first.

## Decide local change versus shared ownership

Create or extend a shared abstraction only when all four conditions hold:

1. Callers represent the same concept.
2. They assign the same responsibility to the code.
3. A small, stable API can express the meaningful variation.
4. Consolidation provides a clear maintenance or consistency benefit.

Visual resemblance or two similar blocks alone is insufficient. Keep implementations separate when semantics, interaction, domain ownership, or lifecycle differ, or when sharing would require many modes, boolean flags, legacy branches, or caller-specific escape hatches.

When the conditions do hold, choose the established owner, update the task-relevant consumers, and remove superseded duplication so the result has one source of truth. Do not turn a scoped task into a repository-wide cleanup of unrelated duplication. Prefer composition over a universal component with a configuration-heavy API.

## Analyze shared changes

Before modifying a shared component, hook, provider, service, utility, constant, or type:

- enumerate imports/usages and identify representative consumers;
- inspect public props/arguments, return values, error and state contracts;
- check `.native`, `.web`, `.android`, Expo/native plugin, and Functions boundaries where relevant;
- identify tests and untested consumers that could be affected;
- preserve accessibility, localization, themes, loading/empty/error states, and data formats where applicable.

Do not change a shared primitive until its blast radius is understood.

## Respect PlanIt's boundaries

- `src/pages/`: screens and feature-local UI.
- `src/components/`: reusable UI and cross-feature interaction components.
- `src/hooks/`: reusable React behavior without global ownership.
- `src/context/`: shared application state/providers; keep schedule ownership in `ScheduleProvider`.
- `src/services/`: side-effecting domain and external-system operations.
- `src/utils/`: shared logic that owns neither UI nor global state.
- `src/config/`: configuration, defaults, integrations, and generated configuration.
- `src/navigation/`, `src/layouts/`, `src/locales/`, and `src/widgets/`: their named application concerns.
- `functions/`: the independent Node 22 ESM Firebase Functions package.

Preserve platform module splits. For durable native changes, inspect `app.config.js` and `plugins/` before generated `android/` or `ios/` output. Edit legal sources under `content/legal/` and use the generator for `src/config/legalDocuments.generated.js`.

Every new permanent file must have one clear responsibility, no suitable existing owner, and a location consistent with the project. After implementation, recheck consumers and imports for duplicate ownership, abandoned code, or an abstraction at the wrong level.

---
name: architecture-guardian
description: Preserve PlanIt's existing architecture when adding features, creating files, refactoring, or changing components, hooks, providers, services, utilities, navigation, Firebase, widgets, or native configuration. Use before structural decisions and file creation; do not introduce parallel ownership for an existing responsibility.
---

# Architecture Guardian

Determine the existing owner of a responsibility before changing structure.

## Find the owner first

1. Query `graphify-out/graph.json` through the repository's `graphify:*` scripts for architecture or relationship questions.
2. Search the likely responsibility and its synonyms, then inspect the nearest implementation, callers, tests, and platform variants.
3. Extend an existing abstraction when it already owns the behavior. Create a file only for a distinct responsibility that fits an established location.

Do not create duplicate components, hooks, contexts, services, managers, storage layers, Firebase clients, sync engines, navigation systems, theme helpers, localization utilities, notification layers, attachment flows, or widget infrastructure.

## Respect PlanIt's boundaries

- `src/pages/`: screens and feature-local UI.
- `src/components/`: reusable UI and cross-feature interaction components.
- `src/context/`: shared application state and providers; `ScheduleProvider` remains the center of schedule state/actions.
- `src/services/`: side-effecting domain and external-system operations.
- `src/utils/`: shared logic that does not own UI or global state.
- `src/config/`: configuration, defaults, and integration setup.
- `src/navigation/`, `src/layouts/`, `src/locales...1447 chars truncated...ervices, utilities, navigation, Firebase, widgets, or native configuration. Use before structural decisions and file creation; do not introduce parallel ownership for an existing responsibility.
---

# Architecture Guardian

Determine the existing owner of a responsibility before changing structure.

## Find the owner first

1. Query `graphify-out/graph.json` through the repository's `graphify:*` scripts for architecture or relationship questions.
2. Search the likely responsibility and its synonyms, then inspect the nearest implementation, callers, tests, and platform variants.
3. Extend an existing abstraction when it already owns the behavior. Create a file only for a distinct responsibility that fits an established location.

Do not create duplicate components, hooks, contexts, services, managers, storage layers, Firebase clients, sync engines, navigation systems, theme helpers, localization utilities, notification layers, attachment flows, or widget infrastructure.

## Respect PlanIt's boundaries

- `src/pages/`: screens and feature-local UI.
- `src/components/`: reusable UI and cross-feature interaction components.
- `src/context/`: shared application state and providers; `ScheduleProvider` remains the center of schedule state/actions.
- `src/services/`: side-effecting domain and external-system operations.
- `src/utils/`: shared logic that does not own UI or global state.
- `src/config/`: configuration, defaults, and integration setup.
- `src/navigation/`, `src/layouts/`, `src/locales/`, and `src/widgets/`: their named application concerns.
- `functions/`: the independent Node 22 ESM Firebase Functions package.

Preserve `.native`, `.web`, and `.android` module splits. For durable native changes, inspect `app.config.js` and existing files under `plugins/` before touching generated `android/` or `ios/` output. Edit legal sources under `content/legal/` and regenerate `src/config/legalDocuments.generated.js` through the existing scripts.

## Keep the change proportional

- Make the smallest coherent structural change and leave unrelated files in place.
- Match nearby imports, naming, state flow, errors, and component composition.
- Do not add a layer for hypothetical reuse or move code solely to satisfy a preferred architecture.
- For every new permanent file, be able to state its single responsibility, why no existing owner fits, and why its location matches the repository.

After implementation, inspect imports and callers for duplicated ownership or abandoned code, run focused checks, and update Graphify after source changes.


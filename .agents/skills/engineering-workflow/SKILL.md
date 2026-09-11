---
name: engineering-workflow
description: Design, implement, verify, and critically review meaningful PlanIt engineering changes. Use for features, shared-code changes, non-local bug fixes, risky data/platform work, or refactors; skip the full workflow for isolated typos, labels, and obvious one-line presentation edits.
---

# Engineering Workflow

Use this lifecycle for meaningful work:

`UNDERSTAND -> SEARCH -> DESIGN -> IMPLEMENT -> VERIFY -> CRITICALLY REVIEW -> IMPROVE IF NEEDED -> CLEAN UP -> FINISH`

Do not create planning files or ceremonial reports. Keep the reasoning proportional to scope, reuse potential, blast radius, and risk.

## Scale the workflow

- **Trivial:** an isolated typo, label, or obvious local style value with no shared API, state, or behavior impact. Make the direct edit, inspect the diff, and run only the relevant lightweight check.
- **Meaningful:** a feature, behavior change, non-local bug, new file, reusable UI, service/provider/utility change, refactor, or unclear ownership. Complete the design pass and post-implementation audit.
- **High risk:** authentication, synchronization, persistence, migrations, account deletion, attachments, notifications, native configuration, Firebase rules/functions, or a widely used shared primitive. Deepen consumer, failure-mode, platform, and test analysis.

When uncertain, investigate enough to classify the change; do not turn classification into a long planning exercise.

## Design pass

Before editing meaningful code, determine:

1. The exact requested outcome and behavior that must remain unchanged.
2. The existing subsystem that owns the responsibility.
3. Similar functionality and the canonical implementation, if one exists.
4. Existing components, hooks, providers, services, utilities, constants, and types that can be reused.
5. Callers, consumers, data contracts, and related implementations that could be affected.
6. Platform-specific files or behavior.
7. Whether the change is local or reveals a repeated project concept.
8. Whether an established owner should be extended.
9. Whether a shared abstraction would create a clearer single source of truth.
10. Whether abstraction would instead hide semantics or add configuration and coupling.
11. The smallest coherent implementation and why its location is correct.
12. The verification evidence needed after implementation.

Use the existing Graphify graph for architecture and relationships, then targeted `rg`, source reads, imports, and tests. For shared code, enumerate consumers before changing its contract. Apply `$architecture-guardian` for ownership and reuse decisions and `$production-code-quality` while writing production code.

## Implement and verify

Implement the chosen design without unrelated cleanup. Reuse established naming, data flow, theme, localization, error handling, platform patterns, and existing dependencies.

Tests are necessary but not sufficient. Select evidence according to the change:

- focused tests, syntax/check scripts, or builds that actually exercise the behavior;
- caller and import review for shared code or services;
- representative consumers for reusable components;
- native/web variants and durable Expo/plugin configuration;
- state, data, loading, empty, offline, permission, error, and retry paths;
- accessibility, localization, theme behavior, and obvious render/performance effects;
- complete changed-code and diff review.

Do not invent scratch apps or repository-root verification projects when existing tools and targeted inspection suffice.

## Senior self-review

After implementation and checks, review the work as if it were another senior engineer's pull request:

1. Is the code in the correct architectural location, with the correct owner?
2. Was an existing reusable implementation missed, or was new duplication introduced?
3. Is task-relevant duplication still present that should reasonably be consolidated?
4. Is every abstraction necessary, at the right level, and simpler than the duplication it replaces?
5. Is there one source of truth and a small, understandable API?
6. Do naming, imports, and patterns match nearby PlanIt code?
7. Is the solution neither too specific nor too generic?
8. Are relevant consumers and platform variants consistent?
9. Are failures and loading/empty/error states meaningful where relevant?
10. Are accessibility, localization, themes, and data contracts preserved?
11. Did the change add obvious unnecessary renders, work, dependencies, or surface area?
12. Is there dead code, an unused import/variable, debug output, duplicated fallback logic, or a temporary compatibility hack?
13. Is a materially simpler or more maintainable solution available?
14. Would a strong senior reviewer approve this design, not merely its passing tests?

Choose once:

- **KEEP** when the implementation is already the best reasonable solution for the task.
- **IMPROVE** when a specific revision has a material correctness, consistency, reuse, simplicity, or maintenance benefit.

Do not rewrite code merely to make it different and do not enter an open-ended refactoring loop. After any improvement, rerun the affected checks and perform a focused final review.

Finish with `$repository-hygiene`: inspect the diff and final status, account for every path, and remove only artifacts created by the task.

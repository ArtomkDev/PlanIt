---
name: production-code-quality
description: Write or refactor production code in PlanIt with concise, maintainable, human-consistent implementation. Apply to changes under src, functions, plugins, scripts, and project configuration; focus on surrounding style, sensible failures, reuse, and final diff cleanup rather than broad redesign.
---

# Production Code Quality

Match the best established patterns in the files surrounding the change. Preserve local naming, imports, module boundaries, platform variants, state management, error handling, theme usage, and localization behavior.

For meaningful changes, use `$engineering-workflow` for the design pass and senior self-review and `$architecture-guardian` for ownership and reuse decisions. This skill governs the quality of the implementation itself.

## Implementation standard

- Prefer direct code over speculative layers, needless wrappers, one-use factories/managers/adapters, or helpers that make simple logic harder to follow.
- Reuse existing components, utilities, services, tokens, translations, and platform guards. Do not copy behavior to avoid understanding its current owner.
- Add comments only for non-obvious intent, constraints, platform behavior, or workarounds. Do not narrate lines, add obvious JSDoc, or leave tutorial-style explanations in production code.
- Handle plausible errors where recovery or useful context exists. Do not swallow failures with broad `try/catch`, add impossible-state checks, or build large fallback chains that conceal defects.
- Preserve explicit loading, empty, offline, permission, error, and retry behavior where the affected flow requires it. Avoid changing user-visible behavior incidentally.
- Do not leave debug logging, temporary flags, placeholders, commented-out code, dead branches, unused imports/variables, duplicate implementations, or test-only shortcuts.

## Review the result

Read the complete changed code in context, not only the patch. Simplify accidental complexity and remove artifacts introduced during iteration. Run the narrowest relevant existing test or check; do not invent or claim repository-wide lint/typecheck commands that do not exist.

Before completion, inspect the final diff for unrelated formatting churn, verify every new file has a real architectural purpose, and apply the repository-hygiene cleanup workflow.

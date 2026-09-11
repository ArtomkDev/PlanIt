---
name: repository-hygiene
description: Keep the PlanIt working tree clean and preserve user work whenever repository files are modified or builds, tests, exports, screenshots, or verification steps may create artifacts. Apply throughout coding tasks and during final cleanup; do not use it to delete ordinary user or tool data without evidence.
---

# Repository Hygiene

Use this workflow alongside the task-specific skill whenever work can change the repository.

## Establish ownership

- Run `git status --short` before substantial work and record the baseline.
- Treat pre-existing modifications and every untracked file as user work until evidence shows otherwise.
- Before deleting a suspicious path, inspect its contents, tracking/ignore state, references, and role in runtime, builds, tests, deployment, documentation, or tooling. A temporary-looking name is not enough.
- Never use `git reset --hard`, `git clean -fd`, or broad restore/checkout commands to clean the tree.

## Keep temporary work outside the repository

- Create disposable exports, screenshots, comparisons, copied fixtures, logs, and one-off scripts in a unique OS temp directory when the tool supports an output path.
- Never use the repository root for `.codex-*`, verification, review, export, or copied-project directories.
- When a tool can only write inside the repository, use its established ignored output/cache location. Track the exact artifacts produced by this task and remove them after verification.
- Do not add `.gitignore` entries merely to hide task debris.

PlanIt's ignored paths are not interchangeable. Preserve `.env`, `credentials/`, platform service files, `android/`/`ios/`, release files in `builds/`, `dist/`, `.expo/`, `.firebase/`, dependencies, and Graphify state unless the current task specifically establishes that an item is disposable.

## Finish cleanly

1. Inspect the task diff and `git status --short`.
2. Account for every changed, deleted, and untracked path against the baseline.
3. Remove only the temporary files created by the task, using exact validated paths.
4. Remove accidental generated output, debug dumps, screenshots, logs, copied projects, and temporary helper scripts.
5. Confirm every new permanent file has a project responsibility and that no user change was reverted or overwritten.

Report any intentionally retained generated artifact and why it remains useful.


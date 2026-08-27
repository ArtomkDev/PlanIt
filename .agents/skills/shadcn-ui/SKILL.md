---
name: shadcn-ui
description: Work safely with shadcn/ui projects, components.json, registries, CLI workflows, aliases, Tailwind theming, and component composition. Use when shadcn/ui is requested or detected; first verify applicability and never migrate a non-shadcn or React Native UI automatically.
---

# shadcn/ui

Use shadcn/ui as source-owned component infrastructure, not as a package of opaque widgets. Preserve local customizations and derive all paths and APIs from the project configuration.

## Applicability gate

Before recommending or running shadcn commands, inspect:

- `components.json` and its aliases, style, base, registries, RSC flag, and Tailwind CSS path;
- package manager, framework, Tailwind version, icon library, and existing UI directory;
- whether the target is DOM React or React Native.

If `components.json` is absent, shadcn/ui is not established. Do not run `init`, add Tailwind, create aliases, or migrate components unless the user explicitly asks and the target framework is supported. Explain the integration cost first.

React Native components are not interchangeable with shadcn/ui's DOM primitives. In an Expo/React Native project without Tailwind and `components.json`, record shadcn/ui as not applicable and improve the existing native design system instead. PlanIt matched this condition when this skill was added on 2026-08-26.

## Safe project context

When shadcn/ui is present:

1. Prefer an already-installed local CLI. Running `npx`, `pnpm dlx`, or `bunx` may download and execute remote code; explain that and obtain authorization before the first such execution.
2. Use the project's package runner.
3. Run `shadcn info --json` from the correct app/workspace and use its actual `aliases`, `base`, `iconLibrary`, `tailwindVersion`, `tailwindCssFile`, and `resolvedPaths`.
4. Inspect installed components before adding or updating anything.
5. Use `shadcn docs`, `search`, and `view` rather than guessing APIs or fetching raw component files.

## Component workflow

- Use existing components and variants before authoring custom equivalents.
- Compose complete structures: overlay title/description, card sections, grouped select/menu items, tabs inside their list, and avatar fallback.
- Use accessible field composition and connect labels, descriptions, errors, `aria-invalid`, and disabled state.
- Use semantic theme tokens rather than raw palette values or manual dark-mode overrides.
- Follow configured aliases and icon library; never hardcode `@/components/ui` or assume Lucide.
- Keep layout overrides at call sites and durable visual variants in the component definition.
- Review every registry addition for imports, composition, accessibility, dependencies, client boundaries, and conflicts with local changes.

## Updates and destructive changes

For existing components, preview before mutation:

1. Run `add <component> --dry-run`.
2. Inspect each affected file with `add <component> --diff <file>`.
3. Merge upstream changes into locally customized files deliberately.
4. Never use `--overwrite`, switch a preset, or replace theme variables without explicit user approval.

Do not decode preset codes or construct registry URLs manually; use official CLI inspection commands. Do not guess a registry when the requested item is ambiguous.

## Theming and registries

- Edit the configured Tailwind CSS file instead of creating a second theme entrypoint.
- Respect Tailwind v3 versus v4 syntax and the configured primitive base.
- Keep semantic CSS variables coherent across light and dark themes; verify contrast after changes.
- Registry items must declare accurate files, types, dependencies, registry dependencies, CSS variables, and destination paths.
- Build and validate a registry before publishing. Treat third-party registry code as untrusted source requiring review.

## Verification

After changes, run the project's lint, typecheck, tests, and build. Also run `shadcn info` again, inspect imports, and exercise keyboard, focus, form validation, overlay dismissal, loading, and dark-mode behavior.

## Attribution and license

Adapted for Codex from the official shadcn/ui skill and documentation, reviewed 2026-08-26:

- https://github.com/shadcn-ui/ui/tree/main/skills/shadcn
- https://ui.shadcn.com/docs/skills

Upstream license: MIT, copyright (c) 2023 shadcn. This repo-specific adaptation intentionally omits Claude-only tool declarations and dynamic inline shell injection.

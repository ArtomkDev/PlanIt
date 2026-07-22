# Graphify Setup

This project is prepared for Graphify, a local knowledge graph for codebase structure and project content.

## Install the CLI

Install the official package outside the app dependencies:

```powershell
uv tool install graphifyy
```

Alternative:

```powershell
pipx install graphifyy
```

On Windows PowerShell, run `graphify .` instead of `/graphify .`.

If PowerShell blocks `npm.ps1`, use `npm.cmd run ...` for the commands below.

## Build the Project Graph

```powershell
npm.cmd run graphify:build
```

This writes Graphify output to `graphify-out/`, including:

- `graphify-out/graph.html`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/graph.json`

For a code-only run that avoids semantic extraction for docs and images:

```powershell
npm.cmd run graphify:build-code
```

## Query the Graph

```powershell
npm.cmd run graphify:query -- "what connects auth to Firebase?"
npm.cmd run graphify -- path "Auth" "Firestore"
npm.cmd run graphify -- explain "CalendarScreen"
```

## Codex Integration

After the CLI is installed, register Graphify's Codex project integration:

```powershell
npm.cmd run graphify:install-codex
```

This lets future Codex sessions prefer the graph for architecture and relationship questions.

## Team Notes

`graphify-out/` is intentionally not ignored so the generated map can be shared with the team. `graphify-out/cost.json` stays ignored because it is local run metadata. Keep `graphify-out/cache/` commented in `.gitignore`: commit it for faster team rebuilds, or uncomment it if the repository becomes too large.

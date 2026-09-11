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

## Update the Graph

For source-code changes, update the graph locally without an LLM backend:

```powershell
npm.cmd run graphify:update-code
```

Use `npm.cmd run graphify:update` when changed documentation or images also need semantic extraction and a supported backend is configured.

## Codex Integration

After the CLI is installed, register Graphify's Codex project integration:

```powershell
npm.cmd run graphify:install-codex
```

This lets future Codex sessions prefer the graph for architecture and relationship questions.

## Team Notes

The current graph, report, manifest, labels, learning data, and query memory under `graphify-out/` are intentionally tracked so the project map can be shared with the team. HTML exports, dated snapshots, `cost.json`, and `cache/` are local generated artifacts and stay ignored; they can be regenerated.

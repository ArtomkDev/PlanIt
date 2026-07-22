# Project Instructions

## Graphify

New Codex tasks in this repository should treat `graphify-out/graph.json` as the first source of codebase context.

When `graphify-out/graph.json` exists and a task asks about architecture, file relationships, feature flow, or "what calls/uses/connects X", prefer Graphify before broad text search:

```powershell
npm.cmd run graphify:query -- "question about the codebase"
```

Do not start architecture or relationship work with broad `rg`, recursive file reads, or manual project re-analysis unless the Graphify query/path/explain result is missing the needed detail.

Use path/explain commands directly through the wrapper when useful:

```powershell
npm.cmd run graphify -- path "SourceConcept" "TargetConcept"
npm.cmd run graphify -- explain "ConceptName"
```

Build or refresh the graph from the project root:

```powershell
npm.cmd run graphify:build
npm.cmd run graphify:update
```

The repository uses `.graphifyignore` to keep generated exports, local state, dependencies, and credentials out of the graph.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `npm.cmd run graphify:query -- "<question>"` when graphify-out/graph.json exists. Use `npm.cmd run graphify -- path "<A>" "<B>"` for relationships and `npm.cmd run graphify -- explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `npm.cmd run graphify:update` to keep the graph current (AST-only, no API cost).

# Legal document source

The five `.mdx` files in this folder are the PlanIt app-side source of truth for legal text:

- `privacy.mdx`
- `terms.mdx`
- `cookies.mdx`
- `delete.mdx`
- `licenses.mdx`

Run this from the PlanIt repo after editing:

```powershell
npm.cmd run legal:publish
```

That command regenerates `src/config/legalDocuments.generated.js` for the app, copies only these `.mdx`
files to the website repo at `..\planit-website\public\content\legal`, generates matching
`*.loading.mdx` loading versions, refreshes the website legal manifest, copies the files into the
existing `..\planit-website\out\content\legal` export, and uploads that already-built output to Firebase
Hosting.

It does not rebuild the website. The website keeps its own app/runtime; this command only updates and publishes
the legal document files that the website fetches at runtime.

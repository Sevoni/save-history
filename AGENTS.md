# Save History — Obsidian Plugin

## Build

```bash
node build.js          # production build → root main.js (bundled, Obsidian loads this)
node build.js --watch  # rebuild on change
```

- Build uses **esbuild** (not rollup). `rollup.config.js` is leftover; `build.js` is the real build.
- Entry chain: `build.js` → `entry.js` → `main.ts` → `src/main.ts`
- `obsidian` is marked external — it's provided by Obsidian at runtime, not bundled.
- Output is a single `main.js` at repo root (not in `dist/`). `dist/` is from tsconfig outDir but not used by the actual build.

## Architecture

- `src/main.ts` — Plugin class (`SaveHistoryPlugin`), registers view + commands
- `src/storage.ts` — All vault I/O for snapshots (read/write/list/delete JSON files in `.versions(SH)/`)
- `src/versioning.ts` — Snapshot save/restore logic, autosave (currently disabled)
- `src/ui.ts` — Sidebar view (`SaveHistoryView`), preview modal (draggable+resizable), restore modal, commands
- `types/obsidian.d.ts` — Intentionally minimal Obsidian type stubs; not the full API

## Obsidian-specific gotchas

- The `obsidian` module is external. Don't import anything not already in `types/obsidian.d.ts` without adding the type stub.
- Obsidian provides `Modal.modalEl` at runtime but it's not in the stub types — use `(modal as any).modalEl`.
- Snapshot filenames replace `:` with `-` because colons are illegal in Windows filenames.
- Snapshot data is stored as JSON inside the vault at `.versions(SH)/<file-path>/<timestamp>.json`.

## No tests

No test framework is configured. There are no test files.

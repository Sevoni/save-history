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
- `src/versioning.ts` — Snapshot save/restore logic, autosave via `AutosaveManager`
- `src/ui.ts` — Sidebar view (`SaveHistoryView`), preview modal (draggable+resizable), diff modal, restore modal, commands
- `src/autosave.ts` — `AutosaveManager` class (interval + tab-close autosave)
- `src/diff.ts` — LCS-based diff computation
- `src/locale.ts` — i18n (en/ru), `translate(key, params?)`
- `styles.css` — All plugin CSS (Obsidian loads it automatically from plugin root)
- `types/obsidian.d.ts` — Minimal Obsidian type stubs; intentionally incomplete

## Obsidian-specific gotchas

- The `obsidian` module is external. Don't import anything not already in `types/obsidian.d.ts` without adding the type stub.
- `Modal.modalEl` and `Plugin.loadData/saveData` exist at runtime but verify they're in the type stubs before use.
- Snapshot filenames replace `:` with `-` because colons are illegal in Windows filenames.
- Snapshot data is stored as JSON inside the vault at `.versions(SH)/<file-path>/<timestamp>.json`.
- All timestamps stored internally are UTC ISO strings (`new Date().toISOString()`). String comparison works for sorting.

## Plugin review rules (obsidianmd)

This plugin is submitted to the Obsidian plugin review. Key rules:

- **No inline styles** (`obsidianmd/no-static-styles-assignment`). Use CSS classes from `styles.css` via `classList.add()`. Exception: dynamic positioning in drag/resize handlers.
- **No `<style>` element creation**. All CSS goes in `styles.css`.
- **Use `activeWindow?.document ?? document`** instead of bare `document` for popout window compat (`obsidianmd/use-active-document`). Exception: global mouse event listeners in drag/resize.
- **Use `new Setting().setHeading()`** instead of `createEl("h2")` for section headers.
- **No `any` types**. Use proper types from `types/obsidian.d.ts`.
- **Handle promises** — add `void` or `.catch(() => {})` to fire-and-forget promises.
- **`MarkdownRenderer.render()`** expects a `Component` — pass the view/modal (`this`), not the plugin instance.
- **Attestation**: release workflow uses `actions/attest-build-provenance@v2`.

## Release

```bash
# 1. Update versions in: manifest.json, package.json, versions.json
# 2. Build
node build.js
# 3. Commit, tag (no "v" prefix), push
git tag <version>
git push origin main --tags
# GitHub Actions builds + creates release with main.js, styles.css, manifest.json, package.json
```

## No tests

No test framework is configured. There are no test files.

## Rules

- **NEVER modify `.gitignore`** — it's synced with the Obsidian plugin repo. All changes must go through the plugin review.

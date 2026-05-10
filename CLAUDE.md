# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Electron + Vite dev server with HMR
npm run build        # Build all bundles (main, preload, renderer)
npm run typecheck    # Type-check both Node and Web projects
npm run package      # Build + package with electron-builder
```

There is no test suite yet.

## Architecture

This is an Electron desktop app (Central Command) — a personal extensible dashboard. `electron-vite` compiles **three separate TypeScript projects** that share no runtime bundle:

- **`src/main/`** — Electron main process (Node). Owns the window, registers all IPC handlers, and manages the two storage backends.
- **`src/preload/`** — contextBridge script. Exposes `window.cc` (typed as `CCApi` in `src/shared/types.ts`) to the renderer. The only bridge between Node and browser.
- **`src/renderer/`** — React app. Has no direct Node/Electron access; everything goes through `window.cc`.
- **`src/shared/`** — Types and IPC channel names imported by both main and renderer via the `@shared` alias.
- **`src/widgets/`** — Widget plugins (see below).

### Path aliases

| Alias | Resolves to |
|---|---|
| `@shared` | `src/shared/` |
| `@main` | `src/main/` |
| `@renderer` | `src/renderer/src/` |
| `@widgets` | `src/widgets/` |

### IPC flow

`src/shared/ipc.ts` defines all channel names (`cc:state:*`, `cc:kv:*`, `cc:sql:*`). Main registers handlers in `src/main/ipc.ts`; the renderer calls them through `window.cc` (wired up in preload).

### State management

Dashboard state (dashboards, widget instances, layouts) lives in a Zustand store at `src/renderer/src/state/dashboard.ts`. Changes are debounced 150 ms and persisted to `state.json` in Electron's `userData` directory via IPC.

### Storage

Two backends, both owned by `src/main/storage/`:

- **JSON KV** (`JsonStore`) — per-widget-id file (`widgets/<widgetId>/store.json`). Keys are further scoped per-instance in `src/renderer/src/plugins/api.ts` using the `instanceId::key` prefix, so `api.kv` is instance-isolated even though the file is widget-shared.
- **SQLite** (`SqliteStore`) — per-widget-id database (`widgets/<widgetId>/data.db`). Tables are shared across all instances of the same widget type. Always use parameterized queries.

## Widget system

Drop a folder at `src/widgets/<id>/index.tsx` that default-exports a `Widget`:

```ts
import type { Widget } from '@renderer/plugins/registry';

const widget: Widget = {
  manifest: { id, name, version, defaultSize, ... },
  Component: ({ api, settings, setTitle }) => <div>...</div>
};
export default widget;
```

The registry (`src/renderer/src/plugins/registry.ts`) uses `import.meta.glob` to auto-discover all `src/widgets/*/index.tsx` files at build time — no manual registration needed. Widget id must match `^[a-z0-9][a-z0-9-]{0,63}$` and equal the folder name.

The `manifest.settings` array drives the per-instance settings UI automatically (supported kinds: `string`, `number`, `boolean`, `select`). See `src/widgets/README.md` for the full manifest reference and a minimal example.

The grid uses a 12-column layout with 60 px row height (`react-grid-layout`). Size is specified in grid units.

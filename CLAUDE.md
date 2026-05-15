# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Electron + Vite dev server with HMR
npm run build        # Build all bundles (main, preload, renderer)
npm run typecheck    # Type-check both Node and Web projects
npm run test         # Run Vitest unit tests
npm run test:coverage # Run tests with v8 coverage report
npm run package      # Build + package with electron-builder

# Mobile (Capacitor)
npm run build:mobile  # Vite build for mobile renderer
npm run mobile:sync   # Build + sync to Android
npm run mobile:run    # Build, sync, and run on Android device
npm run mobile:dev    # Mobile dev server
```

There is a Vitest unit test suite. Run `npm run test` before committing changes to `src/shared/`, `src/main/storage/`, or `src/main/ipc.ts`.

## Architecture

This is an Electron desktop app (Central Command) — a personal extensible dashboard. `electron-vite` compiles **three separate TypeScript projects** that share no runtime bundle:

- **`src/main/`** — Electron main process (Node). Owns the window, registers all IPC handlers, manages storage backends, Google OAuth, Drive sync, and the job capture HTTP server.
- **`src/preload/`** — contextBridge script. Exposes `window.cc` (typed as `CCApi` in `src/shared/types.ts`) to the renderer. The only bridge between Node and browser.
- **`src/renderer/`** — React app. Has no direct Node/Electron access; everything goes through `window.cc`.
- **`src/shared/`** — Types and IPC channel names imported by both main and renderer via the `@shared` alias.
- **`src/widgets/`** — Widget plugins (see below).
- **`src/mobile-bridge/`** — Capacitor bridging layer for mobile builds.
- **`src/mobile-renderer/`** — Mobile-specific React app.
- **`extensions/job-capture/`** — Chrome extension that sends job/audition data to the job capture HTTP server.

### Path aliases

| Alias | Resolves to |
|---|---|
| `@shared` | `src/shared/` |
| `@main` | `src/main/` (node project only) |
| `@renderer` | `src/renderer/src/` |
| `@widgets` | `src/widgets/` |

### Security model

- `contextIsolation: true`, `nodeIntegration: false` — renderer is a sandboxed browser.
- The preload's contextBridge is the **only** way to reach Node/Electron APIs.
- `api.shell.openExternal` only allows `http`, `https`, and `mailto` URLs.
- All SQLite queries must use parameterized form — never interpolate untrusted values.
- Secrets use Electron's `safeStorage` (OS keychain on macOS/Windows, libsecret on Linux).

### IPC flow

`src/shared/ipc.ts` defines all channel names as the `IPC` constant object. Main registers handlers in `src/main/ipc.ts`; the renderer calls them through `window.cc` (wired up in preload). New IPC channels require changes to all three: `shared/ipc.ts`, `main/ipc.ts`, and `preload/index.ts`.

#### IPC channels reference

| Channel | Direction | Description |
|---|---|---|
| `cc:state:load` | renderer → main | Load `AppState` from `userData/state.json` |
| `cc:state:save` | renderer → main | Persist `AppState` to `userData/state.json` |
| `cc:kv:get` | renderer → main | Get a KV value |
| `cc:kv:set` | renderer → main | Set a KV value |
| `cc:kv:del` | renderer → main | Delete a KV key |
| `cc:kv:keys` | renderer → main | List all keys for a widget |
| `cc:kv:keys-prefix` | renderer → main | List keys matching a prefix |
| `cc:sql:run` | renderer → main | INSERT / UPDATE / DELETE |
| `cc:sql:all` | renderer → main | SELECT multiple rows |
| `cc:sql:get` | renderer → main | SELECT first row |
| `cc:sql:exec` | renderer → main | Execute arbitrary SQL |
| `cc:sql:runBatch` | renderer → main | Transactional batch of statements |
| `cc:shell:openExternal` | renderer → main | Open URL in system browser |
| `cc:shell:openPath` | renderer → main | Open file/folder with OS default |
| `cc:shell:showInFolder` | renderer → main | Reveal in file manager |
| `cc:dialog:openPath` | renderer → main | Native file-picker dialog |
| `cc:net:fetch` | renderer → main | HTTP via Electron's `net` module |
| `cc:secrets:get/set/del/has` | renderer → main | Encrypted per-widget secrets |
| `cc:google:connect` | renderer → main | Trigger PKCE OAuth flow |
| `cc:google:get-token` | renderer → main | Get/refresh Google access token |
| `cc:google:is-connected` | renderer → main | Check auth status |
| `cc:google:disconnect` | renderer → main | Revoke credentials |
| `cc:job-capture:status` | renderer → main | Get capture server status |
| `cc:job-capture:regen-token` | renderer → main | Regenerate auth token |
| `cc:job-capture:job-added` | main → renderer | Push: new job captured |
| `cc:job-capture:audition-added` | main → renderer | Push: new audition captured |
| `cc:drive-sync:get-status` | renderer → main | Get current sync status |
| `cc:drive-sync:enable/disable` | renderer → main | Toggle Drive sync |
| `cc:drive-sync:force-push/pull` | renderer → main | Manual sync |
| `cc:drive-sync:status-changed` | main → renderer | Push: sync state changed |

### State management

Dashboard state (dashboards, widget instances, layouts) lives in a Zustand store at `src/renderer/src/state/dashboard.ts`. Changes are debounced 150 ms and persisted to `state.json` in Electron's `userData` directory via IPC. The store also listens for `cc:drive-sync:status-changed` events and reloads state when a remote pull occurs.

### Storage

Two backends, both owned by `src/main/storage/`:

- **JSON KV** (`JsonStore`) — per-widget-id file (`widgets/<widgetId>/store.json`). In-memory cache with 200 ms debounced flush. Keys are further scoped per-instance in `src/renderer/src/plugins/api.ts` using the `instanceId::key` prefix, so `api.kv` is instance-isolated even though the file is widget-shared.
- **SQLite** (`SqliteStore`) — per-widget-id database (`widgets/<widgetId>/data.db`). Uses WAL journal mode and `foreign_keys=ON`. Tables are shared across all instances of the same widget type. Always use parameterized queries.
- **Secrets** (`src/main/secrets.ts`) — per-widget namespace under `userData/secrets/{widgetId}.json`, encrypted via `safeStorage`.
- **AppState** — `userData/state.json`, written atomically (temp file + rename).

### Google OAuth

`src/main/oauth.ts` implements a PKCE loopback OAuth flow. A local HTTP server on a random port receives the redirect from Google after the user completes the browser flow. Tokens auto-refresh before expiry. Credentials and tokens are stored in the widget's secrets vault. Widgets can use `api.google.shared` to share OAuth credentials under a common `'google'` widget namespace (useful for widgets that all need the same Google account).

Available built-in service presets: `gmail`, `calendar`, `drive`, `contacts`, `notes`.

### Drive sync

`src/main/sync.ts` syncs the three data files (`cc-state.json`, `cc-kv-{widgetId}.json`, `cc-db-{widgetId}.db`) to the user's Google Drive app data folder. Polling interval is 5 minutes when enabled. All sync operations are queue-sequenced to avoid races. Remote state wins on pull. Enable/disable is persisted in `AppState`.

### Job capture server

`src/main/job-capture-server.ts` runs an HTTP server (default port 47293). The companion Chrome extension (`extensions/job-capture/`) POSTs job and audition data secured by a random 32-byte hex token. The server writes directly to the `job-tracker` / `audition-aggregator` widget SQLite databases and emits IPC push events to the renderer.

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

The `manifest.settings` array drives the per-instance settings UI automatically (supported kinds: `string`, `number`, `boolean`, `select`). See `src/widgets/README.md` for the full manifest reference and usage examples.

The grid uses a 12-column layout with 60 px row height (`react-grid-layout`). Size is specified in grid units.

### Widget manifest fields

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Must equal the folder name |
| `name` | `string` | Display name |
| `description` | `string?` | Shown in the Add dialog |
| `version` | `string` | Semver-ish, e.g. `0.1.0` |
| `icon` | `string?` | Emoji or short string used in header |
| `defaultSize` | `{ w, h }` | Grid cells (12-col, 60 px rows) |
| `minSize` | `{ w, h }?` | Minimum drag/resize size |
| `settings` | `SettingsField[]?` | Schema for per-instance settings UI |
| `permissions` | `{ sqlite?, google? }?` | Declare capabilities used |
| `platforms` | `('desktop' \| 'mobile')[]?` | Omit = all platforms |

### WidgetApi surface

`api` in the component props is an instance-scoped wrapper defined in `src/renderer/src/plugins/api.ts`:

```ts
api.widgetId       // widget type id
api.instanceId     // unique instance id

api.kv             // instance-scoped JSON KV (instanceId:: prefix auto-applied)
api.sql            // widget-shared SQLite (declare permissions.sqlite)
api.shell          // openExternal / openPath / showItemInFolder
api.dialog         // openPath (native file picker)
api.net            // fetch via Electron net (avoids browser CORS)
api.secrets        // encrypted per-widget KV (widget-shared, not per-instance)
api.google         // PKCE OAuth + token management (declare permissions.google)
api.google.shared  // shared OAuth namespace ('google' widgetId)
```

### Widget conventions

- Long-running effects go in `useEffect`; always return a cleanup function.
- The widget body is scrollable — no need to manage overflow.
- If a widget throws during render, `WidgetHost.tsx` catches it and shows an error without crashing the dashboard.
- `api.kv` keys are per-instance; `api.sql` tables are per-widget-type (all instances share one DB).
- Use `api.net.fetch` instead of `window.fetch` for any network calls that may hit CORS restrictions.
- Call `api.google.connect()` from an event handler, not during render — it blocks until the OAuth flow completes (up to 5 minutes).

## Key files

| Purpose | File |
|---|---|
| Shared type definitions | `src/shared/types.ts` |
| IPC channel constants | `src/shared/ipc.ts` |
| Google service presets | `src/shared/google.ts` |
| Default AppState | `src/shared/defaults.ts` |
| Widget ID validation | `src/shared/validation.ts` |
| Main process entry | `src/main/index.ts` |
| IPC handler registration | `src/main/ipc.ts` |
| Storage orchestrator | `src/main/storage/index.ts` |
| JSON KV store | `src/main/storage/json.ts` |
| SQLite store | `src/main/storage/sqlite.ts` |
| Google Drive wrapper | `src/main/storage/drive.ts` |
| Google OAuth | `src/main/oauth.ts` |
| Encrypted secrets | `src/main/secrets.ts` |
| Drive sync manager | `src/main/sync.ts` |
| Job capture server | `src/main/job-capture-server.ts` |
| WSL detection | `src/main/platform.ts` |
| Preload contextBridge | `src/preload/index.ts` |
| Dashboard Zustand store | `src/renderer/src/state/dashboard.ts` |
| Widget registry | `src/renderer/src/plugins/registry.ts` |
| WidgetApi wrapper | `src/renderer/src/plugins/api.ts` |
| GridLayout component | `src/renderer/src/components/Dashboard.tsx` |
| Widget error boundary | `src/renderer/src/components/WidgetHost.tsx` |
| App settings UI | `src/renderer/src/components/AppSettings.tsx` |
| Build config | `electron.vite.config.ts` |
| Mobile build config | `vite.mobile.config.ts` |
| Vitest config | `vitest.config.ts` |
| Widget authoring guide | `src/widgets/README.md` |

## Testing

Unit tests live alongside source files under `src/` with the pattern `*.test.ts`. Run with:

```bash
npm run test           # watch mode
npm run test:coverage  # single-run with v8 coverage
```

Covered areas: `src/shared/google.test.ts`, `src/shared/validation.test.ts`, `src/main/ipc.test.ts`, `src/main/storage/sqlite.test.ts`, `src/main/storage/json.test.ts`. There are no integration or end-to-end tests.

## Mobile

Mobile builds use Capacitor with an Android target. The `__MOBILE__` build-time flag (injected by Vite) switches the renderer to use `MobileLayout` / `MobileNav` and filters widgets by `manifest.platforms`. Mobile-specific code lives in `src/mobile-bridge/` and `src/mobile-renderer/`.

## Chrome extension

`extensions/job-capture/` is a companion Chrome extension that captures job listings and auditions from job boards and POSTs them to the local job capture server. It is a standalone package separate from the Electron build.

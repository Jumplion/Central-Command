# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev               # Electron + Vite dev server with HMR
npm run build             # Build all bundles (main, preload, renderer)
npm run typecheck         # Type-check both Node and Web projects
npm run typecheck:node    # Type-check main/preload only (tsconfig.node.json)
npm run typecheck:web     # Type-check renderer/widgets only (tsconfig.web.json)
npm run test              # Run the Vitest unit test suite
npm run test:coverage     # Run tests with v8 coverage report
npm run package           # Build + package with electron-builder
```

## Setup & Requirements

**Node.js:** The project requires Node.js 22.13.0 or 24.0.0+ (see `package.json#engines.node`). Specifically:

- ✅ Node 22.13.0+
- ✅ Node 24.0.0+

Use `node --version` to check your version. Install a compatible version via [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://fnm.io/) if needed.

There is a Vitest unit test suite. Run `npm run test` before committing changes to `src/shared/`, `src/main/storage/`, or `src/main/ipc.ts`.

## Architecture

This is an Electron desktop app (Central Command) — a personal extensible dashboard. `electron-vite` compiles **three separate TypeScript projects** that share no runtime bundle:

- **`src/main/`** — Electron main process (Node). Owns the window, registers all IPC handlers, manages storage backends, Google OAuth, and Drive sync.
- **`src/preload/`** — contextBridge script. Exposes `window.cc` (typed as `CCApi` in `src/shared/types.ts`) to the renderer. The only bridge between Node and browser.
- **`src/renderer/`** — React app. Has no direct Node/Electron access; everything goes through `window.cc`.
- **`src/shared/`** — Types, IPC channel names, and utilities imported by both main and renderer via the `@shared` alias.
- **`src/widgets/`** — Widget plugins (see below).

### Path aliases

| Alias       | Resolves to                     |
| ----------- | ------------------------------- |
| `@shared`   | `src/shared/`                   |
| `@main`     | `src/main/` (node project only) |
| `@renderer` | `src/renderer/src/`             |
| `@widgets`  | `src/widgets/`                  |

### Security model

- `contextIsolation: true`, `nodeIntegration: false` — renderer is a sandboxed browser.
- The preload's contextBridge is the **only** way to reach Node/Electron APIs.
- `api.shell.openExternal` only allows `http`, `https`, and `mailto` URLs.
- All SQLite queries must use parameterized form — never interpolate untrusted values.
- For INSERT/UPDATE with 3+ columns use `namedSql` from `src/renderer/src/plugins/sqlParams.ts` to prevent silent positional-param bugs. Every SQL widget keeps DDL in `schema.ts` (or `constants.ts`), named-param query strings in `queries.ts`, and non-SQL constants in `constants.ts`.
- Secrets use Electron's `safeStorage` (OS keychain on macOS/Windows, libsecret on Linux).

### IPC flow

`src/shared/ipc.ts` defines all channel names as the `IPC` constant object. Main registers handlers in `src/main/ipc.ts`; the renderer calls them through `window.cc` (wired up in preload). New IPC channels require changes to all three: `shared/ipc.ts`, `main/ipc.ts`, and `preload/index.ts`.

#### IPC channels reference

| Channel                         | Direction       | Description                                 |
| ------------------------------- | --------------- | ------------------------------------------- |
| `cc:state:load`                 | renderer → main | Load `AppState` from `userData/state.json`  |
| `cc:state:save`                 | renderer → main | Persist `AppState` to `userData/state.json` |
| `cc:kv:get`                     | renderer → main | Get a KV value                              |
| `cc:kv:set`                     | renderer → main | Set a KV value                              |
| `cc:kv:del`                     | renderer → main | Delete a KV key                             |
| `cc:kv:keys`                    | renderer → main | List all keys for a widget                  |
| `cc:kv:keys-prefix`             | renderer → main | List keys matching a prefix                 |
| `cc:sql:run`                    | renderer → main | INSERT / UPDATE / DELETE                    |
| `cc:sql:all`                    | renderer → main | SELECT multiple rows                        |
| `cc:sql:get`                    | renderer → main | SELECT first row                            |
| `cc:sql:exec`                   | renderer → main | Execute arbitrary SQL                       |
| `cc:sql:runBatch`               | renderer → main | Transactional batch of statements           |
| `cc:shell:openExternal`         | renderer → main | Open URL in system browser                  |
| `cc:shell:openPath`             | renderer → main | Open file/folder with OS default            |
| `cc:shell:showInFolder`         | renderer → main | Reveal in file manager                      |
| `cc:dialog:openPath`            | renderer → main | Native file-picker dialog                   |
| `cc:net:fetch`                  | renderer → main | HTTP via Electron's `net` module            |
| `cc:secrets:get/set/del/has`    | renderer → main | Encrypted per-widget secrets                |
| `cc:google:connect`             | renderer → main | Trigger PKCE OAuth flow                     |
| `cc:google:get-token`           | renderer → main | Get/refresh Google access token             |
| `cc:google:is-connected`        | renderer → main | Check auth status                           |
| `cc:google:disconnect`          | renderer → main | Revoke credentials                          |
| `cc:drive-sync:get-status`      | renderer → main | Get current sync status                     |
| `cc:drive-sync:enable/disable`  | renderer → main | Toggle Drive sync                           |
| `cc:drive-sync:force-push/pull` | renderer → main | Manual sync                                 |
| `cc:drive-sync:status-changed`  | main → renderer | Push: sync state changed                    |

### State management

Dashboard state (dashboards, widget instances, layouts) lives in a Zustand store at `src/renderer/src/state/dashboard.ts`. Changes are debounced 150 ms and persisted to `state.json` in Electron's `userData` directory via IPC. The store also listens for `cc:drive-sync:status-changed` events and reloads state when a remote pull occurs.

### Storage

Two backends, both owned by `src/main/storage/`:

- **JSON KV** (`JsonStore`) — per-widget-id file (`widgets/<widgetId>/store.json`). In-memory cache with 200 ms debounced flush. Keys are further scoped per-instance in `src/renderer/src/plugins/api.ts` using the `instanceId::key` prefix, so `api.kv` is instance-isolated even though the file is widget-shared.
- **SQLite** (`SqliteStore`) — per-widget-id database (`widgets/<widgetId>/data.db`). Uses WAL journal mode and `foreign_keys=ON`. Tables are shared across all instances of the same widget type. Always use parameterized queries.
- **Secrets** (`src/main/secrets.ts`) — per-widget namespace under `userData/secrets/{widgetId}.json`, encrypted via `safeStorage`.
- **AppState** — `userData/state.json`, written atomically (temp file + rename) via `atomicWrite` from `src/main/storage/helpers.ts`.

Storage helpers in `src/main/storage/helpers.ts`:

- `widgetDir(root, widgetId)` — returns the per-widget data directory path (validates widgetId)
- `widgetFile(root, widgetId, fileName)` — returns a file path inside the widget directory
- `ensureWidgetDir(root, widgetId)` — creates the widget directory; concurrent callers share one `mkdir` promise
- `atomicWrite(filePath, contents)` — writes via temp file + rename to prevent corruption

### Google OAuth

`src/main/oauth.ts` implements a PKCE loopback OAuth flow. A local HTTP server on a random port receives the redirect from Google after the user completes the browser flow. Tokens auto-refresh before expiry. Credentials and tokens are stored in the widget's secrets vault. Widgets can use `api.google.shared` to share OAuth credentials under a common `'google'` widget namespace (useful for widgets that all need the same Google account).

Available built-in service presets: `gmail`, `calendar`, `drive`, `contacts`, `notes`, `drive-sync` (internal app-data sync service).

### Drive sync

`src/main/sync.ts` syncs the three data files (`cc-state.json`, `cc-kv-{widgetId}.json`, `cc-db-{widgetId}.db`) to the user's Google Drive app data folder. Polling interval is 5 minutes when enabled. All sync operations are queue-sequenced to avoid races. Remote state wins on pull. Enable/disable is persisted in `AppState`.

The abstract base class `SyncManagerBase` in `src/shared/sync-base.ts` holds all platform-agnostic sync logic (queue, polling, upload/pull orchestration). `src/main/sync.ts` extends it with Electron-specific implementations. Drive file naming helpers (`driveKvName`, `driveDbName`, etc.) also live in `sync-base.ts`.

### Shared utilities (`src/shared/`)

Beyond types and IPC constants, `src/shared/` provides:

- **`concurrency.ts`** — bounded async parallelism:
  - `batchAsync(tasks, poolSize=8)` — runs tasks in batches of `poolSize`, returns results in order
  - `batchAsyncFailFast(tasks, poolSize=8)` — same but stops on first rejection
  - `batchAsyncSafe(tasks, poolSize=8)` — collects both results and errors without short-circuiting
- **`date.ts`** — `today(): string` returns the current date as `YYYY-MM-DD`
- **`csv.ts`** — CSV parsing/serialization utilities
- **`validation.ts`** — `isValidWidgetId` and `assertValidWidgetId` (regex `^[a-z0-9][a-z0-9-]{0,63}$`)
- **`google.ts`** — Google service preset definitions (scopes, discovery endpoints)
- **`defaults.ts`** — default `AppState` factory

### apiEvents event bus

`src/renderer/src/plugins/apiEvents.ts` is a lightweight in-renderer pub/sub bus for cross-widget observability. Currently used by the `api-tracker` widget to receive records of every `api.net.fetch` call:

```ts
import { subscribeApiCalls, emitApiCall } from "@renderer/plugins/apiEvents";

// Subscribe (returns unsubscribe fn)
const unsub = subscribeApiCalls((record) => {
  /* record: ApiCallRecord */
});

// Emit (called automatically inside api.net.fetch)
emitApiCall({ widgetId, url, method, timestamp, status, duration, ok });
```

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

The registry (`src/renderer/src/plugins/registry.ts`) uses `import.meta.glob` to auto-discover all `src/widgets/*/index.tsx` files at build time — no manual registration needed. Widget id must match `^[a-z0-9][a-z0-9-]{0,63}$` and equal the folder name. Validation is performed by `src/renderer/src/plugins/registry-validator.ts`.

The `manifest.settings` array drives the per-instance settings UI automatically (supported kinds: `string`, `number`, `boolean`, `select`). See `src/widgets/README.md` for the full manifest reference and usage examples.

The grid uses a 12-column layout with 60 px row height (`react-grid-layout`). Size is specified in grid units.

### Scaffold script

Use the scaffold script to bootstrap a new widget with the correct SQL pattern already wired up:

```bash
cd src/widgets
bash create-widget.sh my-new-widget
```

This creates `constants.ts` (schema + empty migrations), `types.ts`, and `index.tsx` (with `useSqlInit` already configured). Edit the three files to build your widget.

### Widget manifest fields

| Field         | Type                    | Notes                                |
| ------------- | ----------------------- | ------------------------------------ |
| `id`          | `string`                | Must equal the folder name           |
| `name`        | `string`                | Display name                         |
| `description` | `string?`               | Shown in the Add dialog              |
| `version`     | `string`                | Semver-ish, e.g. `0.1.0`             |
| `author`      | `string?`               | Widget author name                   |
| `icon`        | `string?`               | Emoji or short string used in header |
| `defaultSize` | `{ w, h }`              | Grid cells (12-col, 60 px rows)      |
| `minSize`     | `{ w, h }?`             | Minimum drag/resize size             |
| `settings`    | `SettingsField[]?`      | Schema for per-instance settings UI  |
| `permissions` | `{ sqlite?, google? }?` | Declare capabilities used            |
| `platforms`   | `('desktop')[]?`        | Omit = all platforms                 |

### WidgetApi surface

`api` in the component props is an instance-scoped wrapper defined in `src/renderer/src/plugins/api.ts`:

```ts
api.widgetId; // widget type id
api.instanceId; // unique instance id

api.kv; // instance-scoped JSON KV (instanceId:: prefix auto-applied)
api.sql; // widget-shared SQLite (declare permissions.sqlite)
api.shell; // openExternal / openPath / showItemInFolder
api.dialog; // openPath (native file picker)
api.net; // fetch via Electron net (avoids browser CORS)
api.secrets; // encrypted per-widget KV (widget-shared, not per-instance)
api.google; // PKCE OAuth + token management (declare permissions.google)
api.google.shared; // shared OAuth namespace ('google' widgetId)
```

### Widget conventions

- Long-running effects go in `useEffect`; always return a cleanup function.
- The widget body is scrollable — no need to manage overflow.
- If a widget throws during render, `WidgetHost.tsx` catches it and shows an error without crashing the dashboard.
- `api.kv` keys are per-instance; `api.sql` tables are per-widget-type (all instances share one DB).
- Use `api.net.fetch` instead of `window.fetch` for any network calls that may hit CORS restrictions.
- Call `api.google.connect()` from an event handler, not during render — it blocks until the OAuth flow completes (up to 5 minutes).

### SQL schema pattern

Every widget that uses SQLite must follow this pattern to avoid "duplicate column name" errors when instances are added after columns are migrated:

1. **`INIT_SQL`** — all columns present at first release, in a `CREATE TABLE IF NOT EXISTS` statement.
2. **`MIGRATIONS`** — an array of `SqlMigration` objects, one per column added **after** the initial release. Use `createMigration()` for type-safe definitions; use `emptyMigrations()` as a placeholder until there are real migrations.
3. **`useSqlInit(api, INIT_SQL, MIGRATIONS)`** — call this hook at the top of the widget component. It runs `INIT_SQL`, applies pending migrations (skipping already-applied ones via `PRAGMA table_info`), and returns `ready: boolean`. Only query the DB after `ready` is `true`.

```ts
// constants.ts
import {
  createMigration,
  emptyMigrations,
} from "@renderer/hooks/sqlMigrationHelper";
import type { SqlMigration } from "@renderer/hooks/useSqlInit";

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

// Initially empty; add entries here when adding columns post-release:
// export const MIGRATIONS: SqlMigration[] = [
//   createMigration('items', 'priority', 'ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0'),
// ];
export const MIGRATIONS: SqlMigration[] = emptyMigrations();
```

```tsx
// index.tsx
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { INIT_SQL, MIGRATIONS } from "./constants";

function MyWidget({ api }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  useEffect(() => {
    if (ready) void loadData();
  }, [ready]);

  if (!ready) return <div>Loading…</div>;
  // render
}
```

See `src/renderer/src/hooks/SCHEMA_PATTERN.md` for the complete guide and common mistakes.

### `namedSql` utility

For any INSERT/UPDATE/DELETE with 3+ parameters, use `namedSql` from `src/renderer/src/plugins/sqlParams.ts` instead of positional `?` arrays to prevent silent parameter-order bugs:

```ts
import { namedSql } from "@renderer/plugins/sqlParams";

await api.sql.run(
  ...namedSql(
    "INSERT INTO items (title, status, priority) VALUES (:title, :status, :priority)",
    { title: "foo", status: "active", priority: 1 },
  ),
);
```

`namedSql` converts `:name` tokens to `?` and returns `[sql, valuesArray]`. It throws at call-time if any `:name` token has no matching key.

## Shared widget components (`src/widgets/_shared/`)

Components and utilities shared across multiple widgets. Import from the barrel:

```ts
import {
  TabBar,
  LineChart,
  WidgetLoading,
  NotConnected /* ... */,
} from "../_shared";
import { buttonDefault, inputBase, dimText } from "../_shared/styles";
```

### UI components

| Export            | File                  | Description                                                            |
| ----------------- | --------------------- | ---------------------------------------------------------------------- |
| `TabBar`          | `TabBar.tsx`          | Horizontal tab navigation bar (`tabs: TabDef[]`, `active`, `onSelect`) |
| `LineChart`       | `LineChart.tsx`       | Simple SVG line chart for time-series data                             |
| `PieChart`        | `PieChart.tsx`        | SVG pie/donut chart; accepts `PieSlice[]`                              |
| `StackedBarChart` | `StackedBarChart.tsx` | Horizontal stacked bar with legend (CSS-only, no charting lib)         |
| `StatusBar`       | `StatusBar.tsx`       | Horizontal colored status indicator bar                                |
| `Chip`            | `Chip.tsx`            | Small inline badge/tag element                                         |
| `NotConnected`    | `NotConnected.tsx`    | Standard "not connected" placeholder with a connect button             |
| `WidgetLoading`   | `WidgetLoading.tsx`   | Spinner/skeleton shown while data loads                                |

### Form & list primitives

| Export               | File       | Description                                   |
| -------------------- | ---------- | --------------------------------------------- |
| `FormField`          | `form.tsx` | Labeled field wrapper                         |
| `FormGrid`           | `form.tsx` | Responsive grid for form fields               |
| `FormActions`        | `form.tsx` | Action button row                             |
| `formInputStyle`     | `form.tsx` | CSSProperties for `<input>` elements in forms |
| `InteractiveListRow` | `list.tsx` | Accessible clickable row with hover styles    |
| `TableHeader`        | `list.tsx` | Header row for list layouts                   |
| `TableCell`          | `list.tsx` | Individual cell in a list/table row           |

### Utilities

| Export                | File                     | Description                                                             |
| --------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `filterSuggestions`   | `autocomplete.ts`        | Returns prefix-matched items from a list                                |
| `findSuggestion`      | `autocomplete.ts`        | Finds the first exact/prefix match                                      |
| `suggestionMenuStyle` | `autocomplete.ts`        | CSSProperties for dropdown suggestion container                         |
| `suggestionItemStyle` | `autocomplete.ts`        | CSSProperties for individual suggestion items                           |
| `useGoogleConnection` | `useGoogleConnection.ts` | Hook: returns `[connected: boolean \| null, set]` tracking OAuth status |
| Gmail helpers         | `gmail.ts`               | Shared Gmail API fetch helpers used by Gmail widgets                    |

### Style constants (`_shared/styles.ts`)

Pre-defined `CSSProperties` objects for consistent inline styling:

| Export               | Use for                                 |
| -------------------- | --------------------------------------- |
| `buttonDefault`      | Standard button size (12px, 4/10px pad) |
| `buttonSmall`        | Smaller button (11px, 2/8px pad)        |
| `buttonTiny`         | Tiny button (11px, 1/6px pad)           |
| `buttonExtraSmall`   | Extra-tiny button (10px)                |
| `inputBase`          | Standard text input (12px, 6/8px pad)   |
| `inp`                | Compact input (12px, 4/6px pad)         |
| `dimText`            | Muted text `var(--text-dim)`            |
| `mutedText`          | Small muted text (11px)                 |
| `smallDimText`       | Extra-small muted text (10px)           |
| `centeredEmptyState` | Centered empty-state flex container     |
| `tooltipPanel`       | Absolute-positioned tooltip panel       |

## CSS theme variables

All widgets inherit the app's dark theme through CSS custom properties defined in `src/renderer/src/styles/globals.css`:

| Variable     | Value     | Use                         |
| ------------ | --------- | --------------------------- |
| `--bg`       | `#0e0f12` | Page background             |
| `--panel`    | `#16181d` | Widget/panel background     |
| `--panel-2`  | `#1b1e25` | Nested panel / button bg    |
| `--border`   | `#262a32` | Dividers and borders        |
| `--text`     | `#e6e8ec` | Primary text                |
| `--text-dim` | `#9aa0aa` | Secondary / muted text      |
| `--accent`   | `#6ea8ff` | Links, focus rings, primary |
| `--danger`   | `#ff6e6e` | Destructive actions         |
| `--warning`  | `#f59e0b` | Warning states              |
| `--radius`   | `8px`     | Border radius               |

Button classes `primary`, `ghost`, `danger`, `block`, and `small` are defined globally. Prefer them over inline button styles where applicable.

## Widget inventory

| Widget id              | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `api-tracker`          | Live log of every `api.net.fetch` call across all widgets          |
| `audition-aggregator`  | Tracks acting auditions with status/date filtering; multi-tab UI   |
| `contacts-master-list` | Manages a contact list backed by Google Contacts API               |
| `daily-calendar`       | Shows today's Google Calendar events; requires `api.google.shared` |
| `example-widget`       | Fully-annotated reference widget exercising all major APIs         |
| `file-shortcuts`       | Configurable list of files/folders; click to open with OS default  |
| `gmail`                | Reads Gmail inbox threads via Gmail API                            |
| `gmail-dashboard`      | Advanced Gmail client with folder trees, rules, and email list     |
| `job-aggregator`       | Searches job postings from multiple sources; saves/bookmarks jobs  |
| `job-tracker`          | Kanban board for job applications; CSV import/export; Gmail sync   |
| `media-tracker`        | Tracks books, movies, TV shows, games with chart visualizations    |
| `net-monitor`          | Monitors network latency and download speed with historical charts |
| `quick-copy`           | Stores reusable text snippets; click to copy to clipboard          |
| `website-monitor`      | Pings configured sites, tracks uptime/latency, shows trends        |

## Key files

| Purpose                   | File                                             |
| ------------------------- | ------------------------------------------------ |
| Shared type definitions   | `src/shared/types.ts`                            |
| IPC channel constants     | `src/shared/ipc.ts`                              |
| Google service presets    | `src/shared/google.ts`                           |
| Default AppState          | `src/shared/defaults.ts`                         |
| Widget ID validation      | `src/shared/validation.ts`                       |
| Bounded async concurrency | `src/shared/concurrency.ts`                      |
| Date utility              | `src/shared/date.ts`                             |
| CSV utilities             | `src/shared/csv.ts`                              |
| Sync base class           | `src/shared/sync-base.ts`                        |
| Main process entry        | `src/main/index.ts`                              |
| IPC handler registration  | `src/main/ipc.ts`                                |
| Storage orchestrator      | `src/main/storage/index.ts`                      |
| Storage helpers           | `src/main/storage/helpers.ts`                    |
| JSON KV store             | `src/main/storage/json.ts`                       |
| SQLite store              | `src/main/storage/sqlite.ts`                     |
| Google Drive wrapper      | `src/main/storage/drive.ts`                      |
| Google OAuth              | `src/main/oauth.ts`                              |
| Encrypted secrets         | `src/main/secrets.ts`                            |
| Drive sync manager        | `src/main/sync.ts`                               |
| WSL detection             | `src/main/platform.ts`                           |
| Preload contextBridge     | `src/preload/index.ts`                           |
| Dashboard Zustand store   | `src/renderer/src/state/dashboard.ts`            |
| Widget registry           | `src/renderer/src/plugins/registry.ts`           |
| Registry validator        | `src/renderer/src/plugins/registry-validator.ts` |
| WidgetApi wrapper         | `src/renderer/src/plugins/api.ts`                |
| apiEvents event bus       | `src/renderer/src/plugins/apiEvents.ts`          |
| namedSql utility          | `src/renderer/src/plugins/sqlParams.ts`          |
| SQL init hook             | `src/renderer/src/hooks/useSqlInit.ts`           |
| Migration helper          | `src/renderer/src/hooks/sqlMigrationHelper.ts`   |
| SQL schema pattern guide  | `src/renderer/src/hooks/SCHEMA_PATTERN.md`       |
| Global CSS + theme vars   | `src/renderer/src/styles/globals.css`            |
| GridLayout component      | `src/renderer/src/components/Dashboard.tsx`      |
| Widget error boundary     | `src/renderer/src/components/WidgetHost.tsx`     |
| App settings UI           | `src/renderer/src/components/AppSettings.tsx`    |
| Shared widget components  | `src/widgets/_shared/`                           |
| Widget scaffold script    | `src/widgets/create-widget.sh`                   |
| Build config              | `electron.vite.config.ts`                        |
| Vitest config             | `vitest.config.ts`                               |
| Widget authoring guide    | `src/widgets/README.md`                          |

## Testing

Unit tests live alongside source files under `src/` with the pattern `*.test.ts`. Run with:

```bash
npm run test           # single-run with Vitest
npm run test:coverage  # single-run with v8 coverage
```

Test files cover: core shared utilities (`validation`, `google`, `csv`, `concurrency`, `sync-base`, `date`), main process IPC and storage, renderer components and state management, widget APIs and utilities, and individual widget logic (job-aggregator, media-tracker, job-tracker/gmail). There are no integration or end-to-end tests.

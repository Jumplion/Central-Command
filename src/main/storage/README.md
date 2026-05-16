# `src/main/storage/` — Storage Backends

This folder contains everything responsible for reading and writing data to disk. Central Command uses two different storage backends plus the top-level `AppState` file, each suited for different kinds of data.

## Files

| File | What it does |
|---|---|
| `index.ts` | The `Storage` class — orchestrates both backends and handles `state.json` |
| `json.ts` | `JsonStore` — simple key/value storage backed by JSON files |
| `json.test.ts` | Unit tests for `JsonStore` |
| `sqlite.ts` | `SqliteStore` — relational data backed by SQLite databases |
| `sqlite.test.ts` | Unit tests for `SqliteStore` |
| `drive.ts` | `DriveSync` — wraps the Google Drive API for uploading/downloading storage files |

## The three storage layers

### 1. App state (`state.json`)

Managed directly in `index.ts`. This is a single JSON file that stores the entire dashboard configuration — which dashboards exist, what widgets are on each, their positions, sizes, and settings. It lives at `{userData}/state.json`.

**Write strategy:** Atomic writes — the code writes to a temp file first (`state.json.tmp`), then renames it to `state.json`. On most operating systems, a file rename is atomic, meaning you'll never end up with a half-written file if the app crashes mid-save.

### 2. JSON key/value store (`json.ts`)

`JsonStore` is a simple key/value store where each widget gets its own file at `{userData}/widgets/{widgetId}/store.json`.

**How it works:**
- When a widget reads or writes a key, the file is loaded into an **in-memory cache** (a JavaScript `Map`).
- Writes update the cache immediately and schedule a disk flush 200 ms in the future (debouncing).
- If many writes happen in quick succession, only one disk write happens — the last scheduled flush.
- On app quit, `flushAll()` is called to force all pending writes to disk before the process exits.

**Why debounce?** Writing to disk on every key change would be very slow if a widget updates data frequently (like every second). Batching writes into 200 ms windows gives good performance while keeping data reasonably fresh.

**Concurrency safety:** If two reads for the same widget happen before the first disk read completes, the code uses an `inflight` map to ensure only one file read happens — both reads share the same Promise.

### 3. SQLite database (`sqlite.ts`)

`SqliteStore` gives widgets access to a real relational database. Each widget gets its own SQLite file at `{userData}/widgets/{widgetId}/data.db`.

**What is SQLite?** SQLite is a file-based database — no separate database server needed. The entire database is a single `.db` file. It supports full SQL: `CREATE TABLE`, `INSERT`, `SELECT`, `JOIN`, etc. The `better-sqlite3` npm package provides the Node.js bindings.

**Key settings applied to every database:**
- `WAL` (Write-Ahead Logging) journal mode — allows reads and writes to happen simultaneously without blocking each other
- `foreign_keys=ON` — enforces `FOREIGN KEY` constraints (database integrity)

**The five SQL operations exposed:**
- `run(sql, params)` — INSERT, UPDATE, DELETE — returns `{ changes, lastInsertRowid }`
- `all(sql, params)` — SELECT multiple rows — returns an array
- `get(sql, params)` — SELECT one row — returns one object or `undefined`
- `exec(sql)` — Run raw SQL with no parameters (for `CREATE TABLE IF NOT EXISTS` etc.)
- `runBatch(items)` — Run multiple statements in a single **transaction**. If any statement fails, all changes are rolled back.

**Why parameterized queries?** When you write `sql.run('SELECT * FROM t WHERE id = ?', [userId])`, the `?` is a placeholder. `better-sqlite3` substitutes the value safely, preventing SQL injection attacks. Never use string concatenation to build SQL queries.

**Database caching:** Like `JsonStore`, `SqliteStore` keeps an open database connection in a `Map` so repeated calls don't pay the overhead of opening the file on every query.

## `drive.ts` — Google Drive wrapper

`DriveSync` handles uploading and downloading files to/from the user's Google Drive **app data folder** — a hidden area that only this app can see (users can't browse it in Google Drive's UI).

It uses `api.google.getToken()` to get a fresh access token before each request, and uses Electron's `net.fetch` (not the browser's `fetch`) to make HTTPS calls to the Google Drive REST API.

The three file types it syncs:
- `cc-state.json` — dashboard state
- `cc-kv-{widgetId}.json` — per-widget JSON KV exports
- `cc-db-{widgetId}.db` — SQLite database files (as binary uploads)

## How the pieces fit together

```
Storage (index.ts)
  ├── JsonStore (json.ts)     ← widget KV: widgets/{id}/store.json
  ├── SqliteStore (sqlite.ts) ← widget SQL: widgets/{id}/data.db
  └── state.json              ← dashboard layout (direct file I/O)

SyncManager (../sync.ts)
  └── DriveSync (drive.ts)    ← uploads/downloads the above files to Google Drive
```

`Storage` is created once in `src/main/index.ts` and passed to the IPC handler registry. All IPC handlers for KV and SQL operations call through to `storage.json` or `storage.sqlite`.

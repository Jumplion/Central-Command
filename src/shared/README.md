# `src/shared/` — Shared Types and Utilities

This folder contains code that both the **main process** (Node.js backend) and the **renderer** (React frontend) need to agree on. Nothing here is specific to either environment — no Electron APIs, no React, no browser APIs.

## Why a shared folder?

Electron compiles the main process and the renderer as two completely separate bundles. They never share runtime code. But they _do_ need to share **type definitions** (so TypeScript can catch mismatches) and **constants** (like channel names, so a typo in one place causes a type error rather than a silent bug).

`src/shared/` solves this: both bundles import from it at **compile time**, and the TypeScript aliases (`@shared`) make this easy.

## Files

| File                 | What it provides                                                          |
| -------------------- | ------------------------------------------------------------------------- |
| `types.ts`           | All shared TypeScript types — `AppState`, `WidgetManifest`, `CCApi`, etc. |
| `ipc.ts`             | The `IPC` constant — all channel name strings as a typed object           |
| `google.ts`          | Google service definitions (scopes, base URLs) and OAuth helper functions |
| `defaults.ts`        | The `DEFAULT_STATE` — the starting `AppState` for a fresh install         |
| `validation.ts`      | `isValidWidgetId()` — ensures widget IDs match the required format        |
| `csv.ts`             | CSV parsing and formatting utilities                                      |
| `sync-base.ts`       | Abstract base types shared by desktop sync                                |
| `google.test.ts`     | Unit tests for the Google helper functions                                |
| `validation.test.ts` | Unit tests for `isValidWidgetId`                                          |

---

## `types.ts` — The single source of truth for data shapes

This is the most important file in `src/shared/`. It defines every interface and type that crosses a process boundary.

**Key types:**

- `AppState` — the entire saved state of the app (dashboards, instances, settings)
- `WidgetManifest` — what a widget declares about itself (id, name, size, settings schema, permissions)
- `WidgetInstance` — one placed widget: its id, layout position, and settings values
- `SettingsField` — a union type describing one settings field (string input, number, boolean toggle, or select)
- `CCApi` — the complete interface of `window.cc` — every method exposed by the preload script
- `SqlRunResult`, `NetFetchResponse`, `DriveSyncStatus` — result shapes for IPC calls

When you change a type here, TypeScript will flag every place in the codebase that doesn't match the new shape.

---

## `ipc.ts` — IPC channel names

```ts
export const IPC = {
  KV_SET: "cc:kv:set",
  SQL_ALL: "cc:sql:all",
  // ...
} as const;
```

All IPC channel strings are defined here as constants. The `as const` tells TypeScript to treat each value as its exact string literal type (not just `string`), enabling exhaustiveness checking.

**Why not just write the strings directly?**
If you type `'cc:kv:set'` in `ipc.ts` and again in `preload/index.ts`, a typo in one place would be a silent bug (the handler just never fires). Using the `IPC` constant means a typo is a compile-time error.

---

## `google.ts` — Google service definitions

Defines the built-in Google service presets:

```ts
export const GOOGLE_SERVICES = {
  gmail:    { scopes: [...], apiBaseUrl: 'https://gmail.googleapis.com/gmail/v1/' },
  calendar: { scopes: [...], apiBaseUrl: 'https://www.googleapis.com/calendar/v3/' },
  drive:    { scopes: [...], apiBaseUrl: 'https://www.googleapis.com/drive/v3/' },
  // ...
}
```

Also provides helper functions used by `src/main/oauth.ts`:

- `resolveGoogleScopes(options)` — returns the right OAuth scopes for a service or custom scope list
- `getGoogleCredsKey(service?)` — returns the secrets key where credentials are stored
- `getGoogleTokenKey(service?)` — returns the secrets key where tokens are stored

---

## `defaults.ts` — Default state

Exports `DEFAULT_STATE` — the `AppState` used when no `state.json` exists yet (fresh install) or when a saved state file can't be parsed.

---

## `validation.ts` — Widget ID rules

Widget IDs must match `^[a-z0-9][a-z0-9-]{0,63}$` — lowercase letters, numbers, and hyphens, starting with a letter or number, between 1 and 64 characters total. This is enforced because the ID is used as a directory name on disk.

`isValidWidgetId(id)` returns a boolean. `assertValidWidgetId(id)` throws if invalid. Both are used at runtime (in `src/main/storage/json.ts`) and at build time (in the widget registry).

---

## `csv.ts` — CSV utilities

Provides `parseCSV(text)` and `formatCSV(rows)` for reading and writing comma-separated value files. Used by the `job-tracker` widget to import/export data.

The parser handles quoted fields (values that contain commas or newlines), which is the tricky part of the CSV format.

---

## `sync-base.ts`

Abstract base classes and types shared by `src/main/sync.ts`. Keeping the common logic here avoids duplicating the sync state machine across targets.

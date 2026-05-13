---
name: 'Electron Main Process'
description: 'Rules for the Electron main process and preload bridge'
applyTo: '{src/main/**,src/preload/**}'
---

## IPC discipline

- Adding a new IPC channel requires exactly 4 changes:
  1. `src/shared/ipc.ts` — channel name constant
  2. `src/main/ipc.ts` — `ipcMain.handle` registration
  3. `src/preload/index.ts` — `contextBridge.exposeInMainWorld` exposure
  4. `src/shared/types.ts` — `CCApi` type update
- Shared types in `src/shared/` must compile under both `tsconfig.node.json` and `tsconfig.web.json`

## Security

- `safeStorage` may not encrypt on headless Linux; falls back to base64 — treat as advisory only
- The job-capture HTTP server only accepts `chrome-extension://` and `moz-extension://` origins
- Import `IS_WSL` from `src/main/platform.ts` — do not re-declare it

## Storage

- `JsonStore` — per-widget-id file at `widgets/<widgetId>/store.json`
- `SqliteStore` — per-widget-id database at `widgets/<widgetId>/data.db`
- Always use parameterized SQL — pass query and params separately

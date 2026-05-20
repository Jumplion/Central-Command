# `src/main/` — Electron Main Process

This folder is the Node.js "backend" of Central Command. It owns everything that the sandboxed browser renderer cannot do: reading and writing files, running SQLite databases, managing OAuth tokens, and controlling the application window.

## What is the "main process"?

When you launch Central Command, Electron starts a Node.js program whose entry point is `src/main/index.ts`. This is the main process. It has full system access — it can write files, open network sockets, spawn child processes, and use OS APIs like the keychain.

Think of it as the server in a client-server architecture, except everything runs on the same machine.

## Files at a glance

| File          | What it does                                                                         |
| ------------- | ------------------------------------------------------------------------------------ |
| `index.ts`    | App entry point — creates the window, wires all managers together, starts Drive sync |
| `ipc.ts`      | Registers all IPC handlers so the renderer can call main-process features            |
| `ipc.test.ts` | Unit tests for the IPC layer                                                         |
| `oauth.ts`    | Google OAuth 2.0 PKCE flow — opens the browser, receives the callback, stores tokens |
| `secrets.ts`  | Encrypted key/value store backed by the OS keychain                                  |
| `sync.ts`     | Polls Google Drive every 5 minutes to push/pull data backups                         |
| `platform.ts` | Detects whether the app is running inside WSL (Windows Subsystem for Linux)          |
| `storage/`    | Subfolder containing the two storage backends (JSON and SQLite)                      |

## `index.ts` — The entry point

This file does five things in order:

1. **Creates the `BrowserWindow`** — This is Electron's API for creating an OS window. Key security settings are set here:
   - `contextIsolation: true` — the renderer is fully sandboxed; the preload script is the only bridge
   - `nodeIntegration: false` — the renderer cannot use Node.js APIs directly
   - `sandbox: false` — the preload script is allowed to use Electron's `contextBridge` API

2. **Initialises storage** — Creates a `Storage` instance (which manages both JSON and SQLite backends) and a `SecretsStore`.

3. **Sets up OAuth and Drive sync** — Creates an `OAuthManager` and a `SyncManager`, which are passed into each other because sync needs OAuth to talk to Google Drive.

4. **Registers IPC handlers** — Calls `registerIpc(...)` which tells Electron what code to run when the renderer sends each named message.

5. **Runs the initial sync** — After the window has loaded, tries to pull the latest state from Google Drive (if the user has sync enabled).

```
App starts
  → main process boots (index.ts)
  → window created
  → storage, secrets, oauth, sync all initialized
  → IPC handlers registered
  → renderer HTML loaded into window
  → initial Drive sync attempted
```

## `ipc.ts` — The IPC handler registry

IPC stands for **Inter-Process Communication** — the message-passing system between the main process and the renderer. The renderer calls `ipcRenderer.invoke('channel-name', ...args)` and the main process handles it with `ipcMain.handle('channel-name', handler)`.

`ipc.ts` is one big function `registerIpc(...)` that registers a handler for every channel defined in `src/shared/ipc.ts`. All input from the renderer is treated as untrusted and validated before use (checking types, validating URL schemes, etc.).

**Example flow — when a widget saves a KV entry:**

```
renderer: window.cc.kv.set('myWidget', 'myKey', 'myValue')
  → preload: ipcRenderer.invoke('cc:kv:set', 'myWidget', 'myKey', 'myValue')
  → ipc.ts handler: validates that all three args are strings, calls storage.json.set(...)
```

## `oauth.ts` — Google PKCE OAuth

PKCE (Proof Key for Code Exchange) is the secure way to do OAuth in a desktop app where you can't safely hide a client secret in your code.

Here's how the flow works:

1. The app generates a random `codeVerifier` string and computes `codeChallenge = SHA256(codeVerifier)`.
2. It starts a tiny HTTP server on a random port on localhost (e.g. `http://127.0.0.1:54321`).
3. It opens the user's default browser to Google's auth page, including the `codeChallenge` and the localhost redirect URL.
4. The user logs in and approves access in their browser.
5. Google redirects the browser to `http://127.0.0.1:54321?code=XXXXX`.
6. The local HTTP server receives that request, extracts the `code`, and closes itself.
7. The app exchanges the `code` + `codeVerifier` for real access/refresh tokens via a POST to Google's token endpoint.
8. Tokens are stored in the encrypted secrets store.

On subsequent calls, `getToken()` checks if the stored token is still fresh. If it's expired, it uses the stored `refreshToken` to get a new one without asking the user to log in again.

**WSL note:** WSL (Windows Subsystem for Linux) has a quirk: the Windows browser can reach `localhost` inside WSL, but not `127.0.0.1`. The code handles this by using `localhost` for the redirect URI when running in WSL.

## `secrets.ts` — Encrypted secrets

Widgets often need to store sensitive values like API keys. `SecretsStore` provides an encrypted KV store backed by Electron's `safeStorage` API, which uses the OS keychain (Keychain Access on macOS, Credential Manager on Windows, libsecret on Linux).

Secrets are stored per-widget in `userData/secrets/{widgetId}.json`, but the values themselves are encrypted before being written to disk.

## `sync.ts` — Google Drive sync

`SyncManager` polls Google Drive every 5 minutes (when enabled) to sync these three files:

- `cc-state.json` — the dashboard layout and widget settings
- `cc-kv-{widgetId}.json` — per-widget JSON KV stores
- `cc-db-{widgetId}.db` — per-widget SQLite databases

On pull, the remote version always wins (last-writer-wins). After a successful pull, the main process sends a `cc:drive-sync:status-changed` event to the renderer so the UI can reload state.

All sync operations go through a queue so they never run in parallel and cause data corruption.

## `platform.ts`

A small helper that detects whether the app is running inside WSL by checking environment variables and the system's `/proc/version` file. Used in `ipc.ts` and `oauth.ts` to handle WSL-specific quirks (opening URLs in the Windows browser instead of a Linux one).

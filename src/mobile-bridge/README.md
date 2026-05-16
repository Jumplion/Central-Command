# `src/mobile-bridge/` — Mobile API Bridge

This folder is the mobile equivalent of the Electron preload script. When Central Command runs on Android (via Capacitor), there is no Electron and no `contextBridge`. This folder provides the exact same `window.cc` API that widgets expect, but implemented using Capacitor plugins instead of Electron IPC.

## Why does this exist?

Widgets are written against the `CCApi` interface (defined in `src/shared/types.ts`). The interface uses only async methods — it makes no assumptions about whether the underlying implementation is Electron IPC, Capacitor plugins, or anything else.

On desktop, the preload script (`src/preload/index.ts`) wires `window.cc` to Electron. On mobile, `installMobileBridge()` (in `index.ts`) wires `window.cc` to Capacitor. From a widget's perspective, the API is identical — the same `api.kv.set(...)` call works on both platforms.

## What is Capacitor?

Capacitor is a framework that lets you run a web app as a native Android or iOS app. It wraps your HTML/JS/CSS in a `WebView` (a browser embedded in a native app), and provides "plugins" that bridge JavaScript calls to native Android/iOS code.

For example, Capacitor's `@capacitor/filesystem` plugin lets JavaScript read and write files on the device — the JavaScript calls a plugin method, and the plugin's native (Kotlin) code does the actual file I/O.

## Files

| File | What it implements |
|---|---|
| `index.ts` | `installMobileBridge()` — assembles `window.cc` from all the modules below |
| `state.ts` | `stateApi` — load/save `AppState` using `@capacitor/filesystem` |
| `kv.ts` | `kvApi` — key/value storage using `@capacitor/preferences` |
| `sql.ts` | `sqlApi` — SQLite using `@capacitor-community/sqlite` |
| `secrets.ts` | `secretsApi` — "secrets" stored in `@capacitor/preferences` (no OS keychain on mobile) |
| `net.ts` | `netApi` — HTTP fetch (uses the standard `window.fetch` on mobile, no CORS issues in a WebView) |
| `stubs.ts` | `shellApi`, `dialogApi` — stub implementations that log warnings (OS shell/file picker not supported on mobile) |
| `google-oauth.ts` | OAuth using `@capacitor/browser` to open the Google consent page |
| `drive-sync.ts` | `DriveSync` — uploads/downloads files to Google Drive (same logic as desktop) |
| `sync-manager.ts` | `MobileSyncManager` — polls Drive and manages sync state (same logic as desktop) |

## `index.ts` — `installMobileBridge()`

This function is called once at app startup in `src/mobile-renderer/main.tsx` (before React renders). It:

1. Initialises the SQLite plugin (`initSqlite()`)
2. Creates a `DriveSync` and `MobileSyncManager`
3. Assembles a `CCApi` object from all the module-level API objects
4. Assigns it to `window.cc` — exactly as the preload script does on desktop
5. Calls `initialSync()` to sync from Drive if enabled

After `installMobileBridge()` returns, `window.cc` is ready and the React app can render normally.

## Key differences from the Electron implementation

| Feature | Desktop (Electron) | Mobile (Capacitor) |
|---|---|---|
| File storage | Node.js `fs` module | `@capacitor/filesystem` |
| KV storage | JSON files on disk | `@capacitor/preferences` (device storage) |
| SQLite | `better-sqlite3` (synchronous) | `@capacitor-community/sqlite` (async) |
| Secrets | Electron `safeStorage` (OS keychain) | `@capacitor/preferences` (not encrypted) |
| Network | Electron `net.fetch` (no CORS) | `window.fetch` (no CORS inside a WebView) |
| Open URLs | `shell.openExternal` | `@capacitor/browser` |
| File dialog | Electron `dialog.showOpenDialog` | Not supported (stub) |
| OAuth redirect | Local loopback HTTP server | In-app browser + custom URL scheme |

## OAuth on mobile

Mobile OAuth is more complex than desktop because there's no loopback HTTP server. Instead:

1. The app opens Google's auth URL in an in-app browser (`@capacitor/browser`)
2. After the user approves, Google redirects to a custom URL scheme like `centralcommand://oauth`
3. The native `OAuthCallbackPlugin` (in `android/app/src/main/java/`) intercepts that redirect and passes the auth code back to JavaScript
4. The app exchanges the code for tokens and stores them in preferences

The Android plugin code is in `android/app/src/main/java/com/centralcommand/app/OAuthCallbackPlugin.kt`.

# `src/preload/` — The Security Bridge

This folder contains the preload script, which is the only safe path between the Electron main process and the React renderer. It is tiny by design — just two files — but it is architecturally critical.

## Files

| File | What it does |
|---|---|
| `index.ts` | The preload script — assembles `window.cc` and exposes it to the renderer |
| `index.d.ts` | TypeScript declaration that tells the renderer `window.cc` exists and what its type is |

## Why does this exist?

Electron runs your UI in a Chromium browser engine. For security, it is sandboxed — just like a normal webpage, it can't directly touch your filesystem, open databases, or use OS APIs.

But a dashboard app needs to do all of those things. The solution is the **preload script**: a special script that Electron loads *before* the renderer, in a context that can reach both worlds. It uses Electron's `contextBridge.exposeInMainWorld(name, api)` to inject a controlled object into `window`.

```
┌─────────────────────┐      ┌─────────────────────┐
│   Main Process       │      │  Renderer Process    │
│   (Node.js)          │      │  (Chromium)          │
│                      │      │                      │
│   ipcMain.handle()  ◄├──────┤►  window.cc.kv.set() │
│                      │ IPC  │                      │
└─────────────────────┘      └─────────────────────┘
              ▲
              │ preload script bridges the gap
              │ runs in a privileged in-between context
```

## How `index.ts` works

The file builds a single `api` object that matches the `CCApi` type from `src/shared/types.ts`. Every method on it calls `ipcRenderer.invoke(channelName, ...args)`, which sends a message to the main process and returns a Promise for the result.

For example, here is how the KV `set` method is wired:

```ts
// In preload/index.ts
kv: {
  set: (widgetId, key, value) => ipcRenderer.invoke(IPC.KV_SET, widgetId, key, value),
}
```

When the renderer calls `window.cc.kv.set('my-widget', 'greeting', 'hello')`:
1. The preload's `set` function runs
2. It calls `ipcRenderer.invoke('cc:kv:set', 'my-widget', 'greeting', 'hello')`
3. Electron delivers that message to the main process
4. The handler in `src/main/ipc.ts` runs `storage.json.set('my-widget', 'greeting', 'hello')`
5. The result (a resolved Promise) travels back to the renderer

At the very end of `index.ts`:
```ts
contextBridge.exposeInMainWorld('cc', api);
```

This is what puts the `api` object onto `window.cc` in the renderer. Without this line, the renderer would have no way to call anything in the main process.

## Drive sync event listener

Most of the API follows a request/response pattern (renderer asks, main responds). But Drive sync is different — the main process needs to *push* a notification to the renderer when a remote sync changes state.

The `driveSync.onStatusChanged` method handles this:

```ts
onStatusChanged: (cb) => {
  const handler = (_event, status) => cb(status);
  ipcRenderer.on(IPC.DRIVE_SYNC_STATUS_CHANGED, handler);
  return () => ipcRenderer.removeListener(IPC.DRIVE_SYNC_STATUS_CHANGED, handler);
}
```

It uses `ipcRenderer.on(...)` (not `invoke`) to listen for push events. It also returns a cleanup function — the caller is responsible for calling that cleanup when they no longer need the subscription (the React app does this in a `useEffect` cleanup).

## `index.d.ts`

TypeScript needs to know that `window.cc` exists and what type it has. This declaration file does that:

```ts
import type { CCApi } from '../shared/types';
declare global {
  interface Window {
    cc: CCApi;
  }
}
```

Without this, the renderer's TypeScript compiler would say "Property 'cc' does not exist on type 'Window'" every time you write `window.cc`.

## Security contract

- The preload is the **only** code that runs with access to `ipcRenderer`. The renderer itself only sees the `window.cc` object.
- `contextBridge` enforces that only plain objects, arrays, strings, numbers, booleans, and functions pass through. You can't accidentally leak a Node.js `Buffer` or an Electron internal.
- The main process validates all input from the renderer (treating it as untrusted) before using it — see `src/main/ipc.ts`.

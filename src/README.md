# `src/` — All Application Source Code

This is the root of every line of code that makes up Central Command. Everything under here gets compiled and bundled before the app runs — none of it executes directly.

## Why does `src/` exist?

Separating source code into `src/` is a common convention that keeps your working code away from config files, build output, and project-level docs at the root. When you run `npm run build`, the compiler reads from `src/` and writes the results to `out/` (which you never edit by hand).

## What's inside

```bash
src/
├── main/             # Electron "main process" — the Node.js backend
├── preload/          # The secure bridge between backend and frontend
├── renderer/         # The React frontend (what you see on screen)
├── shared/           # Types and constants used by both backend and frontend
├── widgets/          # Each widget plugin lives in its own subfolder here
```

## The big picture: Electron's two worlds

Electron apps are split into two completely separate JavaScript environments:

**Main process** (`src/main/`) — This is a regular Node.js program. It can read files, open databases, make network requests without CORS, access the OS keychain, spawn child processes, etc. There is exactly one main process per running app.

**Renderer process** (`src/renderer/`) — This is essentially a Chromium browser tab. It runs your React UI. For security reasons, it has *no* direct access to Node.js or the filesystem. It's sandboxed just like a webpage.

**The bridge** (`src/preload/`) — Because these two worlds can't talk directly, Electron provides a "preload script." It runs in a special context that can reach both sides, and it uses `contextBridge` to expose a safe, controlled API (`window.cc`) that the renderer can call.

**Shared code** (`src/shared/`) — TypeScript types and constants that both the main process and the renderer need to agree on (like the names of IPC channels and the shape of data objects). This code is imported by both sides at compile time but is never a single shared runtime bundle.

## How a user action flows through all layers

Here's the journey of a widget saving a value to storage:

1. Widget code (in `src/widgets/`) calls `api.kv.set('myKey', 'hello')`
2. That `api` object (from `src/renderer/src/plugins/api.ts`) calls `window.cc.kv.set(...)`
3. `window.cc` was installed by the preload script (`src/preload/index.ts`), which forwards the call to the main process via `ipcRenderer.invoke('cc:kv:set', ...)`
4. The main process (`src/main/ipc.ts`) receives the IPC message and calls `storage.json.set(...)`
5. The JSON store (`src/main/storage/json.ts`) updates its in-memory cache and schedules a disk write 200 ms later

This round-trip happens for every storage, network, and OS interaction. It sounds complex, but it's what keeps the app secure — the renderer (which loads user widgets) can never directly touch the filesystem.

## Build configuration

The three separate compilation targets (main, preload, renderer) are configured in `electron.vite.config.ts` at the project root. Each has its own set of import path aliases (`@shared`, `@main`, `@renderer`, `@widgets`) that make imports cleaner than typing relative paths like `../../shared/types`.

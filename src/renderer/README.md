# `src/renderer/` — The React Frontend

This folder is the browser-side half of the Electron app — everything the user sees and interacts with. It is a standard React single-page application, built with Vite, and served into Electron's `BrowserWindow`.

## Files and folders

```bash
src/renderer/
├── index.html   # The HTML shell — Vite injects the bundled JS here
└── src/         # All React source code (see src/renderer/src/README.md)
```

## What is a "renderer process"?

In Electron, a renderer process is a Chromium browser tab. It runs JavaScript and renders HTML/CSS just like any webpage. The key limitation: it has **no access to Node.js or the filesystem**. It can only reach the outside world through the `window.cc` API injected by the preload script.

This is actually a security feature. Widgets loaded in the renderer are sandboxed — even if a widget had a bug, it couldn't directly read your files or make arbitrary network requests outside of `window.cc.net.fetch`.

## `index.html`

This is the single HTML page that Vite uses as its build entry point. It contains a minimal shell:

- A `<div id="root">` where React mounts the entire application
- A `<script>` tag pointing to `src/main.tsx` (the React entry point)
- Vite replaces that script tag at build time with the bundled, minified output

You should rarely need to edit this file. If you want to add a global font or meta tag, this is where it goes.

## How React renders into Electron

At dev time, `electron-vite` starts a Vite dev server and the Electron window loads the page from `http://localhost:5173` (the `ELECTRON_RENDERER_URL` environment variable). Changes to React components trigger hot-module replacement (HMR) — the page updates without a full reload.

At build time, `npm run build` bundles everything into `out/renderer/`. The window then loads the `index.html` file directly from disk instead of from a server.

## What the renderer can and cannot do

**Can do:**

- Render React components, manage local state
- Call `window.cc.*` methods to read/write storage, make HTTP requests, open files
- Subscribe to push events from the main process (e.g., Drive sync status changes)

**Cannot do:**

- Import Node.js modules (`fs`, `path`, `crypto`, etc.)
- Directly access the SQLite database or filesystem
- Use Electron APIs like `ipcRenderer` (the preload handles that)

## Where to go next

All the interesting renderer code lives in `src/renderer/src/` — see that folder's README for a breakdown of components, state, plugins, and hooks.

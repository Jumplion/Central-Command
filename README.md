# Central Command

Personal extensible dashboard. Foundation for organizing daily reminders, stat
tracking, and any other modules you decide to bolt on. Desktop-first (Electron),
designed so the widget contract can be reused by a future mobile shell.

## Stack

- Electron + React + TypeScript
- Vite via `electron-vite`
- Per-widget storage: JSON key/value + SQLite (`better-sqlite3`)
- Drag/resize dashboard powered by `react-grid-layout`
- Local state via `zustand`

## Getting started

```bash
npm install
npm run dev
```

The first run creates the user data directory (Electron's `userData` path),
which holds the dashboard state and per-widget storage.

### Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start Electron + Vite dev server with HMR |
| `npm run build`     | Build main, preload, and renderer bundles |
| `npm run test`      | Run unit tests with Vitest                |
| `npm run test:coverage` | Run unit tests with coverage output  |
| `npm run typecheck` | Typecheck both Node and Web projects      |
| `npm run package`   | Build + run electron-builder              |

## Project layout

```bash
src/
├── main/        # Electron main process (window, IPC, storage)
├── preload/     # contextBridge exposing window.cc to the renderer
├── renderer/    # React app (sidebar + grid dashboard)
├── widgets/     # Widget plugins (drop folders here)
└── shared/      # Types and IPC channel names shared across processes
```

## Adding a widget

Create a folder at `src/widgets/<id>/` with an `index.tsx` that default-exports
a `Widget`. See [`src/widgets/README.md`](src/widgets/README.md) for the
manifest reference, storage API, and a minimal example.

The dev server picks up new widget folders automatically; restart if necessary.

## Storage model

- **App state** (`state.json`) - dashboards, layouts, widget instances
- **Per-widget JSON** (`widgets/<id>/store.json`) - small key/value, scoped per
  instance via key prefix
- **Per-widget SQLite** (`widgets/<id>/data.db`) - structured data, shared
  across instances of the same widget

All storage lives under Electron's `userData` directory. Back up that folder to
back up everything.

## Mobile path (later)

The widget contract (`WidgetApi`) only depends on async JSON KV + async SQL.
A future React Native shell can satisfy this contract with native equivalents
(MMKV / SQLite) without changing widget code.

# Central Command

A personal extensible dashboard desktop app. Add widgets for tracking jobs, media, email, auditions, file shortcuts, and anything else you want on your dashboard. Each widget is a self-contained plugin you can build yourself.

Built with Electron (for desktop), React (for the UI), and TypeScript (for type safety).

## What does it look like?

A sidebar on the left lists your dashboards (you can have multiple). The main area is a grid where you drag, resize, and arrange widgets. Each widget is isolated — its own storage, its own settings, its own logic.

## Getting started

```bash
npm install    # installs all dependencies
npm run dev    # starts the app in development mode with hot-reload
```

The first run creates a `userData` directory on your computer (Electron's app data folder) where the dashboard state and widget data are stored. The location is:

- **macOS:** `~/Library/Application Support/central-command/`
- **Windows:** `%APPDATA%\central-command\`
- **Linux:** `~/.config/central-command/`

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the app in dev mode — changes hot-reload without restart |
| `npm run build` | Compile all bundles (main process, preload, renderer) for production |
| `npm run test` | Run the Vitest unit test suite |
| `npm run test:coverage` | Run tests and generate a coverage report |
| `npm run typecheck` | Check TypeScript types across all projects |
| `npm run package` | Build + create a distributable installer |

## Technology overview

### Electron

Electron lets you build desktop apps with web technology (HTML, CSS, JavaScript). It bundles a Node.js process (the "main process") with a Chromium browser engine (the "renderer process"). The main process has full system access; the renderer is sandboxed like a browser tab. They communicate through a secure message-passing system called IPC.

### React

React is the JavaScript library used to build the UI. The entire dashboard — sidebar, grid, widgets, modals — is a tree of React components. Each component is a function that takes data as input and returns HTML-like JSX as output. When data changes, React efficiently re-renders only the components that are affected.

### TypeScript

TypeScript adds static types to JavaScript. When you declare that a function returns `string`, TypeScript checks every caller at compile time. This catches a huge class of bugs before you even run the code. All `.ts` and `.tsx` files in this project are TypeScript.

### Vite / electron-vite

Vite is the build tool that compiles TypeScript, bundles modules, and serves the dev server with hot-module replacement. `electron-vite` extends Vite specifically for Electron's three-bundle structure (main, preload, renderer).

### Zustand

Zustand is a lightweight state management library for React. The dashboard state (which widgets are on which dashboard, their positions, settings) lives in a Zustand store. Any component can subscribe to exactly the part of the state it needs.

### react-grid-layout

The widget grid is powered by `react-grid-layout`. It handles drag-to-move and resize, a 12-column grid system, and compacting (widgets fall down to fill gaps). Each widget's position is stored as `{ x, y, w, h }` in grid units.

### better-sqlite3

Widgets can use SQLite databases for structured data (think spreadsheet-style tables). `better-sqlite3` is a fast, synchronous Node.js SQLite driver. It's used only in the main process.

## Project layout

```bash
Central-Command/
├── src/
│   ├── main/             # Electron main process (Node.js backend)
│   ├── preload/          # Secure bridge between main and renderer
│   ├── renderer/         # React frontend (what you see)
│   ├── shared/           # Types and constants used by both main and renderer
│   ├── widgets/          # Widget plugins — add your own here
├── electron.vite.config.ts  # Build config for Electron (3 bundles)
├── electron-builder.yml     # Packaging config (installers)
├── tsconfig.json            # Base TypeScript config
├── tsconfig.node.json       # TypeScript config for the main process
├── tsconfig.web.json        # TypeScript config for the renderer
└── vitest.config.ts         # Test runner config
```

Each subfolder has its own README with detailed documentation. Start with `src/README.md` for the big picture.

## How data is stored

All data lives in the `userData` directory:

```bash
userData/
├── state.json               # Dashboard layout, widget instances, settings
└── widgets/
    ├── job-tracker/
    │   ├── store.json       # Key/value data for the job-tracker widget
    │   └── data.db          # SQLite database for the job-tracker widget
    ├── media-tracker/
    │   ├── store.json
    │   └── data.db
    └── ...
```

Back up the entire `userData` directory to back up all your data.

## Adding a widget

Create a new folder at `src/widgets/<your-id>/` with an `index.tsx` that default-exports a `Widget` object. The dev server picks it up automatically on the next build. See `src/widgets/README.md` for the full authoring guide.

## Google Drive sync

Optional. Enable it in the Settings panel (sidebar → Settings). You'll need a Google Cloud project with Drive API enabled. When active, the app syncs your data to your Google Drive app data folder every 5 minutes. It also pulls on startup. Remote state always wins on pull.

# `src/renderer/src/` — React Application Source

This is the source code for the React application that runs inside the Electron window. It handles the UI layout, widget rendering, state management, and the plugin system that discovers and loads widgets.

## Entry points

| File       | Role                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| `main.tsx` | React entry — calls `ReactDOM.createRoot(...).render(<App />)`           |
| `App.tsx`  | Root component — loads state on mount, renders the sidebar and dashboard |

## Subfolders

```bash
src/renderer/src/
├── components/   # All React UI components (Dashboard, Sidebar, WidgetHost, etc.)
├── hooks/        # Reusable React hooks for widgets
├── plugins/      # Widget registry and per-instance API factory
├── state/        # Zustand global state store for the dashboard
├── styles/       # Global CSS
└── utils/        # Utility functions (e.g., CSV parsing)
```

## How the app starts up

1. `main.tsx` creates the React root and renders `<App />`
2. `App.tsx` fires a `useEffect` on mount that calls `window.cc.state.load()` to fetch the saved dashboard state from the main process
3. While loading, it shows a "Loading…" screen
4. Once the state arrives, it populates the Zustand store and re-renders with the full dashboard
5. `App.tsx` also sets up a listener for `driveSync.onStatusChanged` — if a remote sync changes the state, it reloads automatically

## The `App` component structure

```tsx
<App>
  <Sidebar /> ← dashboard list, "Add widget" button, settings
  <main>
    <Dashboard /> ← grid of widget instances
  </main>
</App>
```

## How components, state, and plugins relate

```bash
Zustand store (state/dashboard.ts)
  │  stores: dashboards, instances, layouts, settings
  │
  ├── read by: App, Sidebar, Dashboard, WidgetHost
  └── written by: Sidebar (add/remove dashboard), Dashboard (layout changes),
                  WidgetHost (settings, title), AddWidgetDialog (new instances)

Plugin registry (plugins/registry.ts)
  │  discovers all src/widgets/*/index.tsx at build time
  │
  └── read by: Dashboard (renders widgets), AddWidgetDialog (lists available widgets)

WidgetApi factory (plugins/api.ts)
  │  creates an api object scoped to one widget instance
  │
  └── used by: WidgetHost (passes api to each widget's Component)
```

## Data flow for a user action

### Example: user drags a widget to a new position

1. `<GridLayout>` (inside `Dashboard.tsx`) fires `onDragStop` with the new layout array
2. `Dashboard` calls `updateLayout(newLayouts)` from the Zustand store
3. The store updates its state and schedules a save (`persist()`)
4. 150 ms later, `window.cc.state.save(state)` is called via IPC
5. The main process writes the new state to `userData/state.json`
6. On next app start, the widget appears in its new position

### Example: user clicks "+ Add widget"

1. `Sidebar` renders `<AddWidgetDialog>`
2. The dialog calls `listWidgets()` from the registry to get all available widgets
3. User picks one; dialog calls `addInstance(widgetId)` on the store
4. Store generates a new `instanceId`, gets default settings from the manifest, adds the instance
5. Store triggers `persist()` → saved to disk
6. `Dashboard` re-renders, maps the new instance to a `<WidgetHost>`
7. `WidgetHost` creates a `WidgetApi` for the new instance and renders the widget's `Component`

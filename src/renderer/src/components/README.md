# `src/renderer/src/components/` — React UI Components

This folder contains every visual component that makes up the Central Command interface. Each file is a React component (a TypeScript function that returns JSX — the HTML-like syntax React uses).

## What is a React component?

A React component is a function that takes `props` (inputs) and returns UI. React re-runs the function whenever its props or internal state changes and updates the DOM to match. Components are composable — big components are built from smaller ones.

```tsx
function Greeting({ name }: { name: string }) {
  return <p>Hello, {name}!</p>;
}
```

## Components overview

| File | What the user sees |
| --- | --- |
| `Dashboard.tsx` | The main grid where widgets live and can be dragged/resized |
| `WidgetHost.tsx` | The chrome (header, settings button, remove button) around each widget |
| `Sidebar.tsx` | The left panel with dashboard list, "+ Add widget", and Settings |
| `AddWidgetDialog.tsx` | The modal that appears when you click "+ Add widget" |
| `AppSettings.tsx` | The modal for app-wide settings (Google Drive sync, etc.) |
| `WidgetSettingsPanel.tsx` | The overlay that appears when you click the ⚙ button on a widget |

## `Dashboard.tsx`

This component renders the draggable, resizable grid using the `react-grid-layout` library.

**How `react-grid-layout` works:**

- The grid is divided into 12 equal columns and rows of 60px height
- Each widget occupies a rectangular area defined by `{ x, y, w, h }` in grid units
- The user can drag widgets by their header and resize them from the corners
- When the drag or resize ends, `onDragStop` / `onResizeStop` fire with the new positions
- The component calls `updateLayout(...)` on the Zustand store, which persists the new positions

**Container width tracking:**
The grid needs to know its pixel width to calculate column widths. `Dashboard` uses a `ResizeObserver` (a browser API that fires when an element changes size) to watch the container div and update a `width` state value. `requestAnimationFrame` is used to debounce rapid resize events smoothly.

## `WidgetHost.tsx`

`WidgetHost` is the wrapper rendered around every widget. It is responsible for:

1. **Rendering the header** — shows the icon, title (from `instance.title || manifest.name`), and action buttons
2. **Settings toggle** — the ⚙ button only appears if the widget's manifest declares any settings fields
3. **Remove button** — calls `removeInstance(instanceId)` on the store
4. **Creating the WidgetApi** — calls `createWidgetApi(widgetId, instanceId)` from `plugins/api.ts` and passes it as `api` to the widget's Component
5. **Error boundary** — wraps the widget's Component in an `ErrorBoundary` class component

**What is an Error Boundary?**
React error boundaries are class components (the older React style) that implement `getDerivedStateFromError`. If any component in the subtree throws a JavaScript error during rendering, the boundary catches it and renders an error message instead — without crashing the entire dashboard. That's why one broken widget doesn't take down everything else.

**`memo()`:**
`WidgetHost` is wrapped in `React.memo(...)`. This is a performance optimization: if the same `instance` and `widget` props are passed again on a re-render, React skips re-rendering this component. This prevents all widgets from re-rendering just because one widget changed.

## `Sidebar.tsx`

The sidebar is the primary navigation and control panel. It:

- Lists all dashboards using the Zustand store's `state.dashboards`
- Highlights the active dashboard (`state.activeDashboardId`)
- Supports inline renaming (double-click a dashboard name to edit it)
- Has a "+" button to create a new dashboard instantly
- Has a "✕" button to delete the currently-active dashboard (with a confirmation prompt)
- Renders `<AddWidgetDialog>` and `<AppSettings>` conditionally based on local boolean state

**Why local state for `showAdd` / `showSettings`?**
These are purely UI states — whether a modal is open. They don't need to survive a page reload or be shared with other components, so `useState` (local to the component) is the right choice instead of the global Zustand store.

## `WidgetSettingsPanel.tsx`

This panel is rendered inside `WidgetHost` when the user opens a widget's settings. It reads the widget's `manifest.settings` array and **automatically generates a settings form** from it.

Each `SettingsField` has a `kind` property (`'string'`, `'number'`, `'boolean'`, `'select'`) that determines which input element to render. This means widget authors only declare *what* settings they need in their manifest — the UI is built for them automatically.

When the user saves, it calls `updateSettings(instanceId, newSettings)` on the store.

## `AddWidgetDialog.tsx`

Shows a searchable list of all registered widgets (from `listWidgets()` in the plugin registry). Clicking a widget calls `addInstance(widgetId)` on the store and closes the dialog.

## `AppSettings.tsx`

The application-level settings UI, currently focused on Google Drive sync:

- Shows current sync status
- Buttons to enable/disable sync and force push/pull
- All calls go through `window.cc.driveSync.*` IPC methods

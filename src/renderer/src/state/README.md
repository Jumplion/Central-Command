# `src/renderer/src/state/` — Global State Management

This folder contains the Zustand store that holds all dashboard state: which dashboards exist, which widgets are on each dashboard, their positions, sizes, and settings.

## Files

| File                | What it does                                                       |
| ------------------- | ------------------------------------------------------------------ |
| `dashboard.ts`      | The Zustand store — all state and actions for dashboard management |
| `dashboard.test.ts` | Unit tests for the store's logic                                   |

---

## What is Zustand?

Zustand is a state management library — a way to share data between React components without passing props through every level of the component tree.

Without Zustand, if `Sidebar` needed to add a widget and `Dashboard` needed to render it, you'd have to lift the state up to their shared parent (`App`) and pass callbacks down. That gets messy quickly.

With Zustand, you create a **store** — a single object with state and methods — and any component can subscribe to exactly the parts it needs:

```ts
// In any component, anywhere in the tree:
const addInstance = useDashboard((s) => s.addInstance);
const dashboards = useDashboard((s) => s.state.dashboards);
```

When state changes, only components that subscribed to the changed slice re-render. Components that only read `dashboards` don't re-render when a widget's title changes.

---

## The `AppState` shape

The central piece of data is `AppState` (defined in `src/shared/types.ts`):

```ts
AppState {
  version: number
  dashboards: Dashboard[]
  activeDashboardId: string
}

Dashboard {
  id: string
  name: string
  instances: WidgetInstance[]
}

WidgetInstance {
  instanceId: string
  widgetId: string
  layout: { x, y, w, h }    // grid position (in 12-col grid units)
  settings: Record<string, unknown>
  title?: string
}
```

The `activeDashboardId` tells the app which dashboard to display. Switching dashboards just changes this ID.

---

## The `DashboardStore` interface

The store exposes these pieces:

| Name                                   | Type       | Description                                             |
| -------------------------------------- | ---------- | ------------------------------------------------------- |
| `loaded`                               | `boolean`  | `false` until `load()` completes                        |
| `state`                                | `AppState` | The entire dashboard state                              |
| `load()`                               | action     | Fetches state from disk via `window.cc.state.load()`    |
| `persist()`                            | action     | Debounces a save to disk (150 ms delay)                 |
| `applyRemoteState()`                   | action     | Replaces state with a version pulled from Google Drive  |
| `activeDashboard()`                    | selector   | Returns the currently active `Dashboard` object         |
| `setActiveDashboard(id)`               | action     | Switch to a different dashboard                         |
| `addDashboard(name)`                   | action     | Create a new empty dashboard                            |
| `removeDashboard(id)`                  | action     | Delete a dashboard (with fallback to keep at least one) |
| `renameDashboard(id, name)`            | action     | Change a dashboard's display name                       |
| `addInstance(widgetId)`                | action     | Add a widget to the active dashboard                    |
| `removeInstance(instanceId)`           | action     | Remove a widget from the active dashboard               |
| `updateLayout(layouts)`                | action     | Update positions after drag/resize                      |
| `updateSettings(instanceId, settings)` | action     | Save new settings for one widget instance               |
| `setTitle(instanceId, title)`          | action     | Set a widget's display title override                   |

---

## The `mutate` helper

Almost every action follows the same pattern: update state → schedule persistence. The internal `mutate` helper does both in one call:

```ts
function mutate(updater: (s: AppState) => AppState): void {
  set((store) => ({ state: updater(store.state) }));
  get().persist();
}
```

This keeps action implementations clean — they just describe how state changes:

```ts
addDashboard(name) {
  const id = nanoid(8);
  mutate((s) => ({
    ...s,
    dashboards: [...s.dashboards, { id, name, instances: [] }],
    activeDashboardId: id
  }));
  return id;
}
```

The `...s` spread creates a new object (required for React to detect the change) while only updating the fields that changed.

## The `persist()` debounce

`persist()` uses a 150 ms debounce:

```ts
persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void window.cc.state.save(get().state);
  }, 150);
}
```

If `mutate` is called 10 times in quick succession (e.g., while the user is dragging a widget), only **one** IPC call and disk write will happen — 150 ms after the last change. This prevents writing to disk dozens of times per second during an interaction.

## `applyRemoteState`

When Google Drive sync pulls new state from the cloud, the main process sends a `DRIVE_SYNC_STATUS_CHANGED` event. `App.tsx` listens for this and calls `applyRemoteState(newState)`.

`applyRemoteState` cancels any pending `persist()` timer (to avoid overwriting the just-pulled state) and replaces the store's state with the remote version. This is the "remote wins" policy.

## `nanoid`

Rather than importing a full library, the store has a tiny inline ID generator:

```ts
function nanoid(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => NANOID_ALPHABET[b & 63]).join("");
}
```

It uses the browser's built-in `crypto.getRandomValues` to generate cryptographically random IDs from a URL-safe alphabet. Dashboard IDs are 8 characters, widget instance IDs are 10 characters.

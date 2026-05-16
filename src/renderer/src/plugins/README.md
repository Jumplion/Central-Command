# `src/renderer/src/plugins/` — Widget Plugin System

This folder is the engine that powers the widget system. It has three responsibilities: auto-discovering all installed widgets, exposing a typed API scoped to each widget instance, and tracking API call events.

## Files

| File | What it does |
| --- | --- |
| `registry.ts` | Discovers all `src/widgets/*/index.tsx` files at build time and exposes them as a registry |
| `api.ts` | Creates a `WidgetApi` object scoped to one specific widget instance |
| `apiEvents.ts` | Simple event bus for tracking outgoing network requests (used by the api-tracker widget) |

---

## `registry.ts` — The Widget Registry

The registry is how the app knows which widgets exist. You never register a widget manually — the registry finds them automatically.

### How auto-discovery works: `import.meta.glob`

Vite (the build tool) provides a special import called `import.meta.glob`. At build time, Vite scans the filesystem matching the given pattern and bundles all matching files. At runtime, those files are immediately available as a JavaScript object.

```ts
const modules = import.meta.glob<{ default: Widget }>('../../../widgets/*/index.tsx', {
  eager: true  // load all files immediately, not lazily
});
```

After this line, `modules` is an object like:

```js
{
  '../../../widgets/gmail/index.tsx': { default: gmailWidget },
  '../../../widgets/job-tracker/index.tsx': { default: jobTrackerWidget },
  // ...one entry per widget folder
}
```

The registry then loops over every entry, validates it (checks for a valid manifest and valid widget id), and adds it to a `Map<string, Widget>`.

### Platform filtering

Widgets can declare which platforms they support via `manifest.platforms`:

```ts
platforms: ['desktop']  // only show on Electron desktop
platforms: ['mobile']   // only show on Android
// (omit entirely) → show on both platforms
```

The registry reads a build-time flag `__MOBILE__` (set by Vite) to know the current platform and skips widgets that don't support it.

### Exported functions

```ts
listWidgets()           // returns all valid widgets, sorted alphabetically by name
getWidget(id)           // returns the Widget for a given id, or undefined
defaultSettingsFor(manifest) // extracts default values from a manifest's settings array
```

---

## `api.ts` — The WidgetApi Factory

Every widget receives an `api` object as a prop. This `api` is created by `createWidgetApi(widgetId, instanceId)` inside `WidgetHost.tsx`. The factory's job is to:

1. **Pre-fill the `widgetId`** — so widgets don't have to pass their own ID to every storage call
2. **Scope KV keys to the instance** — so two instances of the same widget don't overwrite each other's data
3. **Provide a clean, simple interface** — instead of `window.cc.kv.set(widgetId, key, value)`, widgets just write `api.kv.set(key, value)`

### Instance scoping for KV

Each widget instance has a unique `instanceId` (a random 10-character string like `aB3xQ7mN2p`). The `api.kv` methods automatically prepend `instanceId::` to every key before calling `window.cc.kv`:

```ts
// Widget code writes:
api.kv.set('lastRun', Date.now())

// Which actually calls:
window.cc.kv.set('job-tracker', 'aB3xQ7mN2p::lastRun', Date.now())
```

This means two instances of `job-tracker` each get their own private KV namespace, even though they share the same underlying `store.json` file.

### SQL is widget-scoped, not instance-scoped

`api.sql` calls pass only the `widgetId`, not the `instanceId`. This means all instances of the same widget share one SQLite database. If you add two `job-tracker` widgets, they both read from and write to the same `job-tracker/data.db`. Widgets that want instance isolation in SQL need to add an `instanceId` column to their tables and filter by it.

### The `google.shared` namespace

Google OAuth credentials can be shared across all widgets using `api.google.shared`. When a widget authenticates via `api.google.shared.connect(...)`, the credentials are stored under the `'google'` widget ID instead of the widget's own ID. Any other widget using `api.google.shared` will then pick up those same credentials — the user only has to log in to Google once.

### Network call tracking

`api.net.fetch` is a thin wrapper around `window.cc.net.fetch` that also calls `emitApiCall(...)` after each request. This emits an event with the URL, method, status code, and duration — the `api-tracker` widget listens for these events and displays them as a history of recent network calls.

---

## `apiEvents.ts` — API Call Event Bus

A minimal publish/subscribe event bus used specifically for `api.net.fetch` telemetry.

```ts
// Emit an event
emitApiCall({ widgetId, url, method, status, duration, ok, timestamp });

// Subscribe to events
const unsub = onApiCall((event) => console.log(event));
// Call unsub() when done to avoid memory leaks
```

The api-tracker widget subscribes to these events to show a live feed of what network calls each widget is making.

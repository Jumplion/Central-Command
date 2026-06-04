# React Guide — From Basics to Advanced

This guide teaches React using real code from this project (Central Command) as examples. No prior React knowledge is assumed, but basic JavaScript/TypeScript familiarity helps.

Every code block is taken directly from a file in this repo. Line references are given so you can open the file and read the surrounding context.

---

## Table of Contents

1. [What is React?](#1-what-is-react)
2. [Components](#2-components)
3. [JSX](#3-jsx)
4. [Props](#4-props)
5. [State — `useState`](#5-state--usestate)
6. [Event Handlers](#6-event-handlers)
7. [Conditional Rendering](#7-conditional-rendering)
8. [Lists and Keys](#8-lists-and-keys)
9. [Side Effects — `useEffect`](#9-side-effects--useeffect)
10. [Refs — `useRef`](#10-refs--useref)
11. [Custom Hooks](#11-custom-hooks)
12. [Memoization — `useMemo`, `useCallback`, `React.memo`](#12-memoization--usememo-usecallback-reactmemo)
13. [Component Composition and `children`](#13-component-composition-and-children)
14. [Class Components and Error Boundaries](#14-class-components-and-error-boundaries)
15. [Global State — Zustand](#15-global-state--zustand)
16. [TypeScript and React](#16-typescript-and-react)
17. [Putting It All Together — The Widget Pattern](#17-putting-it-all-together--the-widget-pattern)

---

## 1. What is React?

React is a JavaScript library for building user interfaces. The central idea is simple: **your UI is a function of your data**. You describe what the screen should look like given the current state, and React takes care of updating the DOM to match.

In this project every visible panel — the sidebar, each widget card, the settings drawer — is a React component. The renderer process (`src/renderer/`) is a React app. The main process (`src/main/`) is plain Node.js and never touches React.

```
src/
  renderer/    ← React app (browser sandbox)
  main/        ← Electron Node process (no React)
  preload/     ← bridge between the two
  widgets/     ← each widget is a self-contained React component
  shared/      ← TypeScript types and utilities used by both sides
```

---

## 2. Components

A **component** is a function that returns JSX (covered next). It is the fundamental building block of a React UI.

Here is the simplest possible component:

```tsx
function Hello() {
  return <div>Hello, world!</div>;
}
```

A real example from this project — a small helper component inside `Dashboard.tsx`:

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 20–43)

function ResizeHint({
  w,
  h,
  manifest,
}: {
  w: number;
  h: number;
  manifest?: WidgetManifest;
}) {
  const isGoodFit =
    manifest?.defaultSize != null &&
    w === manifest.defaultSize.w &&
    h === manifest.defaultSize.h;

  return (
    <div className={`resize-hint${isGoodFit ? " resize-hint--good-fit" : ""}`}>
      {isGoodFit && <span className="resize-hint__check">✓</span>}
      <span>
        {w} × {h}
      </span>
      {isGoodFit && <span className="resize-hint__label">Recommended</span>}
    </div>
  );
}
```

**What to notice:**
- It is a plain JavaScript function — no class, no decorator, no special registration.
- Its argument is destructured immediately: `{ w, h, manifest }`.
- It returns what looks like HTML — that is JSX (next section).
- Component names must start with a capital letter (`ResizeHint`, not `resizeHint`).
- A component must return one root element (or a Fragment `<>...</>`).

---

## 3. JSX

JSX is the syntax that lets you write HTML-like markup inside JavaScript. It compiles to plain `React.createElement(...)` calls before the browser ever sees it.

```tsx
// This JSX:
<div className="widget">
  <span>{title}</span>
</div>

// Compiles to this JavaScript:
React.createElement("div", { className: "widget" },
  React.createElement("span", null, title)
)
```

You never write the `React.createElement` form by hand.

### Key JSX rules

**`className` instead of `class`**

Because JSX is JavaScript, `class` is a reserved word:

```tsx
<div className="widget-header">
```

**Embed expressions with `{}`**

Any JavaScript expression goes inside curly braces:

```tsx
// src/renderer/src/components/WidgetHost.tsx (line 93)
<span className="widget-title">{title}</span>
```

```tsx
// Dimension display from Dashboard.tsx (line 38)
<span>{w} × {h}</span>
```

**Self-closing tags need `/>` **

```tsx
<input value={filter} onChange={(e) => setFilter(e.target.value)} />
```

**Return a single root element**

Wrap siblings in a Fragment when you need to return more than one element:

```tsx
<>
  <input ... />
  <button ... />
</>
```

Fragments render nothing in the DOM — they exist solely to satisfy the single-root requirement.

---

## 4. Props

**Props** (short for "properties") are how you pass data into a component — like arguments to a function. Props are read-only: a component never modifies its own props.

### Defining a component that accepts props

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 5–9)

interface Props {
  onClose: () => void;
}

export function AddWidgetDialog({ onClose }: Props) {
  // ...
}
```

`Props` is a TypeScript interface describing what the caller must supply. `onClose` is a function — this is how a child communicates back to its parent without touching parent state directly.

### Passing props

```tsx
// src/renderer/src/App.tsx (line 50)
{showPalette && <WidgetPalette onClose={() => setShowPalette(false)} />}
```

`App` owns `showPalette` and passes a function to reset it. `WidgetPalette` calls `onClose()` when dismissed, but never touches `showPalette` directly.

### Optional props

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 22–27)
function ResizeHint({
  w,
  h,
  manifest,      // optional — the ? makes it optional in TypeScript
}: {
  w: number;
  h: number;
  manifest?: WidgetManifest;
}) {
```

### Props for every widget — `WidgetProps`

Every widget component receives the same three props:

```tsx
// src/renderer/src/plugins/registry.ts
export interface WidgetProps {
  api: WidgetApi;                              // storage, network, secrets, etc.
  settings: WidgetSettings;                   // per-instance config values
  setTitle: (title: string | undefined) => void; // override the widget's header text
}
```

---

## 5. State — `useState`

State is data that belongs to a component and can change over time. When state changes, React re-renders the component with the new value.

```tsx
const [value, setValue] = useState(initialValue);
//     ^        ^
//     current  setter function
```

### Simple string state

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (line 12)
const [filter, setFilter] = useState("");
```

`filter` starts as `""`. Calling `setFilter("hello")` schedules a re-render with `filter === "hello"`.

### Multiple state variables

```tsx
// src/widgets/example-widget/index.tsx (lines 144–150)
const [notes, setNotes]           = useState<Note[]>([]);
const [draft, setDraft]           = useState("");
const [fetching, setFetching]     = useState(false);
const [fetchError, setFetchError] = useState<string | null>(null);
const [authorName, setAuthorName] = useState("");
```

Each `useState` call manages one independent piece. Hooks must always be called at the top level — never inside loops, conditions, or nested functions — because React identifies them by their call order.

### Boolean state and toggling

```tsx
// src/renderer/src/components/WidgetHost.tsx (line 32)
const [showSettings, setShowSettings] = useState(false);

// Toggle using the functional updater form — reads the current value, not a stale closure:
onClick={() => setShowSettings((s) => !s)
```

Use the functional form `(prev) => next` whenever the next value depends on the previous one.

### Complex state

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 52–56)
const [resizingItem, setResizingItem] = useState<{
  id: string;
  w: number;
  h: number;
} | null>(null);
```

React compares state by reference. Always create a new object rather than mutating in place:

```tsx
// Good — new object reference triggers a re-render
setResizingItem({ id: "abc", w: 3, h: 2 });

// Bad — mutating silently; React cannot see the change
resizingItem.w = 3;
```

---

## 6. Event Handlers

React event names are camelCase. Handlers are passed as JSX attributes.

### `onClick`

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (line 47)
<button className="ghost" onClick={onClose} aria-label="Close">
  ✕
</button>
```

Pass the function reference (`onClick={onClose}`), not a call (`onClick={onClose()}`). The `()` version would execute immediately during render.

### `onChange` — controlled inputs

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 52–58)
<input
  placeholder="Search widgets…"
  value={filter}
  onChange={(e) => setFilter(e.target.value)}
/>
```

`value={filter}` and `onChange` together make this a **controlled input**: the displayed text always matches the `filter` state. The input never has its own internal value.

### `onKeyDown`

```tsx
// src/widgets/example-widget/index.tsx (lines 355–360)
onKeyDown={(e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    void addNote(draft);
  }
}}
```

`e.preventDefault()` stops the browser inserting a newline. The `void` before `addNote(draft)` discards the returned `Promise` (since `addNote` is async).

### Stopping event propagation

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 38–42)
<div className="modal-backdrop" onClick={onClose} role="presentation">
  <div
    className="modal"
    onClick={(e) => e.stopPropagation()}  // Don't let clicks inside the modal close it
  >
```

Without `stopPropagation`, a click anywhere inside the modal would bubble up to the backdrop and call `onClose`.

### Async event handlers

```tsx
// src/widgets/example-widget/index.tsx (line 376)
<button onClick={() => void addNote(draft)}>
```

`addNote` is `async`. The `void` tells TypeScript "I know this is async and I'm intentionally not awaiting it in this inline handler."

---

## 7. Conditional Rendering

React has no special template syntax for conditionals — you use JavaScript.

### `&&` short-circuit

```tsx
// src/widgets/example-widget/index.tsx (lines 422–434)
{pinnedNotes.length > 0 && (
  <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
    Pinned
  </div>
)}
```

When the left side is `false`, nothing renders. When `true`, the element renders.

> **Pitfall:** Never put a number on the left of `&&` in JSX. `0 && <Foo />` renders the text `"0"`.  
> Fix: `count > 0 && <Foo />` or `Boolean(count) && <Foo />`.

### Ternary: either/or

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 60–99)
{widgets.length === 0 ? (
  <div className="empty">
    <p>No widgets installed.</p>
  </div>
) : (
  <ul className="widget-list">
    {filtered.map((w) => ( /* ... */ ))}
  </ul>
)}
```

### Early return for loading/error states

```tsx
// src/renderer/src/App.tsx (lines 37–39)
if (!loaded) {
  return <div className="loading">Loading…</div>;
}

// Main render only runs once loaded is true:
return (
  <div className="app">
    <Sidebar ... />
    ...
  </div>
);
```

Early returns are the cleanest pattern for loading states. Everything after the guard can assume the data is present.

### Conditional CSS classes

```tsx
// src/renderer/src/components/Dashboard.tsx (line 35)
<div className={`resize-hint${isGoodFit ? " resize-hint--good-fit" : ""}`}>
```

---

## 8. Lists and Keys

Use `.map()` to render a list. Every item must have a unique, stable `key` prop. React uses keys to track which items were added, removed, or reordered.

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 74–90)
<ul className="widget-list">
  {filtered.map((w) => (
    <li key={w.manifest.id}>
      <div className="widget-meta">
        <span className="widget-icon">{w.manifest.icon ?? "◻"}</span>
        <div>
          <strong>{w.manifest.name}</strong>
          {w.manifest.description && <p>{w.manifest.description}</p>}
          <small>
            v{w.manifest.version} · <code>{w.manifest.id}</code>
          </small>
        </div>
      </div>
      <button className="primary" onClick={() => add(w.manifest.id)}>
        Add
      </button>
    </li>
  ))}
</ul>
```

**Key rules:**
- Use stable, natural IDs (`w.manifest.id`) — not array indexes.
- Array indexes as keys cause incorrect animations and stale state when items are removed or reordered.
- Keys must be unique among siblings in the same list; they don't need to be globally unique.
- The child component cannot read its own `key`.

### Empty state inside a list

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 91–97)
{filtered.length === 0 && (
  <li>
    <em style={{ color: "var(--text-dim)" }}>
      No widgets match "{filter}".
    </em>
  </li>
)}
```

---

## 9. Side Effects — `useEffect`

A **side effect** is anything that reaches outside the component: fetching data, subscribing to events, writing to storage, starting a timer, measuring the DOM. `useEffect` is where these belong.

```tsx
useEffect(() => {
  // effect code here

  return () => {
    // cleanup code (optional)
  };
}, [dep1, dep2]); // dependency array
```

### Dependency array

| Array form  | Effect runs when                                       |
| ----------- | ------------------------------------------------------ |
| `[]`        | Once, after the first render                           |
| `[a, b]`    | After first render, and whenever `a` or `b` changes    |
| *(omitted)* | After every render — almost never what you want        |

### Load data once on mount

```tsx
// src/renderer/src/App.tsx (lines 14–16)
useEffect(() => {
  void load();
}, [load]);
```

`load` comes from Zustand (it never changes), so this runs exactly once.

### Effect with cleanup — event listener

```tsx
// src/renderer/src/App.tsx (lines 26–35)
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setShowPalette((v) => !v);
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown); // cleanup
}, []);
```

The returned function runs when the component unmounts (or before the effect re-runs). Without the cleanup, each re-render would add another listener.

### Effect with cleanup — observer and animation frame

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 60–81)
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  let rafId: number | null = null;
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const w = e.contentRect.width;
      if (w > 0) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          setWidth(w);
        });
      }
    }
  });
  ro.observe(el);
  return () => {
    ro.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}, []);
```

Both the `ResizeObserver` and any pending animation frame are cleaned up. The empty `[]` dependency array means this runs once.

### Effect that tracks mount/unmount duration

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 48–56)
useEffect(() => {
  if (!widget) return;
  mountedAtRef.current = Date.now();
  emitWidgetMount(instance.instanceId, instance.widgetId);
  return () => {
    const durationMs = Date.now() - mountedAtRef.current;
    emitWidgetUnmount(instance.instanceId, instance.widgetId, durationMs);
  };
}, [instance.instanceId, instance.widgetId, widget]);
```

The cleanup function here is also the "unmount" handler — it measures how long the widget was visible.

### Effect that re-runs on state change

```tsx
// src/widgets/example-widget/index.tsx (lines 193–195)
useEffect(() => {
  if (ready) void loadNotes();
}, [ready, loadNotes]);
```

Re-fires whenever `ready` or `loadNotes` changes. The `if (ready)` guard prevents querying before the database is initialized.

### Async effects

`useEffect` cannot be marked `async`. The pattern is an inner async function:

```tsx
useEffect(() => {
  const run = async () => {
    const data = await someAsyncCall();
    setState(data);
  };
  void run();
}, []);
```

---

## 10. Refs — `useRef`

`useRef` gives you a mutable container that persists across renders without triggering re-renders when changed. It has two main uses.

### 1. Accessing DOM elements

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 49, 76–80)
const containerRef = useRef<HTMLDivElement>(null);

// Attach to an element:
<div ref={containerRef}>

// Read the DOM node later (inside an effect):
const el = containerRef.current; // HTMLDivElement | null
ro.observe(el);
```

`ref.current` is always `null` until the component mounts. Check for `null` before use.

### 2. Mutable values that don't need to trigger re-renders

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 46–54)
const mountedAtRef = useRef<number>(0);

// Write directly — no setter, no re-render:
mountedAtRef.current = Date.now();

// Read in the cleanup:
const durationMs = Date.now() - mountedAtRef.current;
```

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 57–58)
const layoutHistoryRef = useRef<LayoutSnapshot[]>([]);
const layoutFutureRef  = useRef<LayoutSnapshot[]>([]);
```

These store the undo/redo stacks. They must persist between renders, but changing them should not cause a re-render — `useRef` is the right choice.

### `useState` vs `useRef`

| Question                           | Use         |
| ---------------------------------- | ----------- |
| Changing this should update the UI | `useState`  |
| Changing this should NOT update UI | `useRef`    |

---

## 11. Custom Hooks

A **custom hook** is a function whose name starts with `use` that calls other hooks internally. Custom hooks let you extract and reuse stateful logic across components.

### `useSqlInit` — async initialization hook

```tsx
// src/renderer/src/hooks/useSqlInit.ts (lines 10–37)

export function useSqlInit(
  api: WidgetApi,
  initSql: string,
  migrations?: SqlMigration[],
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      await api.sql.exec(initSql);         // Create tables (idempotent)
      if (migrations?.length) {
        for (const m of migrations) {
          const cols = await api.sql.all<{ name: string }>(
            `PRAGMA table_info(${m.table})`,
          );
          if (!cols.find((c) => c.name === m.column)) {
            await api.sql.run(m.sql, []);  // Apply missing column migration
          }
        }
      }
      setReady(true);                      // Signal that the DB is ready
    };
    void run();
  }, []);

  return ready;
}
```

This hook encapsulates a complex sequence — create tables, detect missing columns, apply migrations — behind a single `ready: boolean`. Every widget that uses SQLite calls this hook once:

```tsx
// src/widgets/example-widget/index.tsx (line 166)
const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

useEffect(() => {
  if (ready) void loadNotes();
}, [ready, loadNotes]);
```

### `useGoogleConnection` — shared OAuth state

```tsx
// src/widgets/_shared/useGoogleConnection.ts

export function useGoogleConnection(
  api: WidgetApi,
): [boolean | null, (v: boolean | null) => void] {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.google.shared
      .isConnected()
      .then((c) => setConnected(c))
      .catch(() => setConnected(false));
  }, [api]);

  return [connected, setConnected];
}
```

Without this hook, every Google widget would repeat the same `useState` + `useEffect` pattern. The hook hides that setup:

```tsx
const [connected, setConnected] = useGoogleConnection(api);

if (connected === null) return <WidgetLoading />;
if (!connected) return <NotConnected onConnect={handleConnect} />;
```

### Rules of hooks

1. Only call hooks **at the top level** of a component or custom hook — never inside `if`, loops, or nested functions.
2. Only call hooks **inside React function components or custom hooks**.

React identifies hooks by their call order across renders. Violating these rules produces subtle, hard-to-debug bugs.

---

## 12. Memoization — `useMemo`, `useCallback`, `React.memo`

React re-renders a component whenever its parent re-renders. For expensive computations or components with stable props, you can opt into caching.

> **Don't reach for memoization by default.** It adds complexity and has its own overhead. Use it when you have a measurable problem, or when a value appears in a dependency array and needs a stable identity.

### `useMemo` — cache a computed value

```tsx
// src/renderer/src/components/AddWidgetDialog.tsx (lines 14–23)
const filtered = useMemo(() => {
  const q = filter.trim().toLowerCase();
  if (!q) return widgets;
  return widgets.filter(
    (w) =>
      w.manifest.name.toLowerCase().includes(q) ||
      w.manifest.id.toLowerCase().includes(q) ||
      (w.manifest.description?.toLowerCase().includes(q) ?? false),
  );
}, [widgets, filter]);
```

`filtered` is recomputed only when `widgets` or `filter` changes. Without `useMemo`, the filter would run on every render, even on unrelated state changes.

```tsx
// src/renderer/src/components/Dashboard.tsx (lines 83–91)
const widgetMap = useMemo(() => {
  const map = new Map<string, ReturnType<typeof getWidget> | undefined>();
  for (const instance of dashboard.instances) {
    if (!map.has(instance.widgetId)) {
      map.set(instance.widgetId, getWidget(instance.widgetId));
    }
  }
  return map;
}, [dashboard.instances]);
```

Building a `Map` from an array is O(n) on every render; `useMemo` makes it O(n) only when `instances` changes.

### `useCallback` — cache a function

```tsx
// src/widgets/example-widget/index.tsx (lines 183–190)
const loadNotes = useCallback(async () => {
  const dir = sortNewest ? "DESC" : "ASC";
  const rows = await api.sql.all<Note>(
    `SELECT * FROM notes ORDER BY pinned DESC, created_at ${dir} LIMIT ?`,
    [maxNotes],
  );
  setNotes(rows);
}, [api, sortNewest, maxNotes]);
```

`loadNotes` only gets a new function identity when one of its dependencies changes. This matters because it appears in a `useEffect` dependency array:

```tsx
useEffect(() => {
  if (ready) void loadNotes();
}, [ready, loadNotes]);
```

If `loadNotes` had a new identity on every render, the effect would loop forever.

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 39–44)
const handleSetTitle = useCallback(
  (title: string | undefined) => {
    setTitle(instance.instanceId, title);
  },
  [instance.instanceId, setTitle],
);
```

Passing a stable `handleSetTitle` reference prevents the child widget from re-rendering just because the parent re-rendered.

### `React.memo` — skip re-rendering a component

```tsx
// src/renderer/src/components/WidgetHost.tsx (line 26)
export const WidgetHost = memo(function WidgetHost({ instance, widget }: Props) {
  // ...
});
```

`memo` wraps a component. React skips re-rendering it when its props are shallowly equal. Since `WidgetHost` is rendered for every widget on the dashboard, avoiding unnecessary re-renders matters.

---

## 13. Component Composition and `children`

React components can accept other components or JSX as content through the `children` prop. This is how you build composable layout shells.

### Passing children

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 115–123)

<div className="widget-body">
  <ErrorBoundary widgetName={widget.manifest.name}>
    <Component
      api={api}
      settings={instance.settings}
      setTitle={handleSetTitle}
    />
  </ErrorBoundary>
</div>
```

`ErrorBoundary` wraps `<Component />` as its children. When nothing goes wrong, it renders them transparently. When the widget crashes, it renders a fallback instead.

### Receiving children

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 135–138)
interface BoundaryProps {
  widgetName: string;
  children: ReactNode;   // ReactNode: any valid React content
}
```

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 154–163)
render() {
  if (this.state.error) {
    return (
      <div className="widget-error">
        <strong>Widget crashed.</strong>
        <pre>{this.state.error.message}</pre>
      </div>
    );
  }
  return this.props.children;  // Render children normally
}
```

### Sub-components inside a file

Breaking a complex UI into sub-components keeps each piece readable. The `example-widget` defines `NoteRow` as a small component within the same file:

```tsx
// src/widgets/example-widget/index.tsx (lines 61–123)

function NoteRow({
  note,
  showDate,
  onPin,
  onDelete,
}: {
  note: Note;
  showDate: boolean;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ /* ... */ }}>
      <div style={{ flex: 1, fontSize: 12 }}>{note.body}</div>
      <button onClick={onPin} title={note.pinned ? "Unpin" : "Pin to top"}>📌</button>
      <button onClick={onDelete} title="Delete note">✕</button>
    </div>
  );
}
```

`NoteRow` knows nothing about SQL — it receives data and calls callbacks. The parent owns the data and handlers. This separation makes each piece easy to test and reason about.

### Shared component library — `src/widgets/_shared/`

Components and style utilities shared across many widgets:

```tsx
import {
  TabBar,
  LineChart,
  WidgetLoading,
  NotConnected,
} from "../_shared";
import { buttonDefault, inputBase, dimText } from "../_shared/styles";
```

`TabBar` is a pure presentational component — it renders a tab bar and fires `onSelect`, but has no idea what the tabs represent:

```tsx
<TabBar
  tabs={[
    { id: "list", label: "List" },
    { id: "charts", label: "Charts" },
  ]}
  active={activeTab}
  onSelect={(id) => setActiveTab(id as "list" | "charts")}
/>
```

---

## 14. Class Components and Error Boundaries

Function components with hooks cover almost every use case in modern React. The one exception is **error boundaries** — components that catch rendering errors in their subtree. Only class components can implement them.

### Implementation

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 143–165)

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  // Called when a descendant throws during render.
  // Returns the new state that causes the fallback UI to show.
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  // Called after the fallback renders — use for logging.
  componentDidCatch(error: Error): void {
    console.error(`[widget:${this.props.widgetName}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="widget-error">
          <strong>Widget crashed.</strong>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Why per-widget error boundaries matter

Every widget runs inside its own `<ErrorBoundary>`. If a widget throws an unhandled error during rendering, React unwinds to the nearest error boundary, catches the error, and re-renders just that boundary — showing the crash message instead of the widget. The rest of the dashboard keeps working normally.

```tsx
// One boundary per widget in WidgetHost:
<ErrorBoundary widgetName={widget.manifest.name}>
  <Component api={api} settings={instance.settings} setTitle={handleSetTitle} />
</ErrorBoundary>
```

### What error boundaries do NOT catch

- Errors in event handlers (use `try/catch` there)
- Errors in async functions (use `.catch()` or `try/catch`)
- Errors inside the error boundary itself

---

## 15. Global State — Zustand

Local component state (`useState`) only lives inside one component. When many unrelated components need to share the same data — without threading it through props — this project uses **Zustand**, a minimal global state library.

### Defining the store

```tsx
// src/renderer/src/state/dashboard.ts (lines 116–135)
import { create } from "zustand";

export const useDashboard = create<DashboardStore>((set, get) => {
  function mutate(updater: (s: AppState) => AppState): void {
    set((store) => ({ state: updater(store.state) }));
    get().persist();   // debounced write to disk
  }

  return {
    loaded: false,
    state: DEFAULT_STATE,

    async load() {
      const s = await window.cc.state.load();
      const normalized = normalizeState(s);
      set({ state: normalized, loaded: true });
    },

    persist() {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        void window.cc.state.save(get().state);
      }, 150);
    },

    // ... more actions
  };
});
```

`create<DashboardStore>(...)` returns a React hook (`useDashboard`). `set` updates the store; `get` reads it synchronously from outside React.

### Reading from the store with selectors

```tsx
// src/renderer/src/App.tsx (lines 8–10)
const load             = useDashboard((s) => s.load);
const loaded           = useDashboard((s) => s.loaded);
const applyRemoteState = useDashboard((s) => s.applyRemoteState);
```

The argument to `useDashboard` is a **selector** — a function that picks the slice of store you care about. The component only re-renders when that slice changes. Selecting the entire store would cause re-renders on every unrelated state change.

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 30–31)
const removeInstance = useDashboard((s) => s.removeInstance);
const setTitle       = useDashboard((s) => s.setTitle);
```

### Calling actions

```tsx
// Call an action the same way as any other function:
removeInstance(instance.instanceId);
```

Actions call `set(...)` internally, which triggers re-renders in all subscribed selectors.

### Zustand vs `useState`

| Question                                  | Answer        |
| ----------------------------------------- | ------------- |
| Data used by a single component           | `useState`    |
| Data shared across many components        | Zustand store |
| Data that needs to be persisted to disk   | Zustand store (with persist action) |

---

## 16. TypeScript and React

TypeScript adds static types to JavaScript. In React, this catches prop mismatches and incorrect state shapes at compile time.

### Typing props

```tsx
// src/renderer/src/components/WidgetHost.tsx (lines 21–24)
interface Props {
  instance: WidgetInstance;
  widget: Widget | undefined;   // union — may or may not be installed
}

export const WidgetHost = memo(function WidgetHost({ instance, widget }: Props) {
```

### Typing state generics

TypeScript infers the type from the initial value when possible. Provide it explicitly for empty arrays and nullable values:

```tsx
const [notes, setNotes]   = useState<Note[]>([]);
const [error, setError]   = useState<string | null>(null);
const [item, setItem]     = useState<SomeType | null>(null);
```

### Typing refs

```tsx
const containerRef = useRef<HTMLDivElement>(null);   // DOM element
const mountedAtRef = useRef<number>(0);              // Mutable value
```

### Typing custom hook return values

When a hook returns a tuple, TypeScript needs an explicit type or `as const` to avoid inferring a broader union:

```tsx
// src/widgets/_shared/useGoogleConnection.ts
export function useGoogleConnection(
  api: WidgetApi,
): [boolean | null, (v: boolean | null) => void] {
  //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //  Explicitly typed as a 2-tuple
```

### `ReactNode` — the type for `children`

```tsx
import type { ReactNode } from "react";

interface BoundaryProps {
  children: ReactNode;   // accepts JSX, strings, arrays, null, undefined, false
}
```

### `ComponentType<P>` — a component stored in a variable

The widget registry stores each widget's component as a `ComponentType`:

```tsx
// src/renderer/src/plugins/registry.ts
import type { ComponentType } from "react";

export interface Widget {
  manifest: WidgetManifest;
  Component: ComponentType<WidgetProps>;
}
```

`ComponentType<P>` means "any React component (function or class) that accepts props of type `P`."

---

## 17. Putting It All Together — The Widget Pattern

Every widget in this project follows the same structure. Understanding it ties together all the concepts above. `src/widgets/example-widget/index.tsx` is a fully-annotated reference implementation — read it alongside this guide.

### Minimal widget shape

```tsx
// src/widgets/example-widget/index.tsx (lines 525–578)

const widget: Widget = {
  manifest: {
    id: "example-widget",       // Must equal the folder name exactly
    name: "Example Widget",
    description: "...",
    version: "0.1.0",
    icon: "📓",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
    permissions: { sqlite: true },
    settings: [ /* field definitions */ ],
  },
  Component: ExampleWidget,
};

export default widget;
```

The registry (`src/renderer/src/plugins/registry.ts`) discovers this file automatically at build time via `import.meta.glob` — no manual registration needed.

### Widget component lifecycle

```tsx
function ExampleWidget({ api, settings, setTitle }: WidgetProps) {
  // 1. Read settings (passed fresh every render — no need to cache in state)
  const maxNotes = Number(settings.maxNotes ?? 50);
  const showDates = settings.showDates !== false;

  // 2. Declare component state
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");

  // 3. Initialize the database — returns true when the schema is ready
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  // 4. Stable data-loading callback (useCallback so the effect below doesn't loop)
  const loadNotes = useCallback(async () => {
    const rows = await api.sql.all<Note>(
      `SELECT * FROM notes ORDER BY pinned DESC, created_at DESC LIMIT ?`,
      [maxNotes],
    );
    setNotes(rows);
  }, [api, maxNotes]);

  // 5. Load data when ready; reload when sort/limit settings change
  useEffect(() => {
    if (ready) void loadNotes();
  }, [ready, loadNotes]);

  // 6. Dynamic header title
  useEffect(() => {
    setTitle(notes.length > 0 ? `Notes (${notes.length})` : "Notes");
  }, [notes.length, setTitle]);

  // 7. Guard — don't render SQL-dependent UI until the DB is ready
  if (!ready) return <div style={{ padding: 12 }}>Setting up database…</div>;

  // 8. Render using data
  return (
    <div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => void addNote(draft)}>Add</button>

      {notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          showDate={showDates}
          onPin={() => void togglePin(note)}
          onDelete={() => void deleteNote(note.id)}
        />
      ))}
    </div>
  );
}
```

### Concept map

| React concept         | Where it appears in the widget pattern                     |
| --------------------- | ---------------------------------------------------------- |
| Function component    | `function ExampleWidget({ api, settings, setTitle })`      |
| Props                 | `api`, `settings`, `setTitle` are passed by `WidgetHost`   |
| `useState`            | `notes`, `draft`, and other local state                    |
| `useEffect` (load)    | Load data when `ready` becomes `true`                      |
| `useEffect` (derived) | Update the header title when `notes.length` changes        |
| `useCallback`         | `loadNotes` — stable identity so the effect doesn't loop   |
| Custom hook           | `useSqlInit` — hides DB init behind a boolean              |
| Early return          | Guard against rendering before the DB is ready             |
| Lists and keys        | `notes.map((note) => <NoteRow key={note.id} .../>)`        |
| Sub-components        | `NoteRow` — focused, receives data and callbacks via props |
| Error boundary        | Provided by `WidgetHost` — the widget doesn't manage it    |
| Global state (Zustand)| `WidgetHost` reads `removeInstance`, `setTitle` from store |

### The full data flow

```
manifest.settings schema
        ↓
WidgetSettingsPanel (user edits) → AppState → Zustand store
        ↓
WidgetHost reads settings from store, passes as prop each render
        ↓
Widget reads settings → derives state → runs effects
        ↓
Effects call api.sql / api.kv / api.net (IPC → Electron main process)
        ↓
Async results flow back via setState → re-render → updated UI
```

---

## Further Reading

| Topic                      | Location                                        |
| -------------------------- | ----------------------------------------------- |
| Widget authoring guide     | `src/widgets/README.md`                         |
| SQL schema pattern         | `src/renderer/src/hooks/SCHEMA_PATTERN.md`      |
| WidgetApi surface          | `src/renderer/src/plugins/api.ts`               |
| Shared component catalogue | `src/widgets/_shared/`                          |
| Architecture overview      | `CLAUDE.md`                                     |
| Official React docs        | https://react.dev                               |
| Zustand docs               | https://zustand.docs.pmnd.rs                    |
| TypeScript handbook        | https://typescriptlang.org/docs                 |

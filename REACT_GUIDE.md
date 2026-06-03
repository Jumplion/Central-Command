# React Guide — From Basics to Advanced

This guide teaches React using real code from this project (Central Command) as examples. No prior React knowledge is assumed, but basic JavaScript/TypeScript familiarity helps.

---

## Table of Contents

1. [What is React?](#1-what-is-react)
2. [Components](#2-components)
3. [JSX](#3-jsx)
4. [Props](#4-props)
5. [State — `useState`](#5-state--usestate)
6. [Side Effects — `useEffect`](#6-side-effects--useeffect)
7. [Event Handlers](#7-event-handlers)
8. [Conditional Rendering](#8-conditional-rendering)
9. [Lists and Keys](#9-lists-and-keys)
10. [Refs — `useRef`](#10-refs--useref)
11. [Custom Hooks](#11-custom-hooks)
12. [Performance — `useCallback` and `useMemo`](#12-performance--usecallback-and-usememo)
13. [Component Composition](#13-component-composition)
14. [Error Boundaries](#14-error-boundaries)
15. [TypeScript and React](#15-typescript-and-react)
16. [Global State — Zustand](#16-global-state--zustand)
17. [Putting It All Together — A Widget Walkthrough](#17-putting-it-all-together--a-widget-walkthrough)

---

## 1. What is React?

React is a JavaScript library for building user interfaces. The central idea is simple: **your UI is a function of your data**. You describe what the screen should look like given the current state, and React takes care of updating the DOM to match.

In this project every visible panel — the widget cards, the header, the settings drawer — is a React component. The renderer process (`src/renderer/`) is a React app; the main process (`src/main/`) is plain Node and never touches React.

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

A **component** is a function that returns JSX (covered next). It is the fundamental unit of a React UI — like a reusable building block.

Here is the simplest possible React component:

```tsx
function Hello() {
  return <div>Hello, world!</div>;
}
```

Every widget in this project is a component. The `QuickCopy` widget (`src/widgets/quick-copy/index.tsx`) looks like this at a high level:

```tsx
function QuickCopy({ api }: WidgetProps) {
  // ... state declarations
  // ... effects
  // ... event handlers

  return (
    <div style={{ /* ... */ }}>
      {/* ... JSX tree */}
    </div>
  );
}

export default {
  manifest: { id: "quick-copy", name: "Quick Copy", /* ... */ },
  Component: QuickCopy,
};
```

A few rules:
- Component names must start with a capital letter (`QuickCopy`, not `quickCopy`).
- A component must return one root element (or a Fragment: `<>...</>`).
- Components are composable — you place them inside other components like HTML tags.

---

## 3. JSX

JSX is the syntax that looks like HTML inside JavaScript. It is not actually HTML — it compiles to `React.createElement(...)` calls. Here are the key differences from HTML:

| HTML | JSX |
|------|-----|
| `class="..."` | `className="..."` |
| `for="..."` | `htmlFor="..."` |
| `style="color: red"` | `style={{ color: "red" }}` |
| Self-closing optional | Must close all tags: `<input />` |
| Comments `<!-- -->` | Comments `{/* */}` |

Curly braces `{}` let you embed any JavaScript expression inside JSX:

```tsx
const name = "Alice";
return <div>Hello, {name.toUpperCase()}!</div>;
```

From the `quick-copy` widget, this button uses a ternary expression inline:

```tsx
// src/widgets/quick-copy/index.tsx
<button onClick={() => setComposerOpen((open) => !open)}>
  {composerOpen ? "▾" : "▸"}
</button>
```

When `composerOpen` is `true` the button shows `▾`; when `false` it shows `▸`. The logic lives inside `{}`, right in the markup.

---

## 4. Props

**Props** (short for properties) are how you pass data into a component — like arguments to a function.

### Defining a component that accepts props

```tsx
interface GreetingProps {
  name: string;
  age?: number; // optional
}

function Greeting({ name, age }: GreetingProps) {
  return (
    <div>
      Hello, {name}! {age && <span>Age: {age}</span>}
    </div>
  );
}

// Usage:
<Greeting name="Alice" age={30} />
<Greeting name="Bob" />
```

### Props in this project — `WidgetProps`

Every widget receives the same three props, defined in `src/renderer/src/plugins/registry.ts`:

```tsx
// src/renderer/src/plugins/registry.ts
export interface WidgetProps {
  api: WidgetApi;       // access to storage, network, secrets, etc.
  settings: WidgetSettings; // per-instance config values
  setTitle: (title: string | undefined) => void; // update the widget's header title
}
```

A widget destructures whichever props it needs:

```tsx
// Uses only api:
function QuickCopy({ api }: WidgetProps) { /* ... */ }

// Uses all three:
function MediaTracker({ api, settings, setTitle }: WidgetProps) { /* ... */ }
```

`setTitle` in `MediaTracker` is called with a dynamic count so the header reflects how many items are actively being tracked:

```tsx
// src/widgets/media-tracker/index.tsx
setTitle(
  activeCount > 0 ? `Media Tracker (${activeCount} active)` : undefined,
);
```

### Props are read-only

A component must never mutate its own props. If you need to change a value, it must live in **state** (next section) and be passed down as a prop.

### Children

The special `children` prop lets you nest content between open and closing tags:

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

<Card>
  <h2>Title</h2>
  <p>Body text.</p>
</Card>
```

The `ErrorBoundary` component in this project uses `children` exactly this way — it wraps any widget and catches its errors (see [Error Boundaries](#14-error-boundaries)).

---

## 5. State — `useState`

State is data that belongs to a component and can change over time. When state changes, React re-renders the component and updates the UI.

### Basic usage

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

`useState(0)` returns a pair: the current value and a setter function. The naming convention is `[value, setValue]`.

### Initial value types

The initial value can be anything:

```tsx
const [text, setText] = useState("");                    // string
const [open, setOpen] = useState(false);                 // boolean
const [items, setItems] = useState<string[]>([]);        // array
const [selected, setSelected] = useState<number | null>(null); // nullable
```

### Multiple state variables

The `quick-copy` widget uses several pieces of state at once, each tracking a different concern:

```tsx
// src/widgets/quick-copy/index.tsx
const [entries, setEntries]         = useState<CopyEntry[]>([]);
const [draftTitle, setDraftTitle]   = useState("");
const [draftValue, setDraftValue]   = useState("");
const [composerOpen, setComposerOpen] = useState(true);
const [copiedId, setCopiedId]       = useState<string | null>(null);
const [error, setError]             = useState<string | null>(null);
```

Each `useState` call is independent. React tracks them by the order they are called, which is why hooks must always be called at the top level of a component — never inside loops, conditions, or nested functions.

### Functional updates

When new state depends on old state, pass a function instead of a value:

```tsx
// Toggle open/closed safely:
setComposerOpen((open) => !open);

// Clear the copied indicator only if it's still the same entry:
setTimeout(() => {
  setCopiedId((curr) => (curr === entry.id ? null : curr));
}, 1200);
```

This form guarantees you're working with the latest value, which matters when multiple updates can happen in quick succession.

---

## 6. Side Effects — `useEffect`

A **side effect** is anything that reaches outside the component: loading data, setting up a subscription, writing to storage, starting a timer. `useEffect` is where these belong.

### Basic structure

```tsx
import { useEffect } from "react";

useEffect(() => {
  // runs after every render (no dependency array)
}, [dep1, dep2]); // only re-run when dep1 or dep2 change
```

The dependency array `[]` controls *when* the effect re-runs:

| Dependency array | Effect runs when |
|---|---|
| Omitted | After every render |
| `[]` (empty) | Once, after the first render |
| `[a, b]` | After first render, and again any time `a` or `b` change |

### Loading data on mount

The `quick-copy` widget loads saved entries once when the component first mounts:

```tsx
// src/widgets/quick-copy/index.tsx
useEffect(() => {
  api.kv
    .get<CopyEntry[]>("entries")
    .then((saved) => {
      setEntries(saved ?? []);
    })
    .catch((e: unknown) => {
      setError((e as Error).message);
    });
}, [api]);
```

The empty dependency `[api]` means "run once; re-run only if `api` changes" (it never does, so effectively once).

### Async effects

`useEffect` cannot be an `async` function directly. The pattern is to define an async function inside and call it immediately:

```tsx
useEffect(() => {
  const run = async () => {
    const data = await someAsyncCall();
    setState(data);
  };
  void run(); // `void` suppresses the "floating promise" lint warning
}, []);
```

### Cleanup

Effects can return a cleanup function that runs before the next effect execution or when the component unmounts. This is critical for subscriptions, timers, and event listeners.

```tsx
// src/renderer/src/components/WidgetHost.tsx
useEffect(() => {
  if (!widget) return;
  mountedAtRef.current = Date.now();
  emitWidgetMount(instance.instanceId, instance.widgetId);

  // This function runs when the component unmounts:
  return () => {
    const durationMs = Date.now() - mountedAtRef.current;
    emitWidgetUnmount(instance.instanceId, instance.widgetId, durationMs);
  };
}, [instance.instanceId, instance.widgetId, widget]);
```

Without the cleanup, the `emitWidgetUnmount` would never be called when a widget is removed from the dashboard.

### The `useSqlInit` hook — effect in practice

`src/renderer/src/hooks/useSqlInit.ts` is a custom hook that wraps an effect to initialize a SQLite database table. Here's the full implementation:

```tsx
// src/renderer/src/hooks/useSqlInit.ts
export function useSqlInit(
  api: WidgetApi,
  initSql: string,
  migrations?: SqlMigration[],
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      await api.sql.exec(initSql);           // create tables if not exists
      if (migrations?.length) {
        for (const m of migrations) {
          const cols = await api.sql.all<{ name: string }>(
            `PRAGMA table_info(${m.table})`,
          );
          if (!cols.find((c) => c.name === m.column)) {
            await api.sql.run(m.sql, []);    // apply new column
          }
        }
      }
      setReady(true);                        // signal that the DB is ready
    };
    void run();
  }, []);

  return ready; // widgets wait for this before querying
}
```

Usage in a widget:

```tsx
const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
if (!ready) return <div>Loading…</div>;
// safe to query the DB from here
```

---

## 7. Event Handlers

React uses camelCase event prop names: `onClick`, `onChange`, `onSubmit`, `onKeyDown`, etc.

### Inline arrow functions

```tsx
<button onClick={() => setCount(count + 1)}>+</button>
```

### Handlers that take the event object

```tsx
<input
  value={draftTitle}
  onChange={(e) => setDraftTitle(e.target.value)}
  placeholder="Optional label"
/>
<textarea
  value={draftValue}
  onChange={(e) => setDraftValue(e.target.value)}
/>
```

Both from `src/widgets/quick-copy/index.tsx`. The `e.target.value` is the typed value of the input element.

### Named handler functions

For complex logic, extract handlers as named functions before the JSX:

```tsx
// src/widgets/file-shortcuts/index.tsx
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();            // stop the browser's default file-open behavior
  setDragging(false);
  const files = Array.from(e.dataTransfer.files) as ElectronFile[];
  const added = files
    .filter((f) => f.path)
    .map((f) => makeShortcut(f.path!, guessKind(f)));
  if (added.length > 0)
    persist([...shortcuts, ...added]).catch(console.error);
};

// Then used in JSX:
<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
```

Notice `e.preventDefault()` — this stops the default browser action (which would try to navigate to the dropped file).

### Drag-and-drop events

The `quick-copy` widget implements drag-to-reorder with three coordinated handlers:

```tsx
// src/widgets/quick-copy/index.tsx
onDragOver={(e) => {
  e.preventDefault();
  if (draggingId && draggingId !== entry.id)
    setDropTargetId(entry.id);
}}
onDragLeave={() => {
  if (dropTargetId === entry.id) setDropTargetId(null);
}}
onDrop={(e) => {
  e.preventDefault();
  if (!draggingId || draggingId === entry.id) return;
  void moveEntry(draggingId, entry.id).catch((err: unknown) => {
    setError((err as Error).message);
  });
  setDraggingId(null);
  setDropTargetId(null);
}}
```

State (`draggingId`, `dropTargetId`) tracks which card is being dragged and which slot it's hovering over, so the UI can show visual feedback during the drag.

---

## 8. Conditional Rendering

React has no special template syntax for conditionals — you use JavaScript.

### Ternary operator

```tsx
{isLoading ? <Spinner /> : <Content />}
```

From `quick-copy`, showing an empty state or the list:

```tsx
// src/widgets/quick-copy/index.tsx
{ordered.length === 0 ? (
  <div style={{ /* centeredEmptyState */ }}>
    Add entries above, then click any card to copy.
  </div>
) : (
  <div>
    {ordered.map((entry) => { /* ... */ })}
  </div>
)}
```

### `&&` for optional rendering

`condition && <Element />` renders `<Element />` only when the condition is truthy. Nothing is rendered when it's false.

```tsx
// Show "Drop to add" overlay only when dragging AND there are existing items:
{dragging && shortcuts.length > 0 && (
  <div style={{ /* overlay */ }}>Drop to add</div>
)}
```

> **Pitfall:** `0 && <Thing />` renders the number `0`, not nothing. Use `count > 0 && <Thing />` or `Boolean(count) && <Thing />` to avoid this.

### Early return

The cleanest way to handle a loading/error state is to return early from the component before the main JSX:

```tsx
// src/widgets/media-tracker/index.tsx
if (!ready)
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      Loading…
    </div>
  );

// Normal render continues here:
return <div>{ /* actual content */ }</div>;
```

The `api-tracker` widget uses the shared `WidgetLoading` component for the same pattern:

```tsx
// src/widgets/api-tracker/index.tsx
if (!ready) return <WidgetLoading />;
```

### Conditional styles

You can apply styles conditionally inline:

```tsx
// src/widgets/api-tracker/index.tsx
style={{
  fontWeight: 600,
  color: isOver500 ? "#ef4444" : isWarning ? "#f59e0b" : "var(--text)",
}}
```

---

## 9. Lists and Keys

To render a list, use JavaScript's `.map()` inside JSX. Each item **must** have a unique `key` prop — React uses it to efficiently update only the items that changed.

### Basic example

```tsx
const fruits = ["Apple", "Banana", "Cherry"];

return (
  <ul>
    {fruits.map((fruit) => (
      <li key={fruit}>{fruit}</li>
    ))}
  </ul>
);
```

### Using database IDs as keys

Database IDs make ideal keys because they're unique and stable. From `file-shortcuts`:

```tsx
// src/widgets/file-shortcuts/index.tsx
{shortcuts.map((s) => (
  <ShortcutRow
    key={s.id}
    shortcut={s}
    onOpen={handleOpen}
    onReveal={handleReveal}
    onRemove={handleRemove}
  />
))}
```

### Dynamic count badges with `.filter()` inside `.map()`

The `media-tracker` shows how many items match each filter tab — computed inline:

```tsx
// src/widgets/media-tracker/index.tsx
{STATUS_FILTERS.map((sf) => (
  <button
    key={sf.value}
    style={{ ...tabStyle, ...(statusFilter === sf.value ? tabOnStyle : {}) }}
    onClick={() => setStatusFilter(sf.value)}
  >
    {sf.label}
    {sf.value !== "all" && (
      <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>
        {items.filter((i) => i.status === sf.value).length}
      </span>
    )}
  </button>
))}
```

`STATUS_FILTERS` is a constant array of `{ value, label }` objects. The tab for the currently active filter gets extra styles via the spread `...(condition ? activeStyle : {})` pattern.

### Keys must be stable and unique

- **Good:** database row IDs, UUIDs, slugs.
- **Bad:** array index (causes bugs when items are reordered or removed).

---

## 10. Refs — `useRef`

`useRef` gives you a mutable box that persists across renders without causing re-renders when changed. It has two main uses.

### 1. DOM element references

Attach a ref to a JSX element with the `ref` prop to get direct access to the underlying DOM node:

```tsx
// src/widgets/file-shortcuts/index.tsx
const containerRef = useRef<HTMLDivElement>(null);

return (
  <div
    ref={containerRef}
    onDragLeave={(e) => {
      // Only clear dragging state if the cursor left the entire container,
      // not just moved between child elements:
      if (!containerRef.current?.contains(e.relatedTarget as Node))
        setDragging(false);
    }}
  >
```

`containerRef.current` is `null` until the element mounts, then points to the real `<div>`.

### 2. Storing mutable values without re-rendering

`WidgetHost.tsx` records when a widget mounted, but this timestamp shouldn't trigger a re-render when written — a ref is perfect:

```tsx
// src/renderer/src/components/WidgetHost.tsx
const mountedAtRef = useRef<number>(0);

useEffect(() => {
  mountedAtRef.current = Date.now(); // write — no re-render
  return () => {
    const durationMs = Date.now() - mountedAtRef.current; // read
    emitWidgetUnmount(instance.instanceId, instance.widgetId, durationMs);
  };
}, [/* ... */]);
```

### Scrolling to an element

The `media-tracker` stores refs to each card in an object keyed by ID, then programmatically scrolls to a specific item:

```tsx
// src/widgets/media-tracker/index.tsx
const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

// Storing the ref on each card:
<div ref={(el) => { cardRefs.current[item.id] = el; }}>

// Scrolling to a specific card:
const scrollToItem = useCallback((id: number) => {
  setTimeout(() => {
    cardRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 50);
}, []);
```

### Refs vs State

| | `useState` | `useRef` |
|---|---|---|
| Triggers re-render on change | Yes | No |
| Access | `value` | `ref.current` |
| Use for | UI data | DOM nodes, timers, counters |

---

## 11. Custom Hooks

A **custom hook** is a function whose name starts with `use` and that calls other hooks inside it. Custom hooks let you extract and reuse stateful logic across multiple components.

### Why custom hooks?

Suppose two widgets both need to check whether Google is connected. Without a custom hook, you'd copy-paste the `useState` + `useEffect` combo in each one. With a custom hook:

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

Usage:

```tsx
const [connected, setConnected] = useGoogleConnection(api);

if (connected === null) return <WidgetLoading />;
if (!connected) return <NotConnected onConnect={handleConnect} />;
// else render content
```

### `useSqlInit` — a hook with an effect and state

`src/renderer/src/hooks/useSqlInit.ts` wraps the "create DB tables and apply migrations" logic. Widgets call it as a single line instead of repeating the full setup:

```tsx
const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
```

Under the hood it:
1. Runs the `CREATE TABLE IF NOT EXISTS` SQL.
2. Loops through `MIGRATIONS` and applies any that haven't been applied yet.
3. Sets `ready = true` when done.

The widget only sees a boolean. The implementation detail is hidden inside the hook.

### Rules of hooks

These rules exist because React identifies hooks by their call order:

1. Only call hooks **at the top level** — never inside `if`, loops, or nested functions.
2. Only call hooks **inside React function components or other custom hooks** — never in plain JS functions.

Breaking these rules causes bugs that are hard to trace.

---

## 12. Performance — `useCallback` and `useMemo`

By default, React re-renders a component every time its state or props change, recreating functions and computed values from scratch. `useCallback` and `useMemo` let you cache these between renders.

> **Rule of thumb:** don't reach for these immediately. Profile first. Premature memoization adds noise without benefit. Use them when you have a measurable performance problem, or when a value is passed to a child component wrapped in `React.memo`.

### `useCallback` — memoize a function

```tsx
// src/widgets/media-tracker/index.tsx
const loadItems = useCallback(async () => {
  const [rows, hist, linkRows] = await Promise.all([
    api.sql.all<MediaItem>("SELECT * FROM media_items ORDER BY ..."),
    // ...
  ]);
  setItems(rows);
  setHistory(histMap);
  setLinks(linkMap);
  setTitle(activeCount > 0 ? `Media Tracker (${activeCount} active)` : undefined);
}, [api.sql, setTitle]);
```

`loadItems` is recreated only when `api.sql` or `setTitle` change — not on every render. This is especially valuable here because `loadItems` is passed to `useEffect` as a dependency:

```tsx
useEffect(() => {
  if (ready) void loadItems();
}, [ready, loadItems]);
```

If `loadItems` were redefined on every render, this effect would loop infinitely.

### `useMemo` — memoize a computed value

```tsx
// Derived list — only recomputed when `entries` changes:
const ordered = useMemo(() => entries, [entries]);
```

A more meaningful example is filtering a large list — without `useMemo`, the filter runs on every render even when the filter criteria haven't changed:

```tsx
const filtered = useMemo(() =>
  items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) ||
             item.author_creator?.toLowerCase().includes(q);
    }
    return true;
  }),
[items, statusFilter, typeFilter, search]);
```

### `useCallback` vs `useMemo`

```
useCallback(fn, deps)   ≡   useMemo(() => fn, deps)
```

They're the same mechanism. `useCallback` is syntactic sugar for memoizing a function specifically.

---

## 13. Component Composition

React encourages building UIs from small, focused components that you compose together.

### Sub-components inside a file

The `file-shortcuts` widget defines a `ShortcutRow` component inside the same file and uses it in the main component:

```tsx
// src/widgets/file-shortcuts/index.tsx
interface ShortcutRowProps {
  shortcut: Shortcut;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onRemove: (id: string) => void;
}

function ShortcutRow({ shortcut, onOpen, onReveal, onRemove }: ShortcutRowProps) {
  return (
    <div>
      <span onClick={() => onOpen(shortcut.path)}>{shortcut.label}</span>
      <button onClick={() => onReveal(shortcut.path)}>Reveal</button>
      <button onClick={() => onRemove(shortcut.id)}>Remove</button>
    </div>
  );
}

function FileShortcuts({ api }: WidgetProps) {
  // ...
  return (
    <div>
      {shortcuts.map((s) => (
        <ShortcutRow
          key={s.id}
          shortcut={s}
          onOpen={handleOpen}
          onReveal={handleReveal}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
```

`ShortcutRow` knows nothing about storage — it receives data via props and calls callbacks when the user interacts. `FileShortcuts` owns the data and handlers. This separation of concerns makes each piece easy to reason about.

### Shared components library — `src/widgets/_shared/`

This project has a shared component library for patterns used across many widgets:

```tsx
import {
  TabBar,
  LineChart,
  WidgetLoading,
  NotConnected,
} from "../_shared";
import { buttonDefault, inputBase, dimText } from "../_shared/styles";
```

`TabBar` is a good example of a pure presentational component — it renders tabs and fires an `onSelect` callback, but has no idea what the tabs represent:

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

### How WidgetHost composes widgets

`src/renderer/src/components/WidgetHost.tsx` is itself a composition layer — it looks up the widget component from the registry, wraps it in an `ErrorBoundary`, and renders it:

```tsx
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

`Component` here is the function exported by each widget (e.g. `QuickCopy`, `MediaTracker`). The dashboard renders dozens of these; each is isolated by its own error boundary.

---

## 14. Error Boundaries

A normal `try/catch` doesn't work for errors that happen during React rendering. **Error boundaries** are special class components that catch rendering errors in their subtree.

> Error boundaries are the one case in modern React where you still need a class component. There is no hook equivalent.

### Implementation

```tsx
// src/renderer/src/components/WidgetHost.tsx
class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  // Called when a descendant throws during render.
  // Returns the new state derived from the error.
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  // Called after rendering the fallback UI. Use for logging.
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

Without error boundaries, one buggy widget would crash the entire dashboard. With them, only that widget shows an error; the rest keep working. Each widget gets its own `ErrorBoundary` in `WidgetHost`.

### What error boundaries do NOT catch

- Errors in event handlers (use `try/catch` there)
- Async errors (use `.catch()` or `try/catch` in `async` functions)
- Errors in the error boundary itself

---

## 15. TypeScript and React

TypeScript adds static types to JavaScript. In React, this means catching prop mismatches, missing required values, and typos at compile time rather than at runtime.

### Typing props with interfaces

```tsx
// src/widgets/file-shortcuts/index.tsx
interface Shortcut {
  id: string;
  path: string;
  label: string;
  kind: "file" | "dir";  // union type — only these two string values are valid
}
```

`"file" | "dir"` is a **union type**: TypeScript will error if you try to assign any other string.

### Generic state

`useState` infers the type from the initial value when possible. For empty arrays or nullable values, provide the type explicitly:

```tsx
const [entries, setEntries] = useState<CopyEntry[]>([]);    // array of CopyEntry
const [copiedId, setCopiedId] = useState<string | null>(null); // string or null
```

### Generic API calls

The `api.kv.get` method is generic — you tell it what type to expect back:

```tsx
api.kv.get<CopyEntry[]>("entries")  // returns Promise<CopyEntry[] | null>
```

The `api.sql.all` method works the same way:

```tsx
api.sql.all<{ name: string }>(
  `PRAGMA table_info(${m.table})`
)
// returns Promise<Array<{ name: string }>>
```

### Typing return values of custom hooks

`useGoogleConnection` returns a tuple. TypeScript needs explicit typing here because inferred types for mixed-type arrays default to a union, not a tuple:

```tsx
// src/widgets/_shared/useGoogleConnection.ts
export function useGoogleConnection(
  api: WidgetApi,
): [boolean | null, (v: boolean | null) => void] {
  //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //  Explicitly typed as a 2-tuple, not an array
```

### `ComponentType<P>` — storing a component in a variable

The widget registry stores each widget's component as `ComponentType<WidgetProps>`:

```tsx
// src/renderer/src/plugins/registry.ts
import type { ComponentType } from "react";

export interface Widget {
  manifest: WidgetManifest;
  Component: ComponentType<WidgetProps>;
}
```

`ComponentType<P>` is React's type for "anything that can be used as a JSX element and accepts props of type `P`" — it covers both function components and class components.

### Typing `unknown` errors

TypeScript 4+ types `catch` clause variables as `unknown`. You must narrow the type before using it:

```tsx
.catch((e: unknown) => {
  setError((e as Error).message);
});
```

`e as Error` is a type assertion — you're telling TypeScript "trust me, this is an Error". Use this only when you're confident about the actual type.

---

## 16. Global State — Zustand

Local component state (`useState`) only lives inside one component. To share state across many components without prop drilling, this project uses **Zustand** — a minimal global state library.

### The problem Zustand solves

Imagine `Dashboard.tsx` needs to know the active dashboard, `WidgetHost.tsx` needs to update a widget's title, and `AppSettings.tsx` needs to toggle drive sync. All of these touch the same shared `AppState`. Passing state down through props and callbacks would create long chains. Zustand lets any component directly read from and write to a central store.

### Defining the store

The dashboard store lives in `src/renderer/src/state/dashboard.ts`:

```tsx
// src/renderer/src/state/dashboard.ts
import { create } from "zustand";

export const useDashboard = create<DashboardStore>((set, get) => {
  function mutate(updater: (s: AppState) => AppState): void {
    set((store) => ({ state: updater(store.state) }));
    get().persist();  // debounced write to disk
  }

  return {
    loaded: false,
    state: DEFAULT_STATE,

    async load() {
      const s = await window.cc.state.load();
      set({ state: normalizeState(s), loaded: true });
    },

    removeInstance(instanceId) {
      mutate((s) => ({
        ...s,
        dashboards: s.dashboards.map((d) => ({
          ...d,
          instances: d.instances.filter((i) => i.instanceId !== instanceId),
        })),
      }));
    },

    // ... more actions
  };
});
```

`create` takes a function that receives `set` and `get` and returns an object with state + actions.

### Reading from the store (selectors)

Components subscribe to only the slice of state they need. The component re-renders only when *that specific value* changes:

```tsx
// src/renderer/src/components/WidgetHost.tsx
const removeInstance = useDashboard((s) => s.removeInstance);
const setTitle       = useDashboard((s) => s.setTitle);
```

The `(s) => s.removeInstance` is a **selector** — a function from the full store state to the value you care about. Components that only read `removeInstance` won't re-render when unrelated parts of the store change.

### Writing to the store (calling actions)

Actions are just functions on the store object. You call them directly:

```tsx
removeInstance(instance.instanceId);
```

### Zustand vs `useState`

| | `useState` | Zustand |
|---|---|---|
| Scope | Single component | Any component in the app |
| Sharing state | Prop drilling | Direct store subscription |
| Persistence | Manual | Hook into `set`/`get` |
| Re-render control | All state in component | Selector-based |

---

## 17. Putting It All Together — A Widget Walkthrough

Let's trace through the `api-tracker` widget (`src/widgets/api-tracker/index.tsx`) from start to finish. It's a compact widget that illustrates almost every concept in this guide.

### What it does

`api-tracker` listens to an in-app event bus and displays a live log of every network call made by any widget.

### Step 1: Component shell

```tsx
function ApiTracker({ api, settings, setTitle }: WidgetProps) {
```

A function component receiving the standard `WidgetProps`. It destructures all three props.

### Step 2: State declarations

```tsx
const [calls, setCalls] = useState<ApiCallRecord[]>([]);
const [ready, setReady] = useState(false);
```

Two pieces of state: the list of recorded API calls, and a ready flag for DB initialization.

### Step 3: DB initialization via custom hook

```tsx
const dbReady = useSqlInit(api, INIT_SQL, MIGRATIONS);
```

One line to initialize the widget's SQLite table and run any migrations. The hook encapsulates the async setup; the widget just waits for `dbReady`.

### Step 4: Load historical calls from the DB

```tsx
useEffect(() => {
  if (!dbReady) return;
  api.sql
    .all<ApiCallRecord>("SELECT * FROM api_calls ORDER BY timestamp DESC LIMIT 200")
    .then((rows) => {
      setCalls(rows);
      setReady(true);
    });
}, [dbReady, api.sql]);
```

Runs once when `dbReady` becomes `true`. Loads the last 200 recorded calls from the DB.

### Step 5: Subscribe to live events

```tsx
useEffect(() => {
  const unsub = subscribeApiCalls((record) => {
    // Persist new record to DB, then prepend to state:
    void api.sql
      .run("INSERT INTO api_calls (...) VALUES (...)", [...])
      .then(() => setCalls((prev) => [record, ...prev].slice(0, 200)));
  });
  return unsub; // cleanup: unsubscribe when component unmounts
}, [api.sql]);
```

Subscribes to the `apiEvents` bus. The cleanup function (`return unsub`) prevents memory leaks by unsubscribing when the widget is removed.

### Step 6: Dynamic title

```tsx
useEffect(() => {
  if (calls.length > 0) {
    setTitle(`API Tracker (${calls.length})`);
  }
}, [calls.length, setTitle]);
```

Keeps the widget's header title in sync with the number of recorded calls.

### Step 7: Early return

```tsx
if (!ready) return <WidgetLoading />;
```

Nothing renders until the DB is loaded.

### Step 8: Render the list

```tsx
return (
  <div style={{ /* scrollable container */ }}>
    {calls.map((call) => (
      <div key={call.id} style={{ /* row */ }}>
        <span style={{
          color: call.status >= 500 ? "#ef4444"
               : call.status >= 400 ? "#f59e0b"
               : "var(--text)",
        }}>
          {call.status}
        </span>
        <span>{call.method}</span>
        <span>{call.url}</span>
        <span>{call.duration}ms</span>
      </div>
    ))}
  </div>
);
```

A `map()` over the calls array. Each row has a `key`, and the status code is colored conditionally.

---

### Concept checklist for this widget

| Concept | Where it appears |
|---|---|
| Function component | `function ApiTracker(...)` |
| Props | `{ api, settings, setTitle }` |
| `useState` | `calls`, `ready` |
| `useEffect` (data load) | Load from DB on mount |
| `useEffect` (subscription + cleanup) | Subscribe to live events |
| `useEffect` (derived state) | Dynamic `setTitle` |
| Custom hook | `useSqlInit` |
| Early return | `if (!ready) return <WidgetLoading />` |
| Lists + keys | `calls.map((call) => <div key={call.id}>...)` |
| Conditional styling | Status code color |

---

## Further Reading

- **React docs:** https://react.dev — the official docs, with interactive examples.
- **Zustand docs:** https://zustand.docs.pmnd.rs — concise and readable.
- **TypeScript handbook:** https://typescriptlang.org/docs — especially "Everyday Types" and "Generics".
- **Widgetauthor guide:** `src/widgets/README.md` — how to build a widget in this project.
- **SQL schema pattern:** `src/renderer/src/hooks/SCHEMA_PATTERN.md` — the full guide for SQLite in widgets.
- **Example widget:** `src/widgets/example-widget/index.tsx` — a fully-annotated widget exercising all major APIs.

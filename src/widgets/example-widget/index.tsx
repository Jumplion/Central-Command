// ─── Example Widget ────────────────────────────────────────────────────────
//
// This file is a fully-annotated reference implementation for widget authors.
// The widget itself is a simple note-taking tool; the feature set was chosen
// to exercise every major API surface, not to be the ideal notes design.
//
// SYSTEM OVERVIEW
// ───────────────
// Widgets live in src/widgets/<id>/index.tsx and must default-export a Widget
// object. The renderer's plugin registry (src/renderer/src/plugins/registry.ts)
// discovers them at build time via import.meta.glob — no manual registration.
//
// The widget runs inside a sandboxed React renderer with no direct Node or
// Electron access. All system calls go through the `api` prop, which is a
// thin IPC wrapper defined in src/renderer/src/plugins/api.ts. Each call
// crosses the contextBridge (src/preload/index.ts) into the main process
// (src/main/ipc.ts) where the actual work happens.
//
// APIs shown here:
//   manifest.settings  ─ all four field kinds: string, number, boolean, select
//   setTitle           ─ override the widget header at runtime
//   api.kv             ─ per-instance JSON key/value storage
//   api.sql            ─ per-widget SQLite (useSqlInit + manual fetch pattern)
//   api.net.fetch      ─ CORS-free HTTP via Electron's net module
//   api.secrets        ─ OS-keychain-backed encrypted storage
//   api.shell          ─ open a URL in the system browser

import { useState, useEffect, useCallback } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import {
  buttonDefault,
  buttonTiny,
  centeredEmptyState,
  inputBase,
} from "../_shared/styles";
import { INIT_SQL, MIGRATIONS } from "./constants";
import type { Note } from "./types";

// ─── Helper ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Sub-component ─────────────────────────────────────────────────────────
//
// Breaking the row into its own named component keeps the parent JSX readable.
// For a large list you would wrap this with React.memo to bail out of
// re-renders when the note object hasn't changed.

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
    <div
      style={{
        background: note.pinned ? "rgba(110,168,255,0.07)" : "var(--surface)",
        border: `1px solid ${note.pinned ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 6,
        padding: "6px 8px",
        display: "flex",
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 12,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--text)",
        }}
      >
        {note.body}
        {showDate && (
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
            {formatDate(note.created_at)}
          </div>
        )}
      </div>
      <button
        className="ghost"
        style={{
          ...buttonTiny,
          flexShrink: 0,
          opacity: note.pinned ? 1 : 0.35,
        }}
        onClick={onPin}
        title={note.pinned ? "Unpin" : "Pin to top"}
      >
        📌
      </button>
      <button
        className="ghost danger"
        style={{ ...buttonTiny, flexShrink: 0 }}
        onClick={onDelete}
        title="Delete note"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

function ExampleWidget({ api, settings, setTitle }: WidgetProps) {
  // ── Settings ──────────────────────────────────────────────────────────────
  //
  // `settings` is a plain Record<string, unknown> populated from the defaults
  // declared in manifest.settings below. The user can override each field
  // through the ⚙ panel. Cast each value to the expected type — the settings
  // schema guarantees shape at runtime but not at the TypeScript level.
  //
  // Settings are stored in AppState (userData/state.json), NOT in api.kv or
  // api.sql. They are passed fresh on every render, so there is no need to
  // cache them in local state.
  const headerLabel = (settings.headerLabel as string) || "Notes";
  const maxNotes = Math.max(1, Math.min(500, Number(settings.maxNotes ?? 50)));
  const showDates = settings.showDates !== false; // default true
  const sortNewest = ((settings.sortOrder as string) ?? "newest") === "newest";

  // ── Component state ───────────────────────────────────────────────────────
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [authorDraft, setAuthorDraft] = useState("");
  const [authorSaved, setAuthorSaved] = useState(false);

  // ── Database init ──────────────────────────────────────────────────────────
  //
  // useSqlInit(api, INIT_SQL, MIGRATIONS) does three things:
  //   1. Executes INIT_SQL once (idempotent via CREATE TABLE IF NOT EXISTS).
  //   2. For each migration, checks PRAGMA table_info to see if the column
  //      already exists; if not, runs the ALTER TABLE statement.
  //   3. Cross-validates migrations against INIT_SQL to catch duplicate
  //      column definitions early, before SQLite throws at runtime.
  //
  // It returns false until both steps complete successfully, so downstream
  // queries can safely gate on the `ready` flag.
  //
  // api.sql is unlocked by permissions.sqlite: true in the manifest.
  // If that flag is absent, every api.sql call silently resolves with an error.
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  // ── Note loader ───────────────────────────────────────────────────────────
  //
  // Wrap the fetch in useCallback so its identity is stable across renders.
  // Handlers that mutate the DB call `loadNotes()` directly after their
  // api.sql.run to refresh the list.
  //
  // NOTE: The `sortNewest` and `maxNotes` values come from developer-controlled
  // settings (an enum comparison and a clamped number), so interpolating the
  // ORDER BY direction into the SQL string is safe. User-supplied strings must
  // always go through parameterized placeholders (?), never string interpolation.
  //
  // An alternative to this manual pattern is the useWidgetData hook from
  // @renderer/hooks/useWidgetData — it handles loading state and returns a
  // stable refetch callback. Use it when your query doesn't depend on a
  // `ready` gate or on settings-driven SQL fragments.
  const loadNotes = useCallback(async () => {
    const dir = sortNewest ? "DESC" : "ASC";
    const rows = await api.sql.all<Note>(
      `SELECT * FROM notes ORDER BY pinned DESC, created_at ${dir} LIMIT ?`,
      [maxNotes],
    );
    setNotes(rows);
  }, [api, sortNewest, maxNotes]);

  // Re-run whenever the DB becomes ready or the sort/limit settings change.
  useEffect(() => {
    if (ready) void loadNotes();
  }, [ready, loadNotes]);

  // ── Dynamic header ─────────────────────────────────────────────────────────
  //
  // setTitle overrides the text shown in the widget's header bar at runtime.
  // Pass undefined to restore the manifest `name` value.
  // This effect runs whenever the note count or the user's custom label changes.
  useEffect(() => {
    setTitle(
      notes.length > 0 ? `${headerLabel} (${notes.length})` : headerLabel,
    );
  }, [notes.length, headerLabel, setTitle]);

  // ── KV: last-opened tracking ───────────────────────────────────────────────
  //
  // api.kv provides a per-instance JSON key/value store backed by a file at
  // userData/widgets/<widgetId>/store.json. "Per-instance" means two copies
  // of this widget on the same dashboard each have their own separate keys,
  // even though they share the same SQLite database (api.sql is per-widget-type,
  // not per-instance).
  //
  // api.kv.get / set / del / keys are all async IPC calls to the main process.
  // Values are serialized as JSON — any JSON-serializable type is supported.
  //
  // This effect records when the widget was last viewed. The returned cleanup
  // function is a no-op here, but useEffect cleanup is required whenever the
  // effect starts a timer, subscription, or any resource that outlives the
  // component — see the timer example in src/widgets/README.md.
  useEffect(() => {
    void api.kv.set("lastOpened", new Date().toISOString());
  }, [api]);

  // ── Secrets: author name ───────────────────────────────────────────────────
  //
  // api.secrets is per-widget-type (shared across all instances) and encrypted
  // at rest using Electron safeStorage — the OS keychain on macOS/Windows and
  // libsecret on Linux. Use it for sensitive values: API keys, personal
  // identifiers, OAuth credentials. Do not use it for large blobs or data that
  // should be accessible to the settings UI (those belong in manifest.settings).
  //
  // api.secrets.get returns string | null (null if the key has never been set).
  useEffect(() => {
    api.secrets.get("authorName").then((val) => {
      const name = val ?? "";
      setAuthorName(name);
      setAuthorDraft(name);
    });
  }, [api]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const addNote = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || !ready) return;
      // api.sql.run is for INSERT / UPDATE / DELETE. Pass user input as a
      // parameterized value (?) — never interpolate it into the SQL string.
      await api.sql.run("INSERT INTO notes (body) VALUES (?)", [trimmed]);
      await loadNotes();
      setDraft("");
    },
    [api, ready, loadNotes],
  );

  const deleteNote = useCallback(
    async (id: number) => {
      await api.sql.run("DELETE FROM notes WHERE id = ?", [id]);
      await loadNotes();
    },
    [api, loadNotes],
  );

  const togglePin = useCallback(
    async (note: Note) => {
      await api.sql.run("UPDATE notes SET pinned = ? WHERE id = ?", [
        note.pinned ? 0 : 1,
        note.id,
      ]);
      await loadNotes();
    },
    [api, loadNotes],
  );

  // Fetch a random piece of advice and add it as a note.
  //
  // Use api.net.fetch instead of window.fetch for any cross-origin request.
  // The renderer runs as a sandboxed browser; window.fetch is subject to CORS
  // and cannot reach most external APIs directly. api.net.fetch routes the
  // request through Electron's net module in the main process, which bypasses
  // browser CORS entirely.
  //
  // res.body is always a string — the raw response text from the main process.
  // Parse it yourself with JSON.parse or handle it as plain text.
  const fetchQuote = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const res = await api.net.fetch("https://api.adviceslip.com/advice", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(res.body) as { slip: { advice: string } };
      await addNote(`"${data.slip.advice}"`);
    } catch (e) {
      setFetchError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }, [api, addNote]);

  const saveAuthor = useCallback(async () => {
    const name = authorDraft.trim();
    await api.secrets.set("authorName", name);
    setAuthorName(name);
    setAuthorSaved(true);
    setTimeout(() => setAuthorSaved(false), 1500);
  }, [api, authorDraft]);

  // api.shell.openExternal opens a URL in the user's default browser.
  // The main process only allows http, https, and mailto schemes — all others
  // are rejected before the OS shell call is made.
  const openDocs = () =>
    void api.shell.openExternal("https://github.com/jumplion/central-command");

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // The widget is placed inside a scrollable container by WidgetHost, so the
  // root element does NOT need overflow: auto — only inner lists do.
  //
  // If this component throws during render, the ErrorBoundary in WidgetHost
  // catches it and shows an error card without crashing the rest of the
  // dashboard. That means unhandled errors here are survivable, but you should
  // still handle async errors explicitly (e.g. fetchError above).

  if (!ready) {
    // Guard against rendering SQL queries before the schema is initialized.
    return (
      <div style={{ padding: 12, color: "var(--text-dim)", fontSize: 13 }}>
        Setting up database…
      </div>
    );
  }

  const pinnedNotes = notes.filter((n) => n.pinned);
  const unpinnedNotes = notes.filter((n) => !n.pinned);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 10,
      }}
    >
      {/* ── New note form ── */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void addNote(draft);
            }
          }}
          placeholder="New note… (Ctrl+Enter to save)"
          style={{ ...inputBase, flex: 1, minHeight: 56, resize: "vertical" }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            className="primary"
            style={buttonDefault}
            disabled={!draft.trim()}
            onClick={() => void addNote(draft)}
          >
            Add
          </button>
          {/* Demonstrates api.net.fetch — routes through Electron to bypass CORS */}
          <button
            style={buttonDefault}
            disabled={fetching}
            onClick={() => void fetchQuote()}
            title="Fetch a random piece of advice via api.net.fetch"
          >
            {fetching ? "…" : "💡 Quote"}
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ fontSize: 12, color: "var(--danger)", flexShrink: 0 }}>
          Fetch failed: {fetchError}
        </div>
      )}

      {/* ── Note list ── */}
      {notes.length === 0 ? (
        <div
          style={{
            ...centeredEmptyState,
            border: "1px dashed var(--border)",
            borderRadius: 6,
            fontSize: 13,
            padding: 12,
          }}
        >
          Add a note above, or click 💡 Quote to fetch one.
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {pinnedNotes.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-dim)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Pinned
            </div>
          )}
          {[...pinnedNotes, ...unpinnedNotes].map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              showDate={showDates}
              onPin={() => void togglePin(note)}
              onDelete={() => void deleteNote(note.id)}
            />
          ))}
        </div>
      )}

      {/* ── Author field — demonstrates api.secrets ── */}
      {/*
        api.secrets is encrypted at rest via Electron safeStorage. It is
        appropriate for any value the user would consider sensitive (API keys,
        personal names, tokens). Unlike manifest.settings, secrets are not
        visible in the settings panel UI — the widget manages them directly.
      */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <input
          value={authorDraft}
          onChange={(e) => setAuthorDraft(e.target.value)}
          placeholder="Your name (stored encrypted via api.secrets)"
          style={{ ...inputBase, flex: 1, fontSize: 11 }}
        />
        <button style={buttonTiny} onClick={() => void saveAuthor()}>
          {authorSaved ? "✓" : "Save"}
        </button>
        {/* Demonstrates api.shell.openExternal */}
        <button
          className="ghost"
          style={{ ...buttonTiny, color: "var(--text-dim)" }}
          onClick={openDocs}
          title="Open project repo (api.shell.openExternal)"
        >
          Docs ↗
        </button>
      </div>

      {authorName && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
          Signed as <strong>{authorName}</strong>{" "}
          <span style={{ opacity: 0.6 }}>
            — stored encrypted in api.secrets
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Widget definition ─────────────────────────────────────────────────────
//
// The `widget` object is the single thing the registry needs. Place it at the
// bottom of index.tsx after all components are defined.
//
// MANIFEST FIELDS
// ───────────────
// `id` must equal the containing folder name exactly. It is used as the
// storage namespace for all three persistence layers:
//   api.sql     → userData/widgets/example-widget/data.db
//   api.kv      → userData/widgets/example-widget/store.json
//   api.secrets → userData/secrets/example-widget.json
//
// Widget ids must match: ^[a-z0-9][a-z0-9-]{0,63}$
//
// `defaultSize` and `minSize` are in grid units. The dashboard uses a 12-column
// layout with 60 px row height, so { w: 5, h: 7 } = 5 columns × 420 px tall.
//
// `permissions.sqlite: true` unlocks api.sql. Without it, sql calls silently
// fail in the main process. `permissions.google: true` similarly unlocks
// api.google and api.google.shared.
//
// SETTINGS FIELDS
// ───────────────
// The `settings` array drives the per-instance ⚙ panel automatically. The
// app generates the form UI from this schema — no custom settings UI needed.
// Values are stored in AppState (not api.kv) and passed as the `settings`
// prop on every render. The four supported `kind` values are shown below.

const widget: Widget = {
  manifest: {
    id: "example-widget",
    name: "Example Widget",
    description:
      "Fully-annotated reference implementation. Demonstrates KV, SQL, net.fetch, secrets, shell, and all four settings field types.",
    version: "0.1.0",
    icon: "📓",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
    permissions: { sqlite: true },
    settings: [
      // kind: 'string' → text input; supports `placeholder` and `multiline`
      {
        kind: "string",
        key: "headerLabel",
        label: "Header label",
        default: "Notes",
        placeholder: "e.g. My Notes",
      },
      // kind: 'number' → number input; supports `min`, `max`, `step`
      {
        kind: "number",
        key: "maxNotes",
        label: "Max notes shown",
        default: 50,
        min: 1,
        max: 500,
        step: 1,
      },
      // kind: 'boolean' → checkbox toggle
      {
        kind: "boolean",
        key: "showDates",
        label: "Show timestamps",
        default: true,
      },
      // kind: 'select' → dropdown; each option has a `value` and display `label`
      {
        kind: "select",
        key: "sortOrder",
        label: "Sort order",
        default: "newest",
        options: [
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ],
      },
    ],
  },
  Component: ExampleWidget,
};

export default widget;

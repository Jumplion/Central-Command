import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import MarkdownIt from "markdown-it";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import { namedSql } from "@renderer/plugins/sqlParams";
import {
  buttonSmall,
  buttonTiny,
  dimText,
  inp,
  inputBase,
  mutedText,
  smallDimText,
} from "../_shared/styles";
import { NotConnected } from "../_shared/NotConnected";
import { KEEP_API_BASE, INIT_SQL, MIGRATIONS } from "./constants";
import {
  keepNoteToLocal,
  noteMatchesSearch,
  extractCategories,
  contentPreview,
  newLocalId,
  isKeepNote,
} from "./helpers";
import type { Note, KeepNote, KeepNotesList } from "./types";

const md = new MarkdownIt({ breaks: true, linkify: true });

const MD_STYLES = `
.nk-preview h1,.nk-preview h2,.nk-preview h3 { color:var(--text); font-weight:600; margin:8px 0 4px; }
.nk-preview h1 { font-size:15px; }
.nk-preview h2 { font-size:13px; }
.nk-preview h3 { font-size:12px; }
.nk-preview p { margin:0 0 6px; }
.nk-preview ul,.nk-preview ol { margin:0 0 6px; padding-left:18px; }
.nk-preview li { margin-bottom:2px; }
.nk-preview code { background:var(--panel-2); border-radius:3px; padding:1px 4px; font-family:monospace; font-size:11px; }
.nk-preview pre { background:var(--panel-2); border-radius:6px; padding:8px; overflow-x:auto; margin:0 0 6px; }
.nk-preview pre code { background:none; padding:0; }
.nk-preview blockquote { border-left:3px solid var(--border); margin:0 0 6px; padding:2px 0 2px 10px; color:var(--text-dim); }
.nk-preview a { color:var(--accent); }
.nk-preview hr { border:none; border-top:1px solid var(--border); margin:8px 0; }
`;

// ─── MarkdownPreview ──────────────────────────────────────────────────────────

function MarkdownPreview({ content }: { content: string }) {
  const styleRef = useRef<HTMLStyleElement | null>(null);
  useEffect(() => {
    if (!styleRef.current) {
      const el = document.createElement("style");
      el.textContent = MD_STYLES;
      document.head.appendChild(el);
      styleRef.current = el;
    }
    return () => {
      styleRef.current?.remove();
      styleRef.current = null;
    };
  }, []);

  return (
    <div
      className="nk-preview"
      dangerouslySetInnerHTML={{
        __html: md.render(content || "*No content yet.*"),
      }}
      style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text)" }}
    />
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onSelect }: { note: Note; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "8px 10px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        background: hovered ? "var(--panel-2)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: note.content ? 2 : 0,
        }}
      >
        {note.pinned ? (
          <span style={{ fontSize: 9, color: "var(--accent)", flexShrink: 0 }}>
            📌
          </span>
        ) : null}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {note.title || "(untitled)"}
        </span>
        {note.category && (
          <span
            style={{
              ...smallDimText,
              background: "var(--panel-2)",
              borderRadius: 4,
              padding: "1px 5px",
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            {note.category}
          </span>
        )}
      </div>
      {note.content && (
        <p
          style={{
            ...mutedText,
            margin: 0,
            fontSize: 11,
            lineHeight: 1.4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {contentPreview(note.content)}
        </p>
      )}
    </div>
  );
}

// ─── NoteEditor ───────────────────────────────────────────────────────────────

function NoteEditor({
  note,
  onBack,
  onSave,
  onDelete,
}: {
  note: Note;
  onBack: () => void;
  onSave: (updated: Note) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [category, setCategory] = useState(note.category);
  const [pinned, setPinned] = useState(!!note.pinned);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDirty =
    title !== note.title ||
    content !== note.content ||
    category !== note.category ||
    Number(pinned) !== note.pinned;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...note,
        title,
        content,
        category,
        pinned: pinned ? 1 : 0,
        updated_at: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${title || "this note"}"?`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button className="ghost small" onClick={onBack} style={buttonSmall}>
          ← Back
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          style={{
            ...inputBase,
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontWeight: 600,
            fontSize: 13,
            padding: "2px 4px",
            color: "var(--text)",
          }}
        />
        <button
          className={pinned ? "primary small" : "ghost small"}
          onClick={() => setPinned((p) => !p)}
          title={pinned ? "Unpin" : "Pin to top"}
          style={buttonTiny}
        >
          📌
        </button>
        <button
          className="ghost small"
          onClick={() => setPreview((p) => !p)}
          style={buttonSmall}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Category row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ ...dimText, fontSize: 11 }}>Tag:</span>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="category"
          style={{ ...inp, flex: 1, background: "var(--panel-2)" }}
        />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {preview ? (
          <div
            style={{
              height: "100%",
              overflow: "auto",
              padding: "10px 12px",
            }}
          >
            <MarkdownPreview content={content} />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note in Markdown…"
            style={{
              width: "100%",
              height: "100%",
              resize: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 12,
              fontFamily: "monospace",
              lineHeight: 1.6,
              padding: "10px 12px",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          className="danger small"
          onClick={handleDelete}
          disabled={deleting}
          style={buttonSmall}
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <div style={{ flex: 1 }} />
        {isDirty && (
          <span style={{ ...mutedText, fontSize: 10 }}>unsaved</span>
        )}
        <button
          className="primary small"
          onClick={handleSave}
          disabled={saving || !isDirty}
          style={buttonSmall}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

function NoteKeeper({ api, setTitle }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    api.google.shared
      .isConnected()
      .then((c) => setConnected(c))
      .catch(() => setConnected(false));
  }, [api]);

  const loadNotes = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const rows = await api.sql.all<Note>(
        "SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC",
      );
      setNotes(rows);
      setTitle?.(`Notes (${rows.length})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ready, api, setTitle]);

  useEffect(() => {
    if (ready) void loadNotes();
  }, [ready, loadNotes]);

  const syncFromGoogle = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const token = await api.google.shared.getToken();
      if (!token) {
        setConnected(false);
        return;
      }

      const fetched: KeepNote[] = [];
      let pageToken: string | undefined;

      do {
        const params = new URLSearchParams({ pageSize: "100" });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await api.net.fetch(
          `${KEEP_API_BASE}/notes?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!res.ok) {
          if (res.status === 401) {
            setConnected(false);
            setError("Session expired — reconnect Google in App Settings.");
          } else if (res.status === 403) {
            setError(
              "Access denied. Keep API requires Google Workspace or a Notes-scoped connection.",
            );
          } else {
            throw new Error(`Keep API error: ${res.status}`);
          }
          return;
        }

        const data = JSON.parse(res.body) as KeepNotesList;
        for (const kn of data.notes ?? []) {
          if (!kn.trashed && !kn.archived) fetched.push(kn);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);

      if (fetched.length > 0) {
        // Upsert: update title/content/pinned/timestamps; preserve local category
        const items = fetched.flatMap((kn) => {
          const n = keepNoteToLocal(kn);
          return [
            {
              sql: `INSERT OR IGNORE INTO notes (id, title, content, category, pinned, created_at, updated_at)
                    VALUES (?, ?, ?, '', ?, ?, ?)`,
              params: [n.id, n.title, n.content, n.pinned, n.created_at, n.updated_at],
            },
            {
              sql: `UPDATE notes SET title = ?, content = ?, pinned = ?, updated_at = ? WHERE id = ?`,
              params: [n.title, n.content, n.pinned, n.updated_at, n.id],
            },
          ];
        });
        await api.sql.runBatch(items);
      }

      await loadNotes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [api, loadNotes]);

  const createNote = useCallback(() => {
    const now = new Date().toISOString();
    setActiveNote({
      id: newLocalId(),
      title: "",
      content: "",
      category: "",
      pinned: 0,
      created_at: now,
      updated_at: now,
    });
  }, []);

  const saveNote = useCallback(
    async (note: Note) => {
      // Persist to local SQL
      await api.sql.run(
        ...namedSql(
          `INSERT OR REPLACE INTO notes (id, title, content, category, pinned, created_at, updated_at)
           VALUES (:id, :title, :content, :category, :pinned, :created_at, :updated_at)`,
          note as unknown as Record<string, unknown>,
        ),
      );

      if (connected) {
        const token = await api.google.shared.getToken();
        if (token) {
          if (isKeepNote(note.id)) {
            // Existing Keep note: sync pin state only (content changes are local)
            try {
              await api.net.fetch(
                `${KEEP_API_BASE}/notes/${note.id}?updateMask=pinned`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ pinned: note.pinned === 1 }),
                },
              );
            } catch {
              // pin sync failure is non-fatal
            }
          } else {
            // New local note: create in Google Keep
            try {
              const res = await api.net.fetch(`${KEEP_API_BASE}/notes`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  title: note.title,
                  ...(note.content
                    ? { body: { text: { text: note.content } } }
                    : {}),
                  pinned: note.pinned === 1,
                }),
              });
              if (res.ok) {
                const created = JSON.parse(res.body) as KeepNote;
                const keepId = created.name.replace("notes/", "");
                // Promote local id to Keep-assigned id
                await api.sql.run("DELETE FROM notes WHERE id = ?", [note.id]);
                await api.sql.run(
                  ...namedSql(
                    `INSERT INTO notes (id, title, content, category, pinned, created_at, updated_at)
                     VALUES (:id, :title, :content, :category, :pinned, :created_at, :updated_at)`,
                    { ...note, id: keepId } as unknown as Record<string, unknown>,
                  ),
                );
              }
            } catch {
              // push failure is non-fatal; note stays as local
            }
          }
        }
      }

      await loadNotes();
      setActiveNote(null);
    },
    [api, connected, loadNotes],
  );

  const deleteNote = useCallback(
    async (note: Note) => {
      if (connected && isKeepNote(note.id)) {
        const token = await api.google.shared.getToken();
        if (token) {
          try {
            await api.net.fetch(`${KEEP_API_BASE}/notes/${note.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch {
            // delete failure is non-fatal
          }
        }
      }
      await api.sql.run("DELETE FROM notes WHERE id = ?", [note.id]);
      await loadNotes();
      setActiveNote(null);
    },
    [api, connected, loadNotes],
  );

  const categories = useMemo(() => extractCategories(notes), [notes]);

  const filtered = useMemo(() => {
    let result = notes;
    if (search.trim()) {
      result = result.filter((n) => noteMatchesSearch(n, search.trim()));
    }
    if (catFilter === "pinned") {
      result = result.filter((n) => n.pinned);
    } else if (catFilter !== "all") {
      result = result.filter((n) => n.category === catFilter);
    }
    return result;
  }, [notes, search, catFilter]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (connected === null || !ready) {
    return (
      <div style={{ padding: 12, ...dimText, fontSize: 12 }}>Loading…</div>
    );
  }

  if (!connected) {
    return <NotConnected />;
  }

  if (activeNote) {
    return (
      <NoteEditor
        note={activeNote}
        onBack={() => setActiveNote(null)}
        onSave={saveNote}
        onDelete={() => deleteNote(activeNote)}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          className="primary small"
          onClick={createNote}
          style={buttonSmall}
        >
          + New
        </button>
        <div style={{ flex: 1 }} />
        {error && (
          <span
            style={{
              fontSize: 10,
              color: "var(--danger)",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={error}
          >
            ⚠ {error}
          </span>
        )}
        <button
          className="ghost small"
          onClick={syncFromGoogle}
          disabled={syncing}
          title="Sync from Google Keep"
          style={buttonSmall}
        >
          {syncing ? "Syncing…" : "↻ Sync"}
        </button>
      </div>

      {/* Search + category filter */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          style={{ ...inp, flex: 1 }}
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ ...inp, maxWidth: 90, flexShrink: 0 }}
        >
          <option value="all">All</option>
          <option value="pinned">📌 Pinned</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 12, ...dimText, fontSize: 12 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              ...dimText,
              fontSize: 12,
              lineHeight: 1.8,
            }}
          >
            {notes.length === 0 ? (
              <>
                No notes yet.
                <br />
                Click <strong>+ New</strong> or <strong>↻ Sync</strong> to
                import from Google Keep.
              </>
            ) : (
              "No notes match this filter."
            )}
          </div>
        ) : (
          filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onSelect={() => setActiveNote(note)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "note-keeper",
    name: "Note Keeper",
    description: "Personal notes with Google Keep sync and Markdown preview",
    version: "0.1.0",
    icon: "📝",
    defaultSize: { w: 6, h: 8 },
    minSize: { w: 3, h: 4 },
    permissions: { google: true },
  },
  Component: NoteKeeper,
};

export default widget;

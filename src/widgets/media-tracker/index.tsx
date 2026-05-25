import { useState, useEffect, useCallback, useRef } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import { useSqlInit } from "@renderer/hooks/useSqlInit";
import type {
  FormState,
  HistoryEntry,
  LinkRelation,
  MediaItem,
  MediaLink,
  StatusFilter,
  TypeFilter,
} from "./types";
import { DEFAULT_FORM, MEDIA_TYPES, STATUS_FILTERS } from "./constants";
import { INIT_SQL, MIGRATIONS } from "./schema";
import {
  INSERT_MEDIA_ITEM,
  UPDATE_MEDIA_ITEM,
  INSERT_STATUS_HISTORY,
  INSERT_MEDIA_LINK,
} from "./queries";
import { namedSql } from "@renderer/plugins/sqlParams";
import { lookupMetadata } from "./helpers";
import {
  ImportModal,
  LinkModal,
  MediaCard,
  StarRating,
} from "./components/components";
import { s } from "./styles";

// ─── Main widget component ────────────────────────────────────────────────────

function MediaTracker({ api, settings, setTitle }: WidgetProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [history, setHistory] = useState<Record<number, HistoryEntry[]>>({});
  const [links, setLinks] = useState<Record<number, MediaLink[]>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [lookupResults, setLookupResults] = useState<
    ReturnType<typeof lookupMetadata> extends Promise<infer T> ? T : never
  >([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [linkTarget, setLinkTarget] = useState<MediaItem | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);

  const loadItems = useCallback(async () => {
    const [rows, hist, linkRows] = await Promise.all([
      api.sql.all<MediaItem>(
        "SELECT * FROM media_items ORDER BY pinned DESC, CASE status WHEN 'current' THEN 0 ELSE 1 END, updated_at DESC",
      ),
      api.sql.all<HistoryEntry>(
        "SELECT * FROM media_status_history ORDER BY item_id, changed_at ASC",
      ),
      api.sql.all<MediaLink>(
        "SELECT * FROM media_links ORDER BY created_at ASC",
      ),
    ]);

    const histMap: Record<number, HistoryEntry[]> = {};
    for (const h of hist) {
      if (!histMap[h.item_id]) histMap[h.item_id] = [];
      histMap[h.item_id].push(h);
    }

    const linkMap: Record<number, MediaLink[]> = {};
    for (const l of linkRows) {
      if (!linkMap[l.item_id]) linkMap[l.item_id] = [];
      linkMap[l.item_id].push(l);
      if (!linkMap[l.linked_item_id]) linkMap[l.linked_item_id] = [];
      linkMap[l.linked_item_id].push(l);
    }

    setItems(rows);
    setHistory(histMap);
    setLinks(linkMap);

    const activeCount = rows.filter((r) => r.status === "current").length;
    setTitle(
      activeCount > 0 ? `Media Tracker (${activeCount} active)` : undefined,
    );
  }, [api.sql, setTitle]);

  useEffect(() => {
    if (ready) void loadItems();
  }, [ready, loadItems]);

  const openAdd = () => {
    setEditItem(null);
    setForm(DEFAULT_FORM);
    setLookupResults([]);
    setShowModal(true);
  };

  const openEdit = (item: MediaItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      type: item.type,
      status: item.status,
      author_creator: item.author_creator ?? "",
      rating: item.rating ?? 0,
      notes: item.notes ?? "",
      external_id: item.external_id ?? "",
      external_source: item.external_source ?? "",
    });
    setLookupResults([]);
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();

    if (editItem) {
      await api.sql.run(
        ...namedSql(UPDATE_MEDIA_ITEM, {
          title: form.title.trim(),
          type: form.type,
          status: form.status,
          author_creator: form.author_creator || null,
          rating: form.rating || null,
          notes: form.notes || null,
          updated_at: now,
          id: editItem.id,
        }),
      );
      if (form.status !== editItem.status) {
        await api.sql.run(
          ...namedSql(INSERT_STATUS_HISTORY, {
            item_id: editItem.id,
            status: form.status,
            changed_at: now,
          }),
        );
      }
    } else {
      const result = await api.sql.run(
        ...namedSql(INSERT_MEDIA_ITEM, {
          title: form.title.trim(),
          type: form.type,
          status: form.status,
          author_creator: form.author_creator || null,
          rating: form.rating || null,
          notes: form.notes || null,
          external_id: form.external_id || null,
          external_source: form.external_source || null,
        }),
      );
      await api.sql.run(
        ...namedSql(INSERT_STATUS_HISTORY, {
          item_id: result.lastInsertRowid,
          status: form.status,
          changed_at: now,
        }),
      );
    }

    setShowModal(false);
    loadItems();
  };

  const togglePin = async (item: MediaItem) => {
    await api.sql.run(
      "UPDATE media_items SET pinned=?, updated_at=? WHERE id=?",
      [item.pinned ? 0 : 1, new Date().toISOString(), item.id],
    );
    loadItems();
  };

  const deleteItem = async (id: number) => {
    await api.sql.run("DELETE FROM media_status_history WHERE item_id=?", [id]);
    await api.sql.run(
      "DELETE FROM media_links WHERE item_id=? OR linked_item_id=?",
      [id, id],
    );
    await api.sql.run("DELETE FROM media_items WHERE id=?", [id]);
    loadItems();
  };

  const addLink = async (
    sourceItem: MediaItem,
    targetId: number,
    relation: LinkRelation,
  ) => {
    await api.sql.run(
      ...namedSql(INSERT_MEDIA_LINK, {
        item_id: sourceItem.id,
        linked_item_id: targetId,
        relation,
      }),
    );
    setLinkTarget(null);
    loadItems();
  };

  const removeLink = async (linkId: number) => {
    await api.sql.run("DELETE FROM media_links WHERE id=?", [linkId]);
    loadItems();
  };

  const scrollToItem = useCallback((id: number) => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearch("");
    setHighlightId(id);
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      setTimeout(() => setHighlightId(null), 1500);
    }, 50);
  }, []);

  const performLookup = async () => {
    if (!form.title.trim()) return;
    setLookupLoading(true);
    setLookupResults([]);
    try {
      const results = await lookupMetadata(
        api.net,
        form.type,
        form.title.trim(),
        settings,
      );
      setLookupResults(results);
    } catch {
      // silently fail — lookup is best-effort
    } finally {
      setLookupLoading(false);
    }
  };

  const applyLookupResult = (r: (typeof lookupResults)[number]) => {
    setForm((f) => ({
      ...f,
      title: r.title || f.title,
      author_creator: r.creator || f.author_creator,
      external_id: r.externalId,
      external_source: r.source,
    }));
    setLookupResults([]);
  };

  const filtered = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !item.title.toLowerCase().includes(q) &&
        !item.author_creator?.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const canLookup =
    form.type === "book" ||
    (form.type === "game" && Boolean(settings.rawgKey)) ||
    (["movie", "tv", "anime"].includes(form.type) && Boolean(settings.tmdbKey));

  if (!ready)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#6b7280",
        }}
      >
        Loading…
      </div>
    );

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <input
          style={s.searchInput}
          placeholder="Search titles or creators…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          style={{
            ...s.addBtn,
            background: "#1e293b",
            color: "#94a3b8",
            fontSize: 12,
          }}
          onClick={() => setShowImport(true)}
        >
          ⬇ Import
        </button>
        <button style={s.addBtn} onClick={openAdd}>
          + Add
        </button>
      </div>

      {/* ── Status tabs ── */}
      <div style={s.tabBar}>
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.value}
            style={{ ...s.tab, ...(statusFilter === sf.value ? s.tabOn : {}) }}
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
      </div>

      {/* ── Type chips ── */}
      <div style={s.chips}>
        <button
          style={{ ...s.chip, ...(typeFilter === "all" ? s.chipOn : {}) }}
          onClick={() => setTypeFilter("all")}
        >
          All
        </button>
        {MEDIA_TYPES.map((mt) => (
          <button
            key={mt.value}
            style={{ ...s.chip, ...(typeFilter === mt.value ? s.chipOn : {}) }}
            onClick={() => setTypeFilter(mt.value)}
          >
            {mt.emoji} {mt.label}
          </button>
        ))}
      </div>

      {/* ── Item list ── */}
      <div style={s.list}>
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              color: "#4b5563",
              padding: 24,
              fontSize: 13,
            }}
          >
            {search || statusFilter !== "all" || typeFilter !== "all"
              ? "No matches found."
              : "Nothing added yet — hit + Add to start tracking!"}
          </div>
        ) : (
          filtered.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              history={history[item.id] ?? []}
              links={links[item.id] ?? []}
              allItems={items}
              onEdit={() => openEdit(item)}
              onPin={() => togglePin(item)}
              onDelete={() => deleteItem(item.id)}
              onAddLink={() => setLinkTarget(item)}
              onRemoveLink={removeLink}
              onScrollTo={scrollToItem}
              highlighted={highlightId === item.id}
              cardRef={(el) => {
                cardRefs.current[item.id] = el;
              }}
            />
          ))
        )}
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                margin: "0 0 14px",
                fontSize: 16,
                fontWeight: 700,
                color: "#f1f5f9",
              }}
            >
              {editItem ? "Edit" : "Add"} Media
            </h3>

            <label style={s.fieldLabel}>Title *</label>
            <div
              style={{
                position: "relative",
                marginBottom: lookupResults.length > 0 ? 0 : 12,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...s.field, flex: 1, marginBottom: 0 }}
                  autoFocus
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      title: e.target.value,
                      external_id: "",
                      external_source: "",
                    }));
                    setLookupResults([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveItem();
                  }}
                />
                {canLookup && (
                  <button
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      border: "1px solid #334155",
                      background: "#1e293b",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: 13,
                      flexShrink: 0,
                      opacity: lookupLoading ? 0.5 : 1,
                    }}
                    onClick={performLookup}
                    disabled={lookupLoading || !form.title.trim()}
                    title="Search for metadata"
                  >
                    {lookupLoading ? "…" : "🔍"}
                  </button>
                )}
              </div>

              {lookupResults.length > 0 && (
                <div
                  style={{
                    border: "1px solid #334155",
                    borderRadius: 6,
                    overflow: "hidden",
                    marginTop: 4,
                    marginBottom: 12,
                    background: "#0f172a",
                  }}
                >
                  {lookupResults.map((r, i) => (
                    <div
                      key={r.externalId}
                      style={{
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontSize: 12,
                        borderBottom:
                          i < lookupResults.length - 1
                            ? "1px solid #1e293b"
                            : "none",
                        display: "flex",
                        gap: 6,
                        alignItems: "baseline",
                      }}
                      onClick={() => applyLookupResult(r)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#1e293b")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <span style={{ color: "#f3f4f6", flex: 1 }}>
                        {r.title}
                      </span>
                      {r.creator && (
                        <span style={{ color: "#64748b" }}>{r.creator}</span>
                      )}
                      {r.year && (
                        <span style={{ color: "#4b5563" }}>{r.year}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={s.fieldLabel}>Creator / Author</label>
            <input
              style={s.field}
              placeholder="Author, Director, Studio, Developer…"
              value={form.author_creator}
              onChange={(e) =>
                setForm((f) => ({ ...f, author_creator: e.target.value }))
              }
            />

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={s.fieldLabel}>Type</label>
                <select
                  style={s.field}
                  value={form.type}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as FormState["type"],
                      external_id: "",
                      external_source: "",
                    }));
                    setLookupResults([]);
                  }}
                >
                  {MEDIA_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.fieldLabel}>Status</label>
                <select
                  style={s.field}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as FormState["status"],
                    }))
                  }
                >
                  {STATUS_FILTERS.filter((sf) => sf.value !== "all").map(
                    (sf) => (
                      <option key={sf.value} value={sf.value}>
                        {sf.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <label style={s.fieldLabel}>Rating</label>
            <StarRating
              value={form.rating}
              onChange={(r) => setForm((f) => ({ ...f, rating: r }))}
            />

            <label style={s.fieldLabel}>Thoughts / Notes</label>
            <textarea
              style={{
                ...s.field,
                height: 84,
                resize: "vertical" as const,
                marginBottom: 14,
              }}
              placeholder="Your review, impressions, or any notes…"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                style={{ ...s.saveBtn, opacity: form.title.trim() ? 1 : 0.45 }}
                onClick={saveItem}
                disabled={!form.title.trim()}
              >
                {editItem ? "Save Changes" : "Add Media"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link modal ── */}
      {linkTarget && (
        <LinkModal
          sourceItem={linkTarget}
          allItems={items}
          onLink={(targetId, relation) =>
            addLink(linkTarget, targetId, relation)
          }
          onClose={() => setLinkTarget(null)}
        />
      )}

      {/* ── Import modal ── */}
      {showImport && (
        <ImportModal
          api={api}
          settings={settings}
          onClose={() => setShowImport(false)}
          onDone={loadItems}
        />
      )}
    </div>
  );
}

// ─── Widget manifest ──────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "media-tracker",
    name: "Media Tracker",
    description:
      "Track books, movies, TV shows, games, podcasts, and more. Link sequels, franchises, and series. Import from Steam, Letterboxd, and Hardcover.",
    version: "0.3.0",
    icon: "🎬",
    defaultSize: { w: 6, h: 9 },
    minSize: { w: 4, h: 6 },
    permissions: { sqlite: true },
    settings: [
      {
        key: "tmdbKey",
        kind: "string",
        label: "TMDB API Key (movies / TV / anime lookup)",
      },
      { key: "rawgKey", kind: "string", label: "RAWG API Key (game lookup)" },
      {
        key: "steamKey",
        kind: "string",
        label: "Steam Web API Key (library import)",
      },
      { key: "steamId", kind: "string", label: "Steam User ID (64-bit)" },
      {
        key: "letterboxdUser",
        kind: "string",
        label: "Letterboxd Username (diary import)",
      },
      {
        key: "hardcoverKey",
        kind: "string",
        label: "Hardcover API Key (book import — free Goodreads alt)",
      },
    ],
  },
  Component: MediaTracker,
};

export default widget;

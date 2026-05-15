import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType   = 'book' | 'movie' | 'tv' | 'game' | 'podcast' | 'anime' | 'other';
type MediaStatus = 'current' | 'completed' | 'want' | 'paused' | 'dropped';
type StatusFilter = MediaStatus | 'all';
type TypeFilter   = MediaType | 'all';

interface MediaItem {
  id: number;
  title: string;
  type: MediaType;
  status: MediaStatus;
  pinned: number; // 0 | 1
  rating: number | null;
  notes: string | null;
  author_creator: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FormState {
  title: string;
  type: MediaType;
  status: MediaStatus;
  author_creator: string;
  rating: number;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIA_TYPES: { value: MediaType; label: string; emoji: string }[] = [
  { value: 'book',    label: 'Book',     emoji: '📚' },
  { value: 'movie',   label: 'Movie',    emoji: '🎬' },
  { value: 'tv',      label: 'TV Show',  emoji: '📺' },
  { value: 'game',    label: 'Game',     emoji: '🎮' },
  { value: 'podcast', label: 'Podcast',  emoji: '🎙️' },
  { value: 'anime',   label: 'Anime',    emoji: '⛩️' },
  { value: 'other',   label: 'Other',    emoji: '🎯' },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'current',   label: 'Current' },
  { value: 'completed', label: 'Completed' },
  { value: 'want',      label: 'Want' },
  { value: 'paused',    label: 'Paused' },
  { value: 'dropped',   label: 'Dropped' },
];

const STATUS_COLORS: Record<MediaStatus, string> = {
  current:   '#3b82f6',
  completed: '#22c55e',
  want:      '#a855f7',
  paused:    '#f59e0b',
  dropped:   '#ef4444',
};

const VERB: Record<MediaType, string> = {
  book:    'Reading',
  movie:   'Watching',
  tv:      'Watching',
  game:    'Playing',
  podcast: 'Listening',
  anime:   'Watching',
  other:   'Consuming',
};

const DEFAULT_FORM: FormState = {
  title: '',
  type: 'book',
  status: 'want',
  author_creator: '',
  rating: 0,
  notes: '',
};

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS media_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT    NOT NULL,
    type           TEXT    NOT NULL DEFAULT 'other',
    status         TEXT    NOT NULL DEFAULT 'want',
    pinned         INTEGER NOT NULL DEFAULT 0,
    rating         INTEGER,
    notes          TEXT,
    author_creator TEXT,
    completed_at   TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeEmoji  = (t: MediaType)   => MEDIA_TYPES.find(m => m.value === t)?.emoji ?? '🎯';
const statusLabel = (s: MediaStatus) => STATUS_FILTERS.find(f => f.value === s)?.label ?? s;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: '0 1px', lineHeight: 1,
            color: star <= (hover || value) ? '#f59e0b' : '#374151',
          }}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star === value ? 0 : star)}
        >★</button>
      ))}
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 11, letterSpacing: 1 }}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}

function MediaCard({
  item, onEdit, onPin, onDelete,
}: {
  item: MediaItem;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const isPinned = Boolean(item.pinned);
  const color = STATUS_COLORS[item.status];

  return (
    <div style={{
      borderRadius: 7,
      border: `1px solid ${isPinned ? '#1e3a5f' : '#1e293b'}`,
      borderLeft: `3px solid ${color}`,
      background: isPinned ? '#0d1f35' : '#0f172a',
      padding: '8px 10px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {/* Type icon */}
        <span style={{ fontSize: 18, lineHeight: 1, marginTop: 3, flexShrink: 0 }}>
          {typeEmoji(item.type)}
        </span>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </div>
          {item.author_creator && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.author_creator}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', padding: '1px 6px', borderRadius: 4,
              fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
              background: color + '22', color,
            }}>
              {item.status === 'current' ? VERB[item.type] : statusLabel(item.status)}
            </span>
            {item.rating ? <StarDisplay value={item.rating} /> : null}
            {isPinned && <span style={{ fontSize: 10, color: '#f59e0b' }}>📌 pinned</span>}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
          <button
            style={{ ...s.iconBtn, ...(isPinned ? { opacity: 1, color: '#f59e0b' } : {}) }}
            onClick={onPin} title={isPinned ? 'Unpin' : 'Pin to top'}
          >📌</button>
          <button style={s.iconBtn} onClick={onEdit} title="Edit">✏️</button>
          <button style={s.iconBtn} onClick={onDelete} title="Delete">🗑️</button>
          {item.notes && (
            <button style={s.iconBtn} onClick={() => setShowNotes(v => !v)} title="Toggle thoughts">
              {showNotes ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable notes */}
      {showNotes && item.notes && (
        <div style={{
          marginTop: 8, padding: '7px 9px', borderRadius: 5,
          background: '#1e293b', fontSize: 12, color: '#94a3b8',
          lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {item.notes}
        </div>
      )}
    </div>
  );
}

// ─── Main widget component ────────────────────────────────────────────────────

function MediaTracker({ api, setTitle }: WidgetProps) {
  const [items, setItems]               = useState<MediaItem[]>([]);
  const [ready, setReady]               = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [editItem, setEditItem]         = useState<MediaItem | null>(null);
  const [form, setForm]                 = useState<FormState>(DEFAULT_FORM);

  const loadItems = useCallback(async () => {
    const rows = await api.sql.all<MediaItem>(
      "SELECT * FROM media_items ORDER BY pinned DESC, CASE status WHEN 'current' THEN 0 ELSE 1 END, updated_at DESC"
    );
    setItems(rows);
    const activeCount = rows.filter(r => r.status === 'current').length;
    setTitle(activeCount > 0 ? `Media Tracker (${activeCount} active)` : undefined);
  }, [api.sql, setTitle]);

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(() => {
      setReady(true);
      loadItems();
    });
  }, [api.sql, loadItems]);

  const openAdd = () => {
    setEditItem(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  };

  const openEdit = (item: MediaItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      type: item.type,
      status: item.status,
      author_creator: item.author_creator ?? '',
      rating: item.rating ?? 0,
      notes: item.notes ?? '',
    });
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();

    if (editItem) {
      // Preserve original completed_at unless newly marking as completed
      const completedAt =
        form.status === 'completed' && editItem.status !== 'completed'
          ? now
          : editItem.completed_at;
      await api.sql.run(
        'UPDATE media_items SET title=?, type=?, status=?, author_creator=?, rating=?, notes=?, completed_at=?, updated_at=? WHERE id=?',
        [form.title.trim(), form.type, form.status, form.author_creator || null, form.rating || null, form.notes || null, completedAt, now, editItem.id]
      );
    } else {
      await api.sql.run(
        'INSERT INTO media_items (title, type, status, author_creator, rating, notes, completed_at) VALUES (?,?,?,?,?,?,?)',
        [form.title.trim(), form.type, form.status, form.author_creator || null, form.rating || null, form.notes || null, form.status === 'completed' ? now : null]
      );
    }

    setShowModal(false);
    loadItems();
  };

  const togglePin = async (item: MediaItem) => {
    await api.sql.run('UPDATE media_items SET pinned=?, updated_at=? WHERE id=?', [item.pinned ? 0 : 1, new Date().toISOString(), item.id]);
    loadItems();
  };

  const deleteItem = async (id: number) => {
    await api.sql.run('DELETE FROM media_items WHERE id=?', [id]);
    loadItems();
  };

  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (typeFilter  !== 'all' && item.type   !== typeFilter)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !(item.author_creator?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  if (!ready) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>Loading…</div>;

  return (
    <div style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <input
          style={s.searchInput}
          placeholder="Search titles or creators…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button style={s.addBtn} onClick={openAdd}>+ Add</button>
      </div>

      {/* ── Status tabs ── */}
      <div style={s.tabBar}>
        {STATUS_FILTERS.map(sf => (
          <button
            key={sf.value}
            style={{ ...s.tab, ...(statusFilter === sf.value ? s.tabOn : {}) }}
            onClick={() => setStatusFilter(sf.value)}
          >
            {sf.label}
            {sf.value !== 'all' && (
              <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>
                {items.filter(i => i.status === sf.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Type chips ── */}
      <div style={s.chips}>
        <button style={{ ...s.chip, ...(typeFilter === 'all' ? s.chipOn : {}) }} onClick={() => setTypeFilter('all')}>All</button>
        {MEDIA_TYPES.map(mt => (
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
          <div style={{ textAlign: 'center', color: '#4b5563', padding: 24, fontSize: 13 }}>
            {search || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'No matches found.'
              : 'Nothing added yet — hit + Add to start tracking!'}
          </div>
        ) : (
          filtered.map(item => (
            <MediaCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onPin={() => togglePin(item)}
              onDelete={() => deleteItem(item.id)}
            />
          ))
        )}
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              {editItem ? 'Edit' : 'Add'} Media
            </h3>

            <label style={s.fieldLabel}>Title *</label>
            <input
              style={s.field}
              autoFocus
              placeholder="Title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveItem(); }}
            />

            <label style={s.fieldLabel}>Creator / Author</label>
            <input
              style={s.field}
              placeholder="Author, Director, Studio, Developer…"
              value={form.author_creator}
              onChange={e => setForm(f => ({ ...f, author_creator: e.target.value }))}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={s.fieldLabel}>Type</label>
                <select style={s.field} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MediaType }))}>
                  {MEDIA_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.fieldLabel}>Status</label>
                <select style={s.field} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MediaStatus }))}>
                  {STATUS_FILTERS.filter(sf => sf.value !== 'all').map(sf => (
                    <option key={sf.value} value={sf.value}>{sf.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={s.fieldLabel}>Rating</label>
            <StarRating value={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />

            <label style={s.fieldLabel}>Thoughts / Notes</label>
            <textarea
              style={{ ...s.field, height: 84, resize: 'vertical' as const, marginBottom: 14 }}
              placeholder="Your review, impressions, or any notes…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                style={{ ...s.saveBtn, opacity: form.title.trim() ? 1 : 0.45 }}
                onClick={saveItem}
                disabled={!form.title.trim()}
              >
                {editItem ? 'Save Changes' : 'Add Media'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    fontSize: 13,
    color: '#e5e7eb',
  },
  topBar: {
    display: 'flex',
    gap: 6,
    padding: '8px 8px 4px',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    padding: '5px 9px',
    borderRadius: 6,
    border: '1px solid #374151',
    background: '#0f172a',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
  },
  addBtn: {
    padding: '5px 13px',
    borderRadius: 6,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  tabBar: {
    display: 'flex',
    gap: 1,
    padding: '2px 8px',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  tab: {
    padding: '3px 9px',
    border: 'none',
    borderRadius: 5,
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  tabOn: {
    background: '#1e293b',
    color: '#f3f4f6',
  },
  chips: {
    display: 'flex',
    gap: 4,
    padding: '3px 8px 6px',
    overflowX: 'auto',
    flexShrink: 0,
    scrollbarWidth: 'none',
  },
  chip: {
    padding: '2px 8px',
    borderRadius: 20,
    border: '1px solid #374151',
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  chipOn: {
    background: '#1e293b',
    color: '#e5e7eb',
    borderColor: '#475569',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '2px 8px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    padding: '2px 3px',
    borderRadius: 4,
    opacity: 0.55,
    lineHeight: 1,
    color: 'inherit',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    background: '#1e293b',
    borderRadius: 10,
    padding: '20px 22px',
    width: 370,
    maxWidth: '92vw',
    maxHeight: '87vh',
    overflowY: 'auto',
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  field: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e5e7eb',
    fontSize: 13,
    outline: 'none',
    marginBottom: 12,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: 6,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
};

// ─── Widget manifest ──────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'media-tracker',
    name: 'Media Tracker',
    description: 'Track books, movies, TV shows, games, podcasts, and more. Pin current media, write reviews, and rate your favorites.',
    version: '0.1.0',
    icon: '🎬',
    defaultSize: { w: 6, h: 9 },
    minSize:     { w: 4, h: 6 },
    permissions: { sqlite: true },
  },
  Component: MediaTracker,
};

export default widget;

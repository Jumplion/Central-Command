import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaType    = 'book' | 'movie' | 'tv' | 'game' | 'podcast' | 'anime' | 'other';
type MediaStatus  = 'current' | 'owned' | 'want' | 'completed' | 'paused' | 'dropped';
type StatusFilter = MediaStatus | 'all';
type TypeFilter   = MediaType | 'all';
type LinkRelation = 'sequel' | 'prequel' | 'spinoff' | 'series' | 'adaptation' | 'remake' | 'related';

interface MediaItem {
  id: number;
  title: string;
  type: MediaType;
  status: MediaStatus;
  pinned: number;
  rating: number | null;
  notes: string | null;
  author_creator: string | null;
  external_id: string | null;
  external_source: string | null;
  created_at: string;
  updated_at: string;
}

interface HistoryEntry {
  id: number;
  item_id: number;
  status: MediaStatus;
  changed_at: string;
}

interface MediaLink {
  id: number;
  item_id: number;
  linked_item_id: number;
  relation: LinkRelation;
  created_at: string;
}

interface FormState {
  title: string;
  type: MediaType;
  status: MediaStatus;
  author_creator: string;
  rating: number;
  notes: string;
  external_id: string;
  external_source: string;
}

interface LookupResult {
  externalId: string;
  source: 'tmdb' | 'rawg' | 'openlibrary';
  title: string;
  creator: string;
  year: string;
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
  { value: 'owned',     label: 'Owned' },
  { value: 'want',      label: 'Want' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused',    label: 'Paused' },
  { value: 'dropped',   label: 'Dropped' },
];

const STATUS_COLORS: Record<MediaStatus, string> = {
  current:   '#3b82f6',
  owned:     '#06b6d4',
  want:      '#a855f7',
  completed: '#22c55e',
  paused:    '#f59e0b',
  dropped:   '#ef4444',
};

const CURRENT_VERB: Record<MediaType, string> = {
  book:    'Reading',
  movie:   'Watching',
  tv:      'Watching',
  game:    'Playing',
  podcast: 'Listening',
  anime:   'Watching',
  other:   'Consuming',
};

const LINK_RELATIONS: { value: LinkRelation; label: string }[] = [
  { value: 'sequel',     label: 'Sequel' },
  { value: 'prequel',    label: 'Prequel' },
  { value: 'spinoff',    label: 'Spinoff' },
  { value: 'series',     label: 'Same Series' },
  { value: 'adaptation', label: 'Adaptation' },
  { value: 'remake',     label: 'Remake / Remaster' },
  { value: 'related',    label: 'Related' },
];

const DEFAULT_FORM: FormState = {
  title: '',
  type: 'book',
  status: 'want',
  author_creator: '',
  rating: 0,
  notes: '',
  external_id: '',
  external_source: '',
};

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS media_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    type            TEXT    NOT NULL DEFAULT 'other',
    status          TEXT    NOT NULL DEFAULT 'want',
    pinned          INTEGER NOT NULL DEFAULT 0,
    rating          INTEGER,
    notes           TEXT,
    author_creator  TEXT,
    external_id     TEXT,
    external_source TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    INTEGER NOT NULL,
    status     TEXT    NOT NULL,
    changed_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS media_links (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id        INTEGER NOT NULL,
    linked_item_id INTEGER NOT NULL,
    relation       TEXT    NOT NULL DEFAULT 'related',
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(item_id, linked_item_id)
  );
`;

// Migrations for existing databases (columns added after initial release)
const MIGRATIONS = [
  `ALTER TABLE media_items ADD COLUMN external_id TEXT`,
  `ALTER TABLE media_items ADD COLUMN external_source TEXT`,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeEmoji   = (t: MediaType)   => MEDIA_TYPES.find(m => m.value === t)?.emoji ?? '🎯';
const statusLabel = (s: MediaStatus) => STATUS_FILTERS.find(f => f.value === s)?.label ?? s;
const relationLabel = (r: LinkRelation) => LINK_RELATIONS.find(x => x.value === r)?.label ?? r;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

async function lookupMetadata(
  net: WidgetProps['api']['net'],
  type: MediaType,
  title: string,
  settings: Record<string, unknown>,
): Promise<LookupResult[]> {
  const q = encodeURIComponent(title);

  if (type === 'movie' || type === 'tv' || type === 'anime') {
    const key = settings.tmdbKey as string | undefined;
    if (!key) return [];
    const res = await net.fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${q}&page=1`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      results: Array<{
        id: number; title?: string; name?: string;
        release_date?: string; first_air_date?: string;
      }>;
    };
    return (data.results ?? []).slice(0, 5).map(r => ({
      externalId: String(r.id),
      source: 'tmdb' as const,
      title: r.title ?? r.name ?? '',
      creator: '',
      year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
    }));
  }

  if (type === 'game') {
    const key = settings.rawgKey as string | undefined;
    if (!key) return [];
    const res = await net.fetch(
      `https://api.rawg.io/api/games?key=${key}&search=${q}&page_size=5`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      results: Array<{ id: number; name: string; released: string | null }>;
    };
    return (data.results ?? []).slice(0, 5).map(r => ({
      externalId: String(r.id),
      source: 'rawg' as const,
      title: r.name,
      creator: '',
      year: (r.released ?? '').slice(0, 4),
    }));
  }

  if (type === 'book') {
    const res = await net.fetch(
      `https://openlibrary.org/search.json?title=${q}&limit=5&fields=key,title,author_name,first_publish_year`,
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.body) as {
      docs: Array<{ key: string; title: string; author_name?: string[]; first_publish_year?: number }>;
    };
    return (data.docs ?? []).slice(0, 5).map(d => ({
      externalId: d.key,
      source: 'openlibrary' as const,
      title: d.title,
      creator: (d.author_name ?? []).slice(0, 2).join(', '),
      year: String(d.first_publish_year ?? ''),
    }));
  }

  return [];
}

// ─── StarRating / StarDisplay / StatusTimeline ────────────────────────────────

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

function StatusTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
      {history.map((h, i) => {
        const color = STATUS_COLORS[h.status];
        return (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < history.length - 1 ? 4 : 0 }}>
            <span style={{ fontSize: 11, color: i === 0 ? '#64748b' : color }}>
              {i === 0 ? 'Added' : `→ ${statusLabel(h.status)}`}
            </span>
            <span style={{ fontSize: 10, color: '#4b5563' }}>{formatDate(h.changed_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── LinkedItemPill ───────────────────────────────────────────────────────────

function LinkedItemPill({ label, onClick, onRemove }: {
  label: string;
  onClick: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 20,
        background: '#1a2744', border: '1px solid #2d4a7a',
        fontSize: 11, cursor: 'pointer', userSelect: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ color: '#93c5fd' }} onClick={onClick}>{label}</span>
      {hovered && (
        <span
          style={{ color: '#ef4444', fontWeight: 700, lineHeight: 1, fontSize: 13 }}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove link"
        >×</span>
      )}
    </span>
  );
}

// ─── LinkModal ────────────────────────────────────────────────────────────────

function LinkModal({ sourceItem, allItems, onLink, onClose }: {
  sourceItem: MediaItem;
  allItems: MediaItem[];
  onLink: (targetId: number, relation: LinkRelation) => void;
  onClose: () => void;
}) {
  const [search, setSearch]         = useState('');
  const [relation, setRelation]     = useState<LinkRelation>('related');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const candidates = allItems
    .filter(item => item.id !== sourceItem.id)
    .filter(item =>
      search === '' ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.author_creator?.toLowerCase().includes(search.toLowerCase()) ?? false),
    )
    .slice(0, 8);

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width: 340 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
          Link to Another Entry
        </h3>

        <label style={s.fieldLabel}>Search entries</label>
        <input
          style={s.field}
          autoFocus
          placeholder="Search by title or creator…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedId(null); }}
        />

        {candidates.length > 0 && (
          <div style={{ border: '1px solid #334155', borderRadius: 6, overflow: 'hidden', marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
            {candidates.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                  background: selectedId === item.id ? '#1e3a5f' : 'transparent',
                  borderBottom: '1px solid #1e293b',
                  display: 'flex', gap: 6, alignItems: 'baseline',
                }}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{typeEmoji(item.type)}</span>
                <span style={{ color: '#f3f4f6', flex: 1 }}>{item.title}</span>
                {item.author_creator && (
                  <span style={{ color: '#64748b', fontSize: 11 }}>{item.author_creator}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {candidates.length === 0 && search.length > 0 && (
          <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>No entries found.</div>
        )}

        <label style={s.fieldLabel}>Relation type</label>
        <select
          style={{ ...s.field, marginBottom: 14 }}
          value={relation}
          onChange={e => setRelation(e.target.value as LinkRelation)}
        >
          {LINK_RELATIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.saveBtn, opacity: selectedId !== null ? 1 : 0.45 }}
            disabled={selectedId === null}
            onClick={() => selectedId !== null && onLink(selectedId, relation)}
          >
            Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ImportModal ──────────────────────────────────────────────────────────────

type ImportSection = 'steam' | 'letterboxd' | 'hardcover';

function ImportModal({ api, settings, onClose, onDone }: {
  api: WidgetProps['api'];
  settings: Record<string, unknown>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [active, setActive]   = useState<ImportSection>('steam');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const steamKey        = (settings.steamKey as string) || '';
  const steamId         = (settings.steamId as string) || '';
  const letterboxdUser  = (settings.letterboxdUser as string) || '';
  const hardcoverKey    = (settings.hardcoverKey as string) || '';

  const runImport = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (active === 'steam') {
        if (!steamKey || !steamId) { setMessage('Set Steam API Key and Steam ID in widget settings first.'); return; }
        const res = await api.net.fetch(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${steamKey}&steamid=${steamId}&include_appinfo=1&format=json`,
        );
        if (!res.ok) throw new Error(`Steam returned ${res.status}`);
        const data = JSON.parse(res.body) as {
          response?: { games?: Array<{ appid: number; name: string; playtime_2weeks?: number }> };
        };
        const games = data.response?.games ?? [];
        if (games.length === 0) { setMessage('No games found in that library.'); return; }
        const now = new Date().toISOString();
        const batch = games.map(g => ({
          sql: `INSERT OR IGNORE INTO media_items (title, type, status, external_id, external_source, created_at, updated_at)
                VALUES (?, 'game', ?, ?, 'steam', ?, ?)`,
          params: [g.name, (g.playtime_2weeks ?? 0) > 0 ? 'current' : 'owned', String(g.appid), now, now],
        }));
        await api.sql.runBatch(batch);
        setMessage(`Synced ${games.length} games from Steam.`);
        onDone();
      }

      if (active === 'letterboxd') {
        if (!letterboxdUser) { setMessage('Set your Letterboxd username in widget settings first.'); return; }
        const res = await api.net.fetch(`https://letterboxd.com/${letterboxdUser}/rss/`);
        if (!res.ok) throw new Error(`Letterboxd returned ${res.status}`);
        const parser = new DOMParser();
        const doc    = parser.parseFromString(res.body, 'text/xml');
        const items  = Array.from(doc.querySelectorAll('item'));
        if (items.length === 0) { setMessage('No diary entries found for that username.'); return; }
        const now = new Date().toISOString();
        const batch = items.map(item => {
          const filmTitle  = item.getElementsByTagNameNS('*', 'filmTitle')[0]?.textContent
                          ?? item.querySelector('title')?.textContent ?? '';
          const filmId     = item.getElementsByTagNameNS('*', 'filmId')[0]?.textContent
                          ?? item.querySelector('guid')?.textContent ?? '';
          const rawRating  = item.getElementsByTagNameNS('*', 'memberRating')[0]?.textContent;
          const rating     = rawRating ? Math.round(parseFloat(rawRating)) : null;
          return {
            sql: `INSERT OR IGNORE INTO media_items (title, type, status, rating, external_id, external_source, created_at, updated_at)
                  VALUES (?, 'movie', 'completed', ?, ?, 'letterboxd', ?, ?)`,
            params: [filmTitle, rating, filmId, now, now],
          };
        });
        await api.sql.runBatch(batch);
        setMessage(`Imported ${items.length} diary entries from Letterboxd.`);
        onDone();
      }

      if (active === 'hardcover') {
        if (!hardcoverKey) { setMessage('Set your Hardcover API key in widget settings first.'); return; }
        const res = await api.net.fetch('https://api.hardcover.app/v1/graphql', {
          method: 'POST',
          headers: { Authorization: `Bearer ${hardcoverKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ me { user_books { book { title contributions { author { name } } } status_id } } }`,
          }),
        });
        if (!res.ok) throw new Error(`Hardcover returned ${res.status}`);
        const data = JSON.parse(res.body) as {
          data?: { me?: { user_books?: Array<{
            book: { title: string; contributions?: Array<{ author?: { name?: string } }> };
            status_id: number;
          }> } };
        };
        const statusMap: Record<number, MediaStatus> = { 1: 'want', 2: 'current', 3: 'completed', 4: 'dropped' };
        const books = data.data?.me?.user_books ?? [];
        if (books.length === 0) { setMessage('No books found in your Hardcover shelves.'); return; }
        const now = new Date().toISOString();
        const batch = books.map(ub => ({
          sql: `INSERT OR IGNORE INTO media_items (title, type, status, author_creator, external_source, created_at, updated_at)
                VALUES (?, 'book', ?, ?, 'hardcover', ?, ?)`,
          params: [
            ub.book.title,
            statusMap[ub.status_id] ?? 'want',
            ub.book.contributions?.[0]?.author?.name ?? null,
            now, now,
          ],
        }));
        await api.sql.runBatch(batch);
        setMessage(`Imported ${books.length} books from Hardcover.`);
        onDone();
      }
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { value: ImportSection; label: string; emoji: string }[] = [
    { value: 'steam',      label: 'Steam',      emoji: '🎮' },
    { value: 'letterboxd', label: 'Letterboxd', emoji: '🎬' },
    { value: 'hardcover',  label: 'Hardcover',  emoji: '📚' },
  ];

  const descriptions: Record<ImportSection, string> = {
    steam:      'Import your Steam game library. Requires a Steam Web API Key and your 64-bit Steam ID (set in widget settings).',
    letterboxd: 'Import your Letterboxd diary as completed movies. Requires your public Letterboxd username (set in widget settings).',
    hardcover:  'Import books from your Hardcover shelves. Requires a Hardcover API key (set in widget settings). Hardcover is a free Goodreads alternative.',
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width: 380 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
          Import Library
        </h3>

        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {tabs.map(t => (
            <button
              key={t.value}
              style={{
                flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: active === t.value ? 700 : 400,
                background: active === t.value ? '#1e3a5f' : '#1e293b',
                color: active === t.value ? '#93c5fd' : '#64748b',
              }}
              onClick={() => { setActive(t.value); setMessage(''); }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 }}>
          {descriptions[active]}
        </p>

        {message && (
          <div style={{
            padding: '8px 10px', borderRadius: 6, marginBottom: 14, fontSize: 12,
            background: message.startsWith('Error') ? '#450a0a' : '#052e16',
            color: message.startsWith('Error') ? '#fca5a5' : '#86efac',
          }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.cancelBtn} onClick={onClose}>Close</button>
          <button
            style={{ ...s.saveBtn, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
            onClick={runImport}
          >
            {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MediaCard ────────────────────────────────────────────────────────────────

function MediaCard({
  item, history, links, allItems,
  onEdit, onPin, onDelete, onAddLink, onRemoveLink, onScrollTo,
  highlighted,
  cardRef,
}: {
  item: MediaItem;
  history: HistoryEntry[];
  links: MediaLink[];
  allItems: MediaItem[];
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
  onAddLink: () => void;
  onRemoveLink: (linkId: number) => void;
  onScrollTo: (id: number) => void;
  highlighted: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPinned  = Boolean(item.pinned);
  const color     = STATUS_COLORS[item.status];
  const itemMap   = Object.fromEntries(allItems.map(i => [i.id, i]));

  return (
    <div
      ref={cardRef}
      style={{
        borderRadius: 7,
        border: `1px solid ${highlighted ? '#3b82f6' : isPinned ? '#1e3a5f' : '#1e293b'}`,
        borderLeft: `3px solid ${color}`,
        background: highlighted ? '#0d1f3c' : isPinned ? '#0d1f35' : '#0f172a',
        padding: '8px 10px',
        flexShrink: 0,
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, lineHeight: 1, marginTop: 3, flexShrink: 0 }}>
          {typeEmoji(item.type)}
        </span>

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
              {item.status === 'current' ? CURRENT_VERB[item.type] : statusLabel(item.status)}
            </span>
            {item.rating ? <StarDisplay value={item.rating} /> : null}
            {isPinned && <span style={{ fontSize: 10, color: '#f59e0b' }}>📌 pinned</span>}
            {links.length > 0 && (
              <span style={{ fontSize: 10, color: '#4b5563' }}>🔗 {links.length} link{links.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
          <button
            style={{ ...s.iconBtn, ...(isPinned ? { opacity: 1, color: '#f59e0b' } : {}) }}
            onClick={onPin} title={isPinned ? 'Unpin' : 'Pin to top'}
          >📌</button>
          <button style={s.iconBtn} onClick={onEdit} title="Edit">✏️</button>
          <button style={s.iconBtn} onClick={onDelete} title="Delete">🗑️</button>
          <button style={s.iconBtn} onClick={() => setExpanded(v => !v)} title="Toggle details">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {item.notes && (
            <div style={{
              padding: '7px 9px', borderRadius: 5,
              background: '#1e293b', fontSize: 12, color: '#94a3b8',
              lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {item.notes}
            </div>
          )}
          <StatusTimeline history={history} />

          {/* ── Related entries ── */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Related
              </span>
              <button style={{ ...s.iconBtn, fontSize: 11, opacity: 0.8 }} onClick={onAddLink}>
                + Link
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {links.length === 0 && (
                <span style={{ fontSize: 11, color: '#374151' }}>No links yet.</span>
              )}
              {links.map(link => {
                const otherId = link.item_id === item.id ? link.linked_item_id : link.item_id;
                const other   = itemMap[otherId];
                if (!other) return null;
                return (
                  <LinkedItemPill
                    key={link.id}
                    label={`${typeEmoji(other.type)} ${other.title} · ${relationLabel(link.relation)}`}
                    onClick={() => onScrollTo(otherId)}
                    onRemove={() => onRemoveLink(link.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main widget component ────────────────────────────────────────────────────

function MediaTracker({ api, settings, setTitle }: WidgetProps) {
  const [items, setItems]               = useState<MediaItem[]>([]);
  const [history, setHistory]           = useState<Record<number, HistoryEntry[]>>({});
  const [links, setLinks]               = useState<Record<number, MediaLink[]>>({});
  const [ready, setReady]               = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [search, setSearch]             = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [showImport, setShowImport]     = useState(false);
  const [editItem, setEditItem]         = useState<MediaItem | null>(null);
  const [form, setForm]                 = useState<FormState>(DEFAULT_FORM);
  const [lookupResults, setLookupResults] = useState<LookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [linkTarget, setLinkTarget]     = useState<MediaItem | null>(null);
  const [highlightId, setHighlightId]   = useState<number | null>(null);

  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const loadItems = useCallback(async () => {
    const [rows, hist, linkRows] = await Promise.all([
      api.sql.all<MediaItem>(
        "SELECT * FROM media_items ORDER BY pinned DESC, CASE status WHEN 'current' THEN 0 ELSE 1 END, updated_at DESC",
      ),
      api.sql.all<HistoryEntry>(
        'SELECT * FROM media_status_history ORDER BY item_id, changed_at ASC',
      ),
      api.sql.all<MediaLink>(
        'SELECT * FROM media_links ORDER BY created_at ASC',
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

    const activeCount = rows.filter(r => r.status === 'current').length;
    setTitle(activeCount > 0 ? `Media Tracker (${activeCount} active)` : undefined);
  }, [api.sql, setTitle]);

  useEffect(() => {
    const init = async () => {
      await api.sql.exec(INIT_SQL);
      // Run migrations for databases created before these columns existed
      for (const sql of MIGRATIONS) {
        try { await api.sql.exec(sql); } catch { /* column already exists */ }
      }
      setReady(true);
      loadItems();
    };
    init();
  }, [api.sql, loadItems]);

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
      author_creator: item.author_creator ?? '',
      rating: item.rating ?? 0,
      notes: item.notes ?? '',
      external_id: item.external_id ?? '',
      external_source: item.external_source ?? '',
    });
    setLookupResults([]);
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();

    if (editItem) {
      await api.sql.run(
        'UPDATE media_items SET title=?, type=?, status=?, author_creator=?, rating=?, notes=?, updated_at=? WHERE id=?',
        [form.title.trim(), form.type, form.status, form.author_creator || null, form.rating || null, form.notes || null, now, editItem.id],
      );
      if (form.status !== editItem.status) {
        await api.sql.run(
          'INSERT INTO media_status_history (item_id, status, changed_at) VALUES (?,?,?)',
          [editItem.id, form.status, now],
        );
      }
    } else {
      const result = await api.sql.run(
        'INSERT INTO media_items (title, type, status, author_creator, rating, notes, external_id, external_source) VALUES (?,?,?,?,?,?,?,?)',
        [form.title.trim(), form.type, form.status, form.author_creator || null, form.rating || null, form.notes || null, form.external_id || null, form.external_source || null],
      );
      await api.sql.run(
        'INSERT INTO media_status_history (item_id, status, changed_at) VALUES (?,?,?)',
        [result.lastInsertRowid, form.status, now],
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
    await api.sql.run('DELETE FROM media_status_history WHERE item_id=?', [id]);
    await api.sql.run('DELETE FROM media_links WHERE item_id=? OR linked_item_id=?', [id, id]);
    await api.sql.run('DELETE FROM media_items WHERE id=?', [id]);
    loadItems();
  };

  const addLink = async (sourceItem: MediaItem, targetId: number, relation: LinkRelation) => {
    await api.sql.run(
      'INSERT OR IGNORE INTO media_links (item_id, linked_item_id, relation) VALUES (?,?,?)',
      [sourceItem.id, targetId, relation],
    );
    setLinkTarget(null);
    loadItems();
  };

  const removeLink = async (linkId: number) => {
    await api.sql.run('DELETE FROM media_links WHERE id=?', [linkId]);
    loadItems();
  };

  const scrollToItem = useCallback((id: number) => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearch('');
    setHighlightId(id);
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => setHighlightId(null), 1500);
    }, 50);
  }, []);

  const performLookup = async () => {
    if (!form.title.trim()) return;
    setLookupLoading(true);
    setLookupResults([]);
    try {
      const results = await lookupMetadata(api.net, form.type, form.title.trim(), settings);
      setLookupResults(results);
    } catch {
      // silently fail — lookup is best-effort
    } finally {
      setLookupLoading(false);
    }
  };

  const applyLookupResult = (r: LookupResult) => {
    setForm(f => ({
      ...f,
      title: r.title || f.title,
      author_creator: r.creator || f.author_creator,
      external_id: r.externalId,
      external_source: r.source,
    }));
    setLookupResults([]);
  };

  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (typeFilter   !== 'all' && item.type   !== typeFilter)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !(item.author_creator?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const canLookup = form.type === 'book' ||
    (form.type === 'game' && Boolean(settings.rawgKey)) ||
    (['movie', 'tv', 'anime'].includes(form.type) && Boolean(settings.tmdbKey));

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
        <button style={{ ...s.addBtn, background: '#1e293b', color: '#94a3b8', fontSize: 12 }} onClick={() => setShowImport(true)}>
          ⬇ Import
        </button>
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
              cardRef={el => { cardRefs.current[item.id] = el; }}
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
            <div style={{ position: 'relative', marginBottom: lookupResults.length > 0 ? 0 : 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{ ...s.field, flex: 1, marginBottom: 0 }}
                  autoFocus
                  placeholder="Title"
                  value={form.title}
                  onChange={e => {
                    setForm(f => ({ ...f, title: e.target.value, external_id: '', external_source: '' }));
                    setLookupResults([]);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') saveItem(); }}
                />
                {canLookup && (
                  <button
                    style={{
                      padding: '7px 10px', borderRadius: 6, border: '1px solid #334155',
                      background: '#1e293b', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
                      flexShrink: 0, opacity: lookupLoading ? 0.5 : 1,
                    }}
                    onClick={performLookup}
                    disabled={lookupLoading || !form.title.trim()}
                    title="Search for metadata"
                  >
                    {lookupLoading ? '…' : '🔍'}
                  </button>
                )}
              </div>

              {lookupResults.length > 0 && (
                <div style={{
                  border: '1px solid #334155', borderRadius: 6, overflow: 'hidden',
                  marginTop: 4, marginBottom: 12, background: '#0f172a',
                }}>
                  {lookupResults.map((r, i) => (
                    <div
                      key={r.externalId}
                      style={{
                        padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                        borderBottom: i < lookupResults.length - 1 ? '1px solid #1e293b' : 'none',
                        display: 'flex', gap: 6, alignItems: 'baseline',
                      }}
                      onClick={() => applyLookupResult(r)}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: '#f3f4f6', flex: 1 }}>{r.title}</span>
                      {r.creator && <span style={{ color: '#64748b' }}>{r.creator}</span>}
                      {r.year && <span style={{ color: '#4b5563' }}>{r.year}</span>}
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
              onChange={e => setForm(f => ({ ...f, author_creator: e.target.value }))}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={s.fieldLabel}>Type</label>
                <select
                  style={s.field}
                  value={form.type}
                  onChange={e => {
                    setForm(f => ({ ...f, type: e.target.value as MediaType, external_id: '', external_source: '' }));
                    setLookupResults([]);
                  }}
                >
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

      {/* ── Link modal ── */}
      {linkTarget && (
        <LinkModal
          sourceItem={linkTarget}
          allItems={items}
          onLink={(targetId, relation) => addLink(linkTarget, targetId, relation)}
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
    description: 'Track books, movies, TV shows, games, podcasts, and more. Link sequels, franchises, and series. Import from Steam, Letterboxd, and Hardcover.',
    version: '0.3.0',
    icon: '🎬',
    defaultSize: { w: 6, h: 9 },
    minSize:     { w: 4, h: 6 },
    permissions: { sqlite: true },
    settings: [
      { key: 'tmdbKey',        kind: 'string', label: 'TMDB API Key (movies / TV / anime lookup)' },
      { key: 'rawgKey',        kind: 'string', label: 'RAWG API Key (game lookup)' },
      { key: 'steamKey',       kind: 'string', label: 'Steam Web API Key (library import)' },
      { key: 'steamId',        kind: 'string', label: 'Steam User ID (64-bit)' },
      { key: 'letterboxdUser', kind: 'string', label: 'Letterboxd Username (diary import)' },
      { key: 'hardcoverKey',   kind: 'string', label: 'Hardcover API Key (book import — free Goodreads alt)' },
    ],
  },
  Component: MediaTracker,
};

export default widget;

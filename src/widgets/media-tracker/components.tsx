import { useState, type CSSProperties } from 'react';
import type { WidgetProps } from '@renderer/plugins/registry';
import type { HistoryEntry, LinkRelation, MediaItem, MediaLink, MediaStatus, MediaType } from './types';
import {
  LINK_RELATIONS, MEDIA_TYPES, STATUS_COLORS, STATUS_FILTERS,
  CURRENT_VERB,
} from './constants';
import { formatDate, relationLabel, statusLabel, typeEmoji } from './helpers';
import { s } from './styles';

// ─── StarRating / StarDisplay ─────────────────────────────────────────────────

export function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

export function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 11, letterSpacing: 1 }}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}

// ─── StatusTimeline ───────────────────────────────────────────────────────────

export function StatusTimeline({ history }: { history: HistoryEntry[] }) {
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

export function LinkedItemPill({ label, onClick, onRemove }: {
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

export function LinkModal({ sourceItem, allItems, onLink, onClose }: {
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

export function ImportModal({ api, settings, onClose, onDone }: {
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

export function MediaCard({
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
                    label={`${typeEmoji(other.type as MediaType)} ${other.title} · ${relationLabel(link.relation)}`}
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

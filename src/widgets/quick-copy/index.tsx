import { useEffect, useMemo, useState } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

interface CopyEntry {
  id: string;
  title: string;
  value: string;
  createdAt: number;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function QuickCopy({ api }: WidgetProps) {
  const [entries, setEntries] = useState<CopyEntry[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [composerOpen, setComposerOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.kv
      .get<CopyEntry[]>('entries')
      .then((saved) => {
        setEntries(saved ?? []);
      })
      .catch((e: unknown) => {
        setError((e as Error).message);
      });
  }, [api]);

  const ordered = useMemo(() => entries, [entries]);

  const persist = async (next: CopyEntry[]) => {
    setEntries(next);
    await api.kv.set('entries', next);
  };

  const resetForm = () => {
    setDraftTitle('');
    setDraftValue('');
  };

  const saveEntry = async () => {
    const value = draftValue.trim();
    if (!value) return;

    const title = draftTitle.trim();
    const now = Date.now();
    const next = [...entries, { id: makeId(), title, value, createdAt: now }];

    try {
      await persist(next);
      resetForm();
      setComposerOpen(false);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await persist(entries.filter((entry) => entry.id !== id));
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const copyEntry = async (entry: CopyEntry) => {
    try {
      await writeClipboard(entry.value);
      setCopiedId(entry.id);
      setError(null);
      setTimeout(() => {
        setCopiedId((curr) => (curr === entry.id ? null : curr));
      }, 1200);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const moveEntry = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const fromIndex = entries.findIndex((e) => e.id === sourceId);
    const toIndex = entries.findIndex((e) => e.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persist(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="ghost"
            style={{ fontSize: 10, padding: '3px 5px', lineHeight: 1, color: 'var(--text-dim)' }}
            onClick={() => setComposerOpen((open) => !open)}
            title={composerOpen ? 'Collapse' : 'Expand'}
          >
            {composerOpen ? '▾' : '▸'}
          </button>
          <button
            className="primary"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => {
              if (!composerOpen) setComposerOpen(true);
              else void saveEntry();
            }}
          >
            {composerOpen ? 'Add' : '+ Add'}
          </button>
        </div>

        {composerOpen && (
          <>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Optional label (e.g. Portfolio URL)"
              style={{ fontSize: 12, padding: '6px 8px' }}
            />
            <textarea
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder="Paste or type text to save..."
              style={{ fontSize: 12, padding: '8px', minHeight: 64, resize: 'vertical' }}
            />
          </>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {ordered.length === 0 ? (
        <div
          style={{
            flex: 1,
            border: '1px dashed var(--border)',
            borderRadius: 6,
            color: 'var(--text-dim)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: 12,
          }}
        >
          Add entries above, then click any card to copy.
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            alignContent: 'start',
          }}
        >
          {ordered.map((entry) => {
            const isHovered = hoveredId === entry.id;
            const isPressed = pressedId === entry.id;
            const isCopied = copiedId === entry.id;
            const isDragging = draggingId === entry.id;
            const isDropTarget = dropTargetId === entry.id;
            let bg = 'var(--surface)';
            if (isCopied) bg = 'rgba(72,199,142,0.12)';
            else if (isPressed) bg = 'rgba(110,168,255,0.18)';
            else if (isHovered) bg = 'rgba(110,168,255,0.07)';

            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => { setHoveredId(null); setPressedId(null); }}
                onMouseDown={(e) => {
                  if ((e.target as HTMLElement).closest('button, [draggable]')) return;
                  setPressedId(entry.id);
                }}
                onMouseUp={() => setPressedId(null)}
                onClick={() => void copyEntry(entry)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void copyEntry(entry); }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingId && draggingId !== entry.id) setDropTargetId(entry.id);
                }}
                onDragLeave={() => { if (dropTargetId === entry.id) setDropTargetId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggingId || draggingId === entry.id) return;
                  void moveEntry(draggingId, entry.id).catch((err: unknown) => {
                    setError((err as Error).message);
                  });
                  setDraggingId(null);
                  setDropTargetId(null);
                }}
                style={{
                  border: isDropTarget
                    ? '1px solid var(--accent)'
                    : isCopied
                    ? '1px solid rgba(72,199,142,0.5)'
                    : '1px solid var(--border)',
                  borderRadius: 6,
                  background: bg,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  cursor: 'pointer',
                  opacity: isDragging ? 0.35 : 1,
                  transition: 'background 0.1s, border-color 0.1s, opacity 0.15s',
                  userSelect: 'none',
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    draggable
                    style={{
                      fontSize: 14,
                      lineHeight: 1,
                      padding: '1px 3px',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      color: 'var(--text-dim)',
                      flexShrink: 0,
                    }}
                    title="Drag to reorder"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggingId(entry.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', entry.id);
                    }}
                    onDragEnd={(e) => {
                      e.stopPropagation();
                      setDraggingId(null);
                      setDropTargetId(null);
                    }}
                  >
                    ⠿
                  </span>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isCopied ? 'var(--accent)' : 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      transition: 'color 0.1s',
                    }}
                    title={entry.title || 'Untitled'}
                  >
                    {isCopied ? '✓ Copied!' : (entry.title || 'Untitled')}
                  </div>

                  <button
                    className="ghost danger"
                    style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeEntry(entry.id);
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    lineHeight: 1.35,
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                  title={entry.value}
                >
                  {entry.value}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: 'quick-copy',
    name: 'Quick Copy',
    description: 'Save snippets and copy them to clipboard with one click.',
    version: '0.1.0',
    icon: '📋',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 3 },
  },
  Component: QuickCopy,
};

export default widget;
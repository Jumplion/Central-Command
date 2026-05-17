import { useMemo, useState } from 'react';
import { listWidgets } from '@renderer/plugins/registry';
import { useDashboard } from '@renderer/state/dashboard';

interface Props {
  onClose: () => void;
}

export function AddWidgetDialog({ onClose }: Props) {
  const widgets = useMemo(() => listWidgets(), []);
  const addInstance = useDashboard((s) => s.addInstance);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return widgets;
    return widgets.filter(
      (w) =>
        w.manifest.name.toLowerCase().includes(q) ||
        w.manifest.id.toLowerCase().includes(q) ||
        (w.manifest.description?.toLowerCase().includes(q) ?? false)
    );
  }, [widgets, filter]);

  function add(widgetId: string) {
    const instanceId = addInstance(widgetId);
    if (!instanceId) {
      console.warn(`[add-widget-dialog] add failed for widget "${widgetId}"`);
      return;
    }
    console.info(`[add-widget-dialog] added widget "${widgetId}" as instance "${instanceId}"`);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add widget">
        <header>
          <h2>Add widget</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {widgets.length > 0 && (
          <input
            autoFocus
            placeholder="Search widgets…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="search"
          />
        )}
        {widgets.length === 0 ? (
          <div className="empty">
            <p>No widgets installed.</p>
            <p>
              Add a widget by creating a folder at <code>src/widgets/&lt;id&gt;/</code> with an{' '}
              <code>index.tsx</code> that default-exports a <code>Widget</code>.
            </p>
            <p>
              See <code>src/widgets/README.md</code> for the manifest reference.
            </p>
          </div>
        ) : (
          <ul className="widget-list">
            {filtered.map((w) => (
              <li key={w.manifest.id}>
                <div className="widget-meta">
                  <span className="widget-icon">{w.manifest.icon ?? '◻'}</span>
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
            {filtered.length === 0 && (
              <li>
                <em style={{ color: 'var(--text-dim)' }}>No widgets match "{filter}".</em>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

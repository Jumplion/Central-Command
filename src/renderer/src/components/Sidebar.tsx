import { useState } from 'react';
import { useDashboard } from '@renderer/state/dashboard';
import { AddWidgetDialog } from './AddWidgetDialog';

export function Sidebar() {
  const dashboards = useDashboard((s) => s.state.dashboards);
  const activeId = useDashboard((s) => s.state.activeDashboardId);
  const setActive = useDashboard((s) => s.setActiveDashboard);
  const addDashboard = useDashboard((s) => s.addDashboard);
  const renameDashboard = useDashboard((s) => s.renameDashboard);
  const removeDashboard = useDashboard((s) => s.removeDashboard);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  function startRename(id: string, name: string) {
    setEditingId(id);
    setEditingName(name);
  }

  function commitRename() {
    if (editingId) {
      const trimmed = editingName.trim();
      if (trimmed) renameDashboard(editingId, trimmed);
    }
    setEditingId(null);
  }

  function confirmRemove(id: string, name: string) {
    if (window.confirm(`Delete dashboard "${name}"? Widgets on it will also be removed.`)) {
      removeDashboard(id);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">⌘</span>
        <strong>Central Command</strong>
      </div>

      <nav className="dashboards">
        <div className="section-header">
          <span>Dashboards</span>
          <button
            className="ghost"
            onClick={() => addDashboard('New dashboard')}
            title="New dashboard"
            aria-label="New dashboard"
          >
            +
          </button>
        </div>
        <ul>
          {dashboards.map((d) => (
            <li key={d.id} className={d.id === activeId ? 'active' : ''}>
              {editingId === d.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  onClick={() => setActive(d.id)}
                  onDoubleClick={() => startRename(d.id, d.name)}
                  title="Double-click to rename"
                >
                  {d.name}
                </button>
              )}
              {dashboards.length > 1 && d.id === activeId && editingId !== d.id && (
                <button
                  className="ghost danger"
                  onClick={() => confirmRemove(d.id, d.name)}
                  title="Delete dashboard"
                  aria-label="Delete dashboard"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-actions">
        <button className="primary block" onClick={() => setShowAdd(true)}>
          + Add widget
        </button>
      </div>

      {showAdd && <AddWidgetDialog onClose={() => setShowAdd(false)} />}
    </aside>
  );
}

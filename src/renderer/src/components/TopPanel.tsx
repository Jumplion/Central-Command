import { useState } from 'react';
import { useDashboard } from '@renderer/state/dashboard';

interface TopPanelProps {}

export function TopPanel() {
  const dashboards = useDashboard((s) => s.state.dashboards);
  const activeId = useDashboard((s) => s.state.activeDashboardId);
  const setActive = useDashboard((s) => s.setActiveDashboard);
  const addDashboard = useDashboard((s) => s.addDashboard);
  const renameDashboard = useDashboard((s) => s.renameDashboard);
  const removeDashboard = useDashboard((s) => s.removeDashboard);

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
    <div className="top-panel">
      <div className="top-panel-tabs">
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            className={`top-panel-tab ${dashboard.id === activeId ? 'active' : ''}`}
          >
            {editingId === dashboard.id ? (
              <input
                autoFocus
                className="top-panel-tab-input"
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button
                className="top-panel-tab-button ghost"
                onClick={() => setActive(dashboard.id)}
                onDoubleClick={() => startRename(dashboard.id, dashboard.name)}
                title="Double-click to rename"
              >
                {dashboard.name}
              </button>
            )}

            {dashboards.length > 1 && dashboard.id === activeId && editingId !== dashboard.id && (
              <div className="top-panel-tab-actions">
                <button
                  className="ghost"
                  onClick={() => startRename(dashboard.id, dashboard.name)}
                  title="Rename dashboard"
                  aria-label="Rename dashboard"
                >
                  ✎
                </button>
                <button
                  className="ghost danger"
                  onClick={() => confirmRemove(dashboard.id, dashboard.name)}
                  title="Delete dashboard"
                  aria-label="Delete dashboard"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          className="top-panel-tab-button ghost top-panel-add"
          onClick={() => addDashboard('New dashboard')}
          title="New dashboard"
          aria-label="New dashboard"
        >
          +
        </button>
      </div>
    </div>
  );
}

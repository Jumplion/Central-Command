import { useMemo, useState } from "react";
import { useDashboard } from "@renderer/state/dashboard";
import { AddWidgetDialog } from "./AddWidgetDialog";
import { AppSettings } from "./AppSettings";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const paletteShortcut = useMemo(
    () => (/Mac/i.test(navigator.platform) ? "⌘K" : "Ctrl+K"),
    [],
  );
  const dashboards = useDashboard((s) => s.state.dashboards);
  const activeId = useDashboard((s) => s.state.activeDashboardId);
  const setActive = useDashboard((s) => s.setActiveDashboard);
  const addDashboard = useDashboard((s) => s.addDashboard);
  const renameDashboard = useDashboard((s) => s.renameDashboard);
  const removeDashboard = useDashboard((s) => s.removeDashboard);

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
    if (
      window.confirm(
        `Delete dashboard "${name}"? Widgets on it will also be removed.`,
      )
    ) {
      removeDashboard(id);
    }
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <span className="brand-mark">⌘</span>
        {!collapsed && <strong>Central Command</strong>}
        <button
          className="sidebar-toggle ghost"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {!collapsed && (
        <>
          <nav className="dashboards">
            <div className="section-header">
              <span>Dashboards</span>
              <button
                className="ghost"
                onClick={() => addDashboard("New dashboard")}
                title="New dashboard"
                aria-label="New dashboard"
              >
                +
              </button>
            </div>
            <ul>
              {dashboards.map((d) => (
                <li key={d.id} className={d.id === activeId ? "active" : ""}>
                  {editingId === d.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
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
                  {dashboards.length > 1 &&
                    d.id === activeId &&
                    editingId !== d.id && (
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
            <div className="sidebar-shortcut-hint">or press {paletteShortcut}</div>
          </div>

          <div className="sidebar-footer">
            <button
              className="ghost block"
              onClick={() => setShowSettings(true)}
              title="App settings"
              aria-label="App settings"
            >
              Settings
            </button>
          </div>
        </>
      )}

      {showAdd && <AddWidgetDialog onClose={() => setShowAdd(false)} />}
      {showSettings && <AppSettings onClose={() => setShowSettings(false)} />}
    </aside>
  );
}

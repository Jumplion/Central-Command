import { useState } from 'react';
import { AddWidgetDialog } from './AddWidgetDialog';
import { AppSettings } from './AppSettings';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <span className="brand-mark">⌘</span>
        {!collapsed && <strong>Central Command</strong>}
        <button
          className="sidebar-toggle ghost"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="sidebar-actions">
            <button className="primary block" onClick={() => setShowAdd(true)}>
              + Add widget
            </button>
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

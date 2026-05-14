import { useState } from 'react';
import { useDashboard } from '@renderer/state/dashboard';
import { AddWidgetDialog } from './AddWidgetDialog';
import { AppSettings } from './AppSettings';

export function MobileNav() {
  const dashboards = useDashboard((s) => s.state.dashboards);
  const activeId = useDashboard((s) => s.state.activeDashboardId);
  const setActive = useDashboard((s) => s.setActiveDashboard);
  const addDashboard = useDashboard((s) => s.addDashboard);

  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <nav className="mobile-nav">
        <div className="mobile-nav-dashboards">
          {dashboards.map((d) => (
            <button
              key={d.id}
              className={`mobile-nav-tab ${d.id === activeId ? 'active' : ''}`}
              onClick={() => setActive(d.id)}
            >
              {d.name}
            </button>
          ))}
          <button
            className="mobile-nav-tab ghost"
            onClick={() => addDashboard('New dashboard')}
            title="New dashboard"
            aria-label="New dashboard"
          >
            +
          </button>
        </div>
        <div className="mobile-nav-actions">
          <button className="mobile-nav-btn" onClick={() => setShowAdd(true)}>
            + Widget
          </button>
          <button className="mobile-nav-btn ghost" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </nav>

      {showAdd && <AddWidgetDialog onClose={() => setShowAdd(false)} />}
      {showSettings && <AppSettings onClose={() => setShowSettings(false)} />}
    </>
  );
}

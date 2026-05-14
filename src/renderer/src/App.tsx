import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './components/Dashboard';
import { useDashboard } from './state/dashboard';

declare const __MOBILE__: boolean | undefined;
const IS_MOBILE = typeof __MOBILE__ !== 'undefined' && __MOBILE__;

export default function App() {
  const load = useDashboard((s) => s.load);
  const loaded = useDashboard((s) => s.loaded);
  const applyRemoteState = useDashboard((s) => s.applyRemoteState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return window.cc.driveSync.onStatusChanged((status) => {
      if (status.stateChangedByRemote) {
        void window.cc.state.load().then(applyRemoteState);
      }
    });
  }, [applyRemoteState]);

  if (!loaded) {
    return <div className="loading">Loading…</div>;
  }

  if (IS_MOBILE) {
    return (
      <div className="app mobile">
        <main className="main">
          <Dashboard />
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="main">
        <Dashboard />
      </main>
    </div>
  );
}

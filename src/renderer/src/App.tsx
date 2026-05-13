import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { useDashboard } from './state/dashboard';

export default function App() {
  const load = useDashboard((s) => s.load);
  const loaded = useDashboard((s) => s.loaded);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return <div className="loading">Loading…</div>;
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

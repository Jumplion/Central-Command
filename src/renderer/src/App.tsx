import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { useDashboard } from './state/dashboard';

export default function App() {
  const load = useDashboard((s) => s.load);
  const loaded = useDashboard((s) => s.loaded);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Dashboard />
      </main>
    </div>
  );
}

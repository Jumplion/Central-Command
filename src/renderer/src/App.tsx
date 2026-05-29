import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { WidgetPalette } from "./components/WidgetPalette";
import { useDashboard } from "./state/dashboard";

export default function App() {
  const load = useDashboard((s) => s.load);
  const loaded = useDashboard((s) => s.loaded);
  const applyRemoteState = useDashboard((s) => s.applyRemoteState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!loaded) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="main">
        <Dashboard />
      </main>
      {showPalette && <WidgetPalette onClose={() => setShowPalette(false)} />}
    </div>
  );
}

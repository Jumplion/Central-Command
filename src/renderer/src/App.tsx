import { useEffect } from 'react';
import { MobileNav } from './components/MobileNav';
import { TopPanel } from './components/TopPanel';
import { Dashboard } from './components/Dashboard';
import { useDashboard } from './state/dashboard';

declare const __MOBILE__: boolean | undefined;
const IS_MOBILE = typeof __MOBILE__ !== 'undefined' && __MOBILE__;

export default function App() {
  const load = useDashboard((s) => s.load);
  const loaded = useDashboard((s) => s.loaded);
  const applyRemoteState = useDashboard((s) => s.applyRemoteState);

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
      <main className="main">
        <TopPanel />
        <Dashboard />
      </main>
    </div>
  );
}

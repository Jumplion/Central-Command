import type { AppState } from '@shared/types';
import { DEFAULT_STATE } from '@shared/defaults';

const STATE_KEY = 'cc-state';
const STATE_MTIME_KEY = 'cc-state:mtime';

function isAppState(v: unknown): v is AppState {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).version === 'number' &&
    Array.isArray((v as Record<string, unknown>).dashboards) &&
    typeof (v as Record<string, unknown>).activeDashboardId === 'string'
  );
}

export const stateApi = {
  load(): Promise<AppState> {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return Promise.resolve(structuredClone(DEFAULT_STATE));
      const parsed: unknown = JSON.parse(raw);
      return Promise.resolve(isAppState(parsed) ? parsed : structuredClone(DEFAULT_STATE));
    } catch {
      return Promise.resolve(structuredClone(DEFAULT_STATE));
    }
  },

  save(state: AppState): Promise<void> {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    localStorage.setItem(STATE_MTIME_KEY, String(Date.now()));
    return Promise.resolve();
  },

  exportJson(): string | null {
    return localStorage.getItem(STATE_KEY);
  },

  importJson(json: string): void {
    localStorage.setItem(STATE_KEY, json);
    localStorage.setItem(STATE_MTIME_KEY, String(Date.now()));
  },

  getLastModified(): number {
    const v = localStorage.getItem(STATE_MTIME_KEY);
    return v ? Number(v) : 0;
  },
};

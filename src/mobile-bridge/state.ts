import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { AppState } from '@shared/types';
import { DEFAULT_STATE } from '@shared/defaults';

const STATE_FILE = 'cc-state.json';

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
  async load(): Promise<AppState> {
    try {
      const { data } = await Filesystem.readFile({
        path: STATE_FILE,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const parsed: unknown = JSON.parse(data as string);
      return isAppState(parsed) ? parsed : structuredClone(DEFAULT_STATE);
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  },

  async save(state: AppState): Promise<void> {
    await Filesystem.writeFile({
      path: STATE_FILE,
      directory: Directory.Data,
      data: JSON.stringify(state, null, 2),
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
};

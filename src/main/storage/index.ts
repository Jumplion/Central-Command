import { app } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { JsonStore } from './json';
import { SqliteStore } from './sqlite';
import { atomicWrite } from './helpers';
import type { AppState } from '@shared/types';
import { DEFAULT_STATE } from '@shared/defaults';

function isAppState(x: unknown): x is AppState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<AppState>;
  return (
    typeof s.version === 'number' &&
    Array.isArray(s.dashboards) &&
    typeof s.activeDashboardId === 'string'
  );
}

export class Storage {
  readonly root: string;
  readonly json: JsonStore;
  readonly sqlite: SqliteStore;

  onStateSaved?: () => void;

  constructor() {
    this.root = app.getPath('userData');
    this.json = new JsonStore(this.root);
    this.sqlite = new SqliteStore(this.root);
  }

  private get stateFile(): string {
    return path.join(this.root, 'state.json');
  }

  async loadState(): Promise<AppState> {
    try {
      const text = await fs.readFile(this.stateFile, 'utf-8');
      const parsed: unknown = JSON.parse(text);
      if (isAppState(parsed)) return parsed;
      return structuredClone(DEFAULT_STATE);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(DEFAULT_STATE);
      throw err;
    }
  }

  async saveState(state: AppState): Promise<void> {
    if (!isAppState(state)) throw new Error('saveState: invalid state');
    await fs.mkdir(this.root, { recursive: true });
    await atomicWrite(this.stateFile, JSON.stringify(state, null, 2));
    this.onStateSaved?.();
  }

  async dispose(): Promise<void> {
    await this.json.flushAll();
    this.sqlite.closeAll();
  }
}

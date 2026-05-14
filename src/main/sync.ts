import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc';
import type { DriveSyncState, DriveSyncStatus } from '@shared/types';
import { DriveSync, DriveError } from './storage/drive';
import type { Storage } from './storage';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DRIVE_STATE_FILE = 'cc-state.json';

function driveKvName(widgetId: string): string {
  return `cc-kv-${widgetId}.json`;
}

function widgetIdFromDriveName(name: string): string | null {
  if (!name.startsWith('cc-kv-') || !name.endsWith('.json')) return null;
  return name.slice('cc-kv-'.length, -'.json'.length);
}

export class SyncManager {
  private _enabled = false;
  private _syncing = false;
  private _disposed = false;
  private _uploadPending = false;
  private _driveIds = new Map<string, string>();
  private _driveIdsLoaded = false;
  private _pollTimer: NodeJS.Timeout | null = null;
  private _queue: Promise<void> = Promise.resolve();
  private _status: DriveSyncStatus = {
    state: 'disabled',
    enabled: false,
    lastSyncedAt: null,
    lastError: null,
    stateChangedByRemote: false,
  };

  constructor(
    private drive: DriveSync,
    private storage: Storage,
    private getWindow: () => BrowserWindow | null
  ) {
    storage.onStateSaved = () => this._onStateSaved();
    storage.json.onFlushed = (widgetId) => this._onKvFlushed(widgetId);
  }

  getStatus(): DriveSyncStatus {
    return { ...this._status };
  }

  enable(): void {
    this._enabled = true;
    this._setState('idle');
    this._status.enabled = true;
    this._notify();
    this._schedulePolling();
    this._enqueue(() => this._doPull());
  }

  disable(): void {
    this._enabled = false;
    this._stopPolling();
    this._setState('disabled');
    this._status.enabled = false;
    this._notify();
  }

  async forcePush(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._enqueue(async () => {
        await this._doUploadAll();
      });
      this._queue.then(resolve).catch(reject);
    });
  }

  async forcePull(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._enqueue(async () => {
        await this._doPull();
      });
      this._queue.then(resolve).catch(reject);
    });
  }

  async initialSync(): Promise<void> {
    const connected = await this.drive.isConnected();
    if (!connected) return;
    this.enable();
  }

  dispose(): void {
    this._disposed = true;
    this._stopPolling();
  }

  private _onStateSaved(): void {
    if (!this._enabled || this._syncing) return;
    this._uploadPending = true;
    this._enqueue(async () => {
      if (!this._uploadPending) return;
      this._uploadPending = false;
      await this._doUploadAll();
    });
  }

  private _onKvFlushed(widgetId: string): void {
    if (!this._enabled || this._syncing) return;
    this._uploadPending = true;
    this._enqueue(async () => {
      if (!this._uploadPending) return;
      this._uploadPending = false;
      await this._doUploadAll();
    });
  }

  private _enqueue(task: () => Promise<void>): void {
    this._queue = this._queue
      .then(() => {
        if (this._disposed) return;
        return task();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this._setError(msg);
      });
  }

  private async _doUploadAll(): Promise<void> {
    this._syncing = true;
    this._setState('uploading');

    try {
      await this._ensureDriveIds();

      // Upload state.json
      const stateFile = path.join(this.storage.root, 'state.json');
      try {
        const content = await fs.readFile(stateFile, 'utf-8');
        const knownId = this._driveIds.get(DRIVE_STATE_FILE);
        const newId = await this.drive.upsertFile(DRIVE_STATE_FILE, content, knownId);
        this._driveIds.set(DRIVE_STATE_FILE, newId);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }

      // Upload cached widget KV stores
      for (const widgetId of this.storage.json.getCachedWidgetIds()) {
        const kvFile = path.join(this.storage.root, 'widgets', widgetId, 'store.json');
        try {
          const content = await fs.readFile(kvFile, 'utf-8');
          const driveName = driveKvName(widgetId);
          const knownId = this._driveIds.get(driveName);
          const newId = await this.drive.upsertFile(driveName, content, knownId);
          this._driveIds.set(driveName, newId);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
      }

      this._status.lastSyncedAt = Date.now();
      this._status.lastError = null;
      this._setState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._setError(msg);
      // Reset drive ID cache on auth/network errors so next attempt re-discovers files
      if (err instanceof DriveError) {
        this._driveIdsLoaded = false;
        this._driveIds.clear();
      }
    } finally {
      this._syncing = false;
    }
  }

  private async _doPull(): Promise<void> {
    this._syncing = true;
    this._setState('downloading');
    let stateChangedByRemote = false;

    try {
      const files = await this.drive.listFiles();
      for (const f of files) this._driveIds.set(f.name, f.id);
      this._driveIdsLoaded = true;

      for (const driveFile of files) {
        const remoteMs = new Date(driveFile.modifiedTime).getTime();

        if (driveFile.name === DRIVE_STATE_FILE) {
          const localPath = path.join(this.storage.root, 'state.json');
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const content = await this.drive.downloadFile(driveFile.id);
            const tmp = localPath + '.tmp';
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await fs.writeFile(tmp, content, 'utf-8');
            await fs.rename(tmp, localPath);
            stateChangedByRemote = true;
          }
          continue;
        }

        const widgetId = widgetIdFromDriveName(driveFile.name);
        if (!widgetId) continue;

        const localPath = path.join(this.storage.root, 'widgets', widgetId, 'store.json');
        if (await this._isRemoteNewer(localPath, remoteMs)) {
          const content = await this.drive.downloadFile(driveFile.id);
          const tmp = localPath + '.tmp';
          await fs.mkdir(path.dirname(localPath), { recursive: true });
          await fs.writeFile(tmp, content, 'utf-8');
          await fs.rename(tmp, localPath);
          this.storage.json.invalidateCache(widgetId);
        }
      }

      this._status.lastSyncedAt = Date.now();
      this._status.lastError = null;
      this._setState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._setError(msg);
      if (err instanceof DriveError) {
        this._driveIdsLoaded = false;
        this._driveIds.clear();
      }
    } finally {
      this._syncing = false;
    }

    this._notifyWithFlag(stateChangedByRemote);
  }

  private async _isRemoteNewer(localPath: string, remoteMs: number): Promise<boolean> {
    try {
      const stat = await fs.stat(localPath);
      return remoteMs > stat.mtimeMs;
    } catch {
      return true; // local file doesn't exist → remote wins
    }
  }

  private async _ensureDriveIds(): Promise<void> {
    if (this._driveIdsLoaded) return;
    const files = await this.drive.listFiles();
    for (const f of files) this._driveIds.set(f.name, f.id);
    this._driveIdsLoaded = true;
  }

  private _setState(state: DriveSyncState): void {
    this._status.state = state;
    this._notify();
  }

  private _setError(msg: string): void {
    this._status.state = 'error';
    this._status.lastError = msg;
    this._notify();
  }

  private _notify(): void {
    this._notifyWithFlag(false);
  }

  private _notifyWithFlag(stateChangedByRemote: boolean): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    const payload: DriveSyncStatus = { ...this._status, stateChangedByRemote };
    win.webContents.send(IPC.DRIVE_SYNC_STATUS_CHANGED, payload);
  }

  private _schedulePolling(): void {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      this._enqueue(() => this._doPull());
    }, POLL_INTERVAL_MS);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}

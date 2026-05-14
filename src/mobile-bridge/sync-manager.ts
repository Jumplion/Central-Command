import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { DriveSyncState, DriveSyncStatus } from '@shared/types';
import { DriveSync, DriveError } from './drive-sync';
import { invalidateCache, onFlushed as setKvFlushedCb } from './kv';
import { onWritten as setSqlWrittenCb, closeDb, reopenDb } from './sql';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const DRIVE_STATE_FILE = 'cc-state.json';

function driveKvName(widgetId: string): string {
  return `cc-kv-${widgetId}.json`;
}

function driveDbName(widgetId: string): string {
  return `cc-db-${widgetId}.db`;
}

function kvWidgetIdFromDriveName(name: string): string | null {
  if (!name.startsWith('cc-kv-') || !name.endsWith('.json')) return null;
  return name.slice('cc-kv-'.length, -'.json'.length);
}

function dbWidgetIdFromDriveName(name: string): string | null {
  if (!name.startsWith('cc-db-') || !name.endsWith('.db')) return null;
  return name.slice('cc-db-'.length, -'.db'.length);
}

type StatusListener = (status: DriveSyncStatus) => void;

export class MobileSyncManager {
  private _enabled = false;
  private _syncing = false;
  private _disposed = false;
  private _uploadPending = false;
  private _driveIds = new Map<string, string>();
  private _driveIdsLoaded = false;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _queue: Promise<void> = Promise.resolve();
  private _listeners = new Set<StatusListener>();
  private _pendingDbUploads = new Set<string>();

  private _status: DriveSyncStatus = {
    state: 'disabled',
    enabled: false,
    lastSyncedAt: null,
    lastError: null,
    stateChangedByRemote: false,
  };

  constructor(private drive: DriveSync) {
    // Hook into kv flush events
    setKvFlushedCb((widgetId) => this._onKvFlushed(widgetId));
    // Hook into sql write events
    setSqlWrittenCb((widgetId) => this._onSqlWritten(widgetId));
  }

  getStatus(): DriveSyncStatus {
    return { ...this._status };
  }

  onStatusChanged(cb: StatusListener): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
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

  private _onKvFlushed(widgetId: string): void {
    if (!this._enabled || this._syncing) return;
    this._uploadPending = true;
    this._enqueue(async () => {
      if (!this._uploadPending) return;
      this._uploadPending = false;
      await this._doUploadAll();
    });
  }

  private _onSqlWritten(widgetId: string): void {
    if (!this._enabled) return;
    this._pendingDbUploads.add(widgetId);
    this._enqueue(async () => {
      if (this._pendingDbUploads.size === 0) return;
      const ids = [...this._pendingDbUploads];
      this._pendingDbUploads.clear();
      for (const wId of ids) {
        await this._uploadDb(wId);
      }
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
      try {
        const { data } = await Filesystem.readFile({
          path: DRIVE_STATE_FILE,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        const knownId = this._driveIds.get(DRIVE_STATE_FILE);
        const newId = await this.drive.upsertFile(DRIVE_STATE_FILE, data as string, knownId);
        this._driveIds.set(DRIVE_STATE_FILE, newId);
      } catch {
        // file may not exist yet
      }

      // Upload cached widget KV stores
      try {
        const { files } = await Filesystem.readdir({
          path: 'widgets',
          directory: Directory.Data,
        });
        for (const entry of files) {
          const widgetId = entry.name;
          try {
            const { data } = await Filesystem.readFile({
              path: `widgets/${widgetId}/store.json`,
              directory: Directory.Data,
              encoding: Encoding.UTF8,
            });
            const driveName = driveKvName(widgetId);
            const knownId = this._driveIds.get(driveName);
            const newId = await this.drive.upsertFile(driveName, data as string, knownId);
            this._driveIds.set(driveName, newId);
          } catch {
            // no store.json for this widget
          }

          // Upload SQLite DB if it exists
          await this._uploadDb(widgetId);
        }
      } catch {
        // widgets directory may not exist yet
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
  }

  private async _uploadDb(widgetId: string): Promise<void> {
    try {
      // Capacitor returns base64 when no encoding is specified for binary files
      const { data } = await Filesystem.readFile({
        path: `widgets/${widgetId}/data.db`,
        directory: Directory.Data,
      });
      // Store as base64-encoded text — matches desktop's _uploadDb format
      const driveName = driveDbName(widgetId);
      const knownId = this._driveIds.get(driveName);
      const newId = await this.drive.upsertFile(driveName, data as string, knownId);
      this._driveIds.set(driveName, newId);
    } catch {
      // DB may not exist for this widget
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
          const localPath = DRIVE_STATE_FILE;
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const content = await this.drive.downloadFile(driveFile.id);
            await Filesystem.writeFile({
              path: localPath,
              directory: Directory.Data,
              data: content,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            stateChangedByRemote = true;
          }
          continue;
        }

        const kvWidgetId = kvWidgetIdFromDriveName(driveFile.name);
        if (kvWidgetId) {
          const localPath = `widgets/${kvWidgetId}/store.json`;
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const content = await this.drive.downloadFile(driveFile.id);
            await Filesystem.writeFile({
              path: localPath,
              directory: Directory.Data,
              data: content,
              encoding: Encoding.UTF8,
              recursive: true,
            });
            invalidateCache(kvWidgetId);
          }
          continue;
        }

        const dbWidgetId = dbWidgetIdFromDriveName(driveFile.name);
        if (dbWidgetId) {
          const localPath = `widgets/${dbWidgetId}/data.db`;
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            // Content is stored as base64-encoded text (matches desktop _uploadDb format)
            const base64 = await this.drive.downloadFile(driveFile.id);
            // Close existing connection before overwriting the file
            await closeDb(dbWidgetId);
            await Filesystem.writeFile({
              path: localPath,
              directory: Directory.Data,
              // Capacitor writes binary when data is base64 and no encoding is set
              data: base64,
              recursive: true,
            });
            // Reopen so subsequent widget reads work
            await reopenDb(dbWidgetId);
          }
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
      const stat = await Filesystem.stat({ path: localPath, directory: Directory.Data });
      const localMs = typeof stat.mtime === 'number' ? stat.mtime : Number(stat.mtime);
      return remoteMs > localMs;
    } catch {
      return true;
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
    const payload: DriveSyncStatus = { ...this._status, stateChangedByRemote };
    for (const cb of this._listeners) {
      try { cb(payload); } catch { /* ignore listener errors */ }
    }
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

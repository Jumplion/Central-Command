import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc';
import type { DriveSyncStatus } from '@shared/types';
import {
  SyncManagerBase, IDriveSync,
  DRIVE_STATE_FILE, driveKvName, driveDbName,
  kvWidgetIdFromDriveName, dbWidgetIdFromDriveName,
} from '@shared/sync-base';
import { DriveSync, DriveError } from './storage/drive';
import type { Storage } from './storage';

export class SyncManager extends SyncManagerBase {
  constructor(
    private drive: DriveSync,
    private storage: Storage,
    private getWindow: () => BrowserWindow | null
  ) {
    super();
    storage.onStateSaved = () => this._onKvFlushed('state');
    storage.json.onFlushed = (widgetId) => this._onKvFlushed(widgetId);
    storage.sqlite.onWritten = (widgetId) => this._onDbWritten(widgetId);
  }

  protected _drive(): IDriveSync { return this.drive; }

  protected async _doUploadAll(): Promise<void> {
    this._syncing = true;
    this._setState('uploading');

    try {
      await this._ensureDriveIds();

      const widgetIds = this.storage.json.getCachedWidgetIds();

      // Upload state file and all KV stores concurrently
      const uploadKv = async (widgetId: string): Promise<void> => {
        const kvFile = path.join(this.storage.root, 'widgets', widgetId, 'store.json');
        const driveName = driveKvName(widgetId);
        try {
          const content = await fs.readFile(kvFile, 'utf-8');
          const newId = await this.drive.upsertFile(driveName, content, this._driveIds.get(driveName));
          this._driveIds.set(driveName, newId);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
      };

      const uploadState = async (): Promise<void> => {
        const stateFile = path.join(this.storage.root, 'state.json');
        try {
          const content = await fs.readFile(stateFile, 'utf-8');
          const newId = await this.drive.upsertFile(DRIVE_STATE_FILE, content, this._driveIds.get(DRIVE_STATE_FILE));
          this._driveIds.set(DRIVE_STATE_FILE, newId);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
      };

      await Promise.all([uploadState(), ...widgetIds.map(uploadKv)]);

      // Upload SQLite DBs concurrently (each uses its own backup file)
      await Promise.all(widgetIds.map((id) => this._uploadDb(id)));

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

  protected async _uploadDb(widgetId: string): Promise<void> {
    const dbPath = path.join(this.storage.root, 'widgets', widgetId, 'data.db');
    try {
      await fs.access(dbPath);
    } catch {
      return;
    }
    const backupPath = dbPath + '.sync-backup';
    try {
      await this.storage.sqlite.backup(widgetId, backupPath);
      const content = await fs.readFile(backupPath);
      const base64 = content.toString('base64');
      const driveName = driveDbName(widgetId);
      const knownId = this._driveIds.get(driveName);
      const newId = await this.drive.upsertFile(driveName, base64, knownId);
      this._driveIds.set(driveName, newId);
    } finally {
      fs.unlink(backupPath).catch(() => {});
    }
  }

  protected async _doPull(): Promise<void> {
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

        const kvWidgetId = kvWidgetIdFromDriveName(driveFile.name);
        if (kvWidgetId) {
          const localPath = path.join(this.storage.root, 'widgets', kvWidgetId, 'store.json');
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const content = await this.drive.downloadFile(driveFile.id);
            const tmp = localPath + '.tmp';
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await fs.writeFile(tmp, content, 'utf-8');
            await fs.rename(tmp, localPath);
            this.storage.json.invalidateCache(kvWidgetId);
          }
          continue;
        }

        const dbWidgetId = dbWidgetIdFromDriveName(driveFile.name);
        if (dbWidgetId) {
          const localPath = path.join(this.storage.root, 'widgets', dbWidgetId, 'data.db');
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const base64 = await this.drive.downloadFile(driveFile.id);
            const content = Buffer.from(base64, 'base64');
            const tmp = localPath + '.tmp';
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await fs.writeFile(tmp, content);
            await fs.rename(tmp, localPath);
            this.storage.sqlite.closeDb(dbWidgetId);
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

  protected async _isRemoteNewer(localPath: string, remoteMs: number): Promise<boolean> {
    try {
      const stat = await fs.stat(localPath);
      return remoteMs > stat.mtimeMs;
    } catch {
      return true;
    }
  }

  protected _notifyWithFlag(stateChangedByRemote: boolean): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    const payload: DriveSyncStatus = { ...this._status, stateChangedByRemote };
    win.webContents.send(IPC.DRIVE_SYNC_STATUS_CHANGED, payload);
  }
}

import { Filesystem, Directory } from '@capacitor/filesystem';
import type { DriveSyncStatus } from '@shared/types';
import {
  SyncManagerBase, IDriveSync,
  DRIVE_STATE_FILE, driveKvName, driveDbName,
  kvWidgetIdFromDriveName, dbWidgetIdFromDriveName,
} from '@shared/sync-base';
import { DriveSync, DriveError } from './drive-sync';
import { kvApi, onFlushed as setKvFlushedCb } from './kv';
import { stateApi } from './state';
import { onWritten as setSqlWrittenCb, closeDb, reopenDb } from './sql';

type StatusListener = (status: DriveSyncStatus) => void;

export class MobileSyncManager extends SyncManagerBase {
  private _listeners = new Set<StatusListener>();

  constructor(private drive: DriveSync) {
    super();
    setKvFlushedCb((widgetId) => this._onKvFlushed(widgetId));
    setSqlWrittenCb((widgetId) => this._onDbWritten(widgetId));
  }

  onStatusChanged(cb: StatusListener): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  protected _drive(): IDriveSync { return this.drive; }

  protected async _doUploadAll(): Promise<void> {
    this._syncing = true;
    this._setState('uploading');

    try {
      await this._ensureDriveIds();

      const stateJson = stateApi.exportJson();
      if (stateJson !== null) {
        const knownId = this._driveIds.get(DRIVE_STATE_FILE);
        const newId = await this.drive.upsertFile(DRIVE_STATE_FILE, stateJson, knownId);
        this._driveIds.set(DRIVE_STATE_FILE, newId);
      }

      for (const widgetId of kvApi.widgetIds()) {
        const kvJson = kvApi.exportJson(widgetId);
        if (kvJson !== null) {
          const driveName = driveKvName(widgetId);
          const knownId = this._driveIds.get(driveName);
          const newId = await this.drive.upsertFile(driveName, kvJson, knownId);
          this._driveIds.set(driveName, newId);
        }
      }

      try {
        const { files } = await Filesystem.readdir({ path: 'widgets', directory: Directory.Data });
        for (const entry of files) {
          await this._uploadDb(entry.name);
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

  protected async _uploadDb(widgetId: string): Promise<void> {
    try {
      const { data } = await Filesystem.readFile({
        path: `widgets/${widgetId}/data.db`,
        directory: Directory.Data,
      });
      const driveName = driveDbName(widgetId);
      const knownId = this._driveIds.get(driveName);
      const newId = await this.drive.upsertFile(driveName, data as string, knownId);
      this._driveIds.set(driveName, newId);
    } catch {
      // DB may not exist for this widget
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
          if (remoteMs > stateApi.getLastModified()) {
            const content = await this.drive.downloadFile(driveFile.id);
            stateApi.importJson(content);
            stateChangedByRemote = true;
          }
          continue;
        }

        const kvWidgetId = kvWidgetIdFromDriveName(driveFile.name);
        if (kvWidgetId) {
          if (remoteMs > kvApi.getLastModified(kvWidgetId)) {
            const content = await this.drive.downloadFile(driveFile.id);
            kvApi.importJson(kvWidgetId, content);
          }
          continue;
        }

        const dbWidgetId = dbWidgetIdFromDriveName(driveFile.name);
        if (dbWidgetId) {
          const localPath = `widgets/${dbWidgetId}/data.db`;
          if (await this._isRemoteNewer(localPath, remoteMs)) {
            const base64 = await this.drive.downloadFile(driveFile.id);
            await closeDb(dbWidgetId);
            await Filesystem.writeFile({
              path: localPath,
              directory: Directory.Data,
              data: base64,
              recursive: true,
            });
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

  protected async _isRemoteNewer(localPath: string, remoteMs: number): Promise<boolean> {
    try {
      const stat = await Filesystem.stat({ path: localPath, directory: Directory.Data });
      const localMs = typeof stat.mtime === 'number' ? stat.mtime : Number(stat.mtime);
      return remoteMs > localMs;
    } catch {
      return true;
    }
  }

  protected _notifyWithFlag(stateChangedByRemote: boolean): void {
    const payload: DriveSyncStatus = { ...this._status, stateChangedByRemote };
    for (const cb of this._listeners) {
      try { cb(payload); } catch { /* ignore listener errors */ }
    }
  }
}

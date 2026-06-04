import type { DriveSyncState, DriveSyncStatus } from "./types";

export const SYNC_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const DRIVE_STATE_FILE = "cc-state.json";

export function driveKvName(widgetId: string): string {
  return `cc-kv-${widgetId}.json`;
}

export function driveDbName(widgetId: string): string {
  return `cc-db-${widgetId}.db`;
}

export function kvWidgetIdFromDriveName(name: string): string | null {
  if (!name.startsWith("cc-kv-") || !name.endsWith(".json")) return null;
  return name.slice("cc-kv-".length, -".json".length);
}

export function dbWidgetIdFromDriveName(name: string): string | null {
  if (!name.startsWith("cc-db-") || !name.endsWith(".db")) return null;
  return name.slice("cc-db-".length, -".db".length);
}

/** Minimal interface both DriveSync implementations satisfy. */
export interface IDriveSync {
  isConnected(): Promise<boolean>;
  listFiles(): Promise<
    Array<{ id: string; name: string; modifiedTime: string }>
  >;
  downloadFile(fileId: string): Promise<string>;
  upsertFile(name: string, content: string, knownId?: string): Promise<string>;
}

export abstract class SyncManagerBase {
  protected _enabled = false;
  protected _syncing = false;
  protected _disposed = false;
  protected _uploadPending = false;
  protected _pendingDbUploads = new Set<string>();
  protected _driveIds = new Map<string, string>();
  protected _driveIdsLoaded = false;
  protected _pollTimer: ReturnType<typeof setInterval> | null = null;
  protected _queue: Promise<void> = Promise.resolve();
  protected _status: DriveSyncStatus = {
    state: "disabled",
    enabled: false,
    lastSyncedAt: null,
    lastError: null,
    stateChangedByRemote: false,
  };

  getStatus(): DriveSyncStatus {
    return { ...this._status };
  }

  enable(): void {
    this._enabled = true;
    this._setState("idle");
    this._status.enabled = true;
    this._notify();
    this._schedulePolling();
    this._enqueue(() => this._doPull());
  }

  disable(): void {
    this._enabled = false;
    this._stopPolling();
    this._setState("disabled");
    this._status.enabled = false;
    this._notify();
  }

  async forcePush(): Promise<void> {
    this._enqueue(async () => {
      await this._doUploadAll();
    });
    return this._queue;
  }

  async forcePull(): Promise<void> {
    this._enqueue(async () => {
      await this._doPull();
    });
    return this._queue;
  }

  async initialSync(): Promise<void> {
    const connected = await this._drive().isConnected();
    if (!connected) return;
    this.enable();
  }

  dispose(): void {
    this._disposed = true;
    this._stopPolling();
  }

  protected _onKvFlushed(_widgetId: string): void {
    if (!this._enabled || this._syncing) return;
    this._uploadPending = true;
    this._enqueue(async () => {
      if (!this._uploadPending) return;
      this._uploadPending = false;
      await this._doUploadAll();
    });
  }

  protected _onDbWritten(widgetId: string): void {
    if (!this._enabled) return;
    this._pendingDbUploads.add(widgetId);
    this._enqueue(async () => {
      if (this._pendingDbUploads.size === 0) return;
      const ids = [...this._pendingDbUploads];
      this._pendingDbUploads.clear();
      await Promise.all(ids.map((wId) => this._uploadDb(wId)));
    });
  }

  protected _enqueue(task: () => Promise<void>): void {
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

  protected async _ensureDriveIds(): Promise<void> {
    if (this._driveIdsLoaded) return;
    const files = await this._drive().listFiles();
    for (const f of files) this._driveIds.set(f.name, f.id);
    this._driveIdsLoaded = true;
  }

  protected _setState(state: DriveSyncState): void {
    this._status.state = state;
    this._notify();
  }

  protected _setError(msg: string): void {
    this._status.state = "error";
    this._status.lastError = msg;
    this._notify();
  }

  protected _notify(): void {
    this._notifyWithFlag(false);
  }

  protected _schedulePolling(): void {
    this._stopPolling();
    this._pollTimer = setInterval(() => {
      this._enqueue(() => this._doPull());
    }, SYNC_POLL_INTERVAL_MS);
  }

  protected _stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /** Return the drive instance for this platform. */
  protected abstract _drive(): IDriveSync;
  protected abstract _doUploadAll(): Promise<void>;
  protected abstract _doPull(): Promise<void>;
  protected abstract _uploadDb(widgetId: string): Promise<void>;
  protected abstract _isRemoteNewer(
    localPath: string,
    remoteMs: number,
  ): Promise<boolean>;
  protected abstract _notifyWithFlag(stateChangedByRemote: boolean): void;
}

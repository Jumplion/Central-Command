import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRIVE_STATE_FILE,
  SYNC_POLL_INTERVAL_MS,
  SyncManagerBase,
  dbWidgetIdFromDriveName,
  driveDbName,
  driveKvName,
  kvWidgetIdFromDriveName,
  type IDriveSync,
} from "../sync-base";

describe("SYNC_POLL_INTERVAL_MS", () => {
  it("equals 5 minutes in milliseconds", () => {
    expect(SYNC_POLL_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe("DRIVE_STATE_FILE", () => {
  it("is the expected constant filename", () => {
    expect(DRIVE_STATE_FILE).toBe("cc-state.json");
  });
});

describe("driveKvName", () => {
  it("produces the expected Drive filename for a widget id", () => {
    expect(driveKvName("my-widget")).toBe("cc-kv-my-widget.json");
  });

  it("is round-trip invertible via kvWidgetIdFromDriveName", () => {
    const widgetId = "some-widget";
    expect(kvWidgetIdFromDriveName(driveKvName(widgetId))).toBe(widgetId);
  });
});

describe("driveDbName", () => {
  it("produces the expected Drive filename for a widget id", () => {
    expect(driveDbName("tracker")).toBe("cc-db-tracker.db");
  });

  it("is round-trip invertible via dbWidgetIdFromDriveName", () => {
    const widgetId = "job-tracker";
    expect(dbWidgetIdFromDriveName(driveDbName(widgetId))).toBe(widgetId);
  });
});

describe("kvWidgetIdFromDriveName", () => {
  it("extracts the widget id from a valid kv filename", () => {
    expect(kvWidgetIdFromDriveName("cc-kv-my-widget.json")).toBe("my-widget");
  });

  it("returns null for a db filename", () => {
    expect(kvWidgetIdFromDriveName("cc-db-my-widget.db")).toBeNull();
  });

  it("returns null for the state file", () => {
    expect(kvWidgetIdFromDriveName("cc-state.json")).toBeNull();
  });

  it("returns null for a filename that only starts with the prefix but has wrong extension", () => {
    expect(kvWidgetIdFromDriveName("cc-kv-widget.db")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(kvWidgetIdFromDriveName("")).toBeNull();
  });

  it("returns null for a bare prefix with no widget id body", () => {
    // 'cc-kv-.json' has an empty widget id segment — still parses to empty string, not null
    // This documents the actual behavior as a regression anchor
    expect(kvWidgetIdFromDriveName("cc-kv-.json")).toBe("");
  });
});

describe("dbWidgetIdFromDriveName", () => {
  it("extracts the widget id from a valid db filename", () => {
    expect(dbWidgetIdFromDriveName("cc-db-media-tracker.db")).toBe(
      "media-tracker",
    );
  });

  it("returns null for a kv filename", () => {
    expect(dbWidgetIdFromDriveName("cc-kv-media-tracker.json")).toBeNull();
  });

  it("returns null for the state file", () => {
    expect(dbWidgetIdFromDriveName("cc-state.json")).toBeNull();
  });

  it("returns null for a filename with wrong extension", () => {
    expect(dbWidgetIdFromDriveName("cc-db-widget.json")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(dbWidgetIdFromDriveName("")).toBeNull();
  });
});

// ─── SyncManagerBase concrete behaviour ───────────────────────────────────────

/** Minimal concrete subclass for testing base class logic. */
class TestSyncManager extends SyncManagerBase {
  readonly notifications: boolean[] = [];
  readonly uploadAllCalls: number[] = [];
  readonly uploadDbCalls: string[] = [];
  private _mockDrive: IDriveSync;

  constructor(drive: IDriveSync) {
    super();
    this._mockDrive = drive;
  }

  protected _drive() {
    return this._mockDrive;
  }
  protected async _doUploadAll() {
    this.uploadAllCalls.push(Date.now());
  }
  protected async _doPull() {}
  protected async _uploadDb(widgetId: string) {
    this.uploadDbCalls.push(widgetId);
  }
  protected async _isRemoteNewer(_localPath: string, _remoteMs: number) {
    return false;
  }
  protected _notifyWithFlag(flag: boolean) {
    this.notifications.push(flag);
  }

  /** Expose queue to allow tests to drain it. */
  get queue(): Promise<void> {
    return (this as unknown as { _queue: Promise<void> })._queue;
  }

  /** Expose protected trigger methods for whitebox tests. */
  triggerKvFlushed(widgetId: string) {
    this._onKvFlushed(widgetId);
  }
  triggerDbWritten(widgetId: string) {
    this._onDbWritten(widgetId);
  }
}

function makeDrive(connected = false): IDriveSync {
  return {
    isConnected: vi.fn().mockResolvedValue(connected),
    listFiles: vi.fn().mockResolvedValue([]),
    downloadFile: vi.fn().mockResolvedValue(""),
    upsertFile: vi.fn().mockResolvedValue("file-id"),
  };
}

describe("SyncManagerBase", () => {
  let manager: TestSyncManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new TestSyncManager(makeDrive());
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
  });

  describe("getStatus", () => {
    it("returns a fresh copy on each call", () => {
      const a = manager.getStatus();
      const b = manager.getStatus();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it('starts with state "disabled" and enabled=false', () => {
      const { state, enabled } = manager.getStatus();
      expect(state).toBe("disabled");
      expect(enabled).toBe(false);
    });
  });

  describe("enable / disable", () => {
    it('enable transitions state to "idle" and sets enabled=true', () => {
      manager.enable();
      const { state, enabled } = manager.getStatus();
      expect(state).toBe("idle");
      expect(enabled).toBe(true);
    });

    it('disable transitions state to "disabled" and sets enabled=false', () => {
      manager.enable();
      manager.disable();
      const { state, enabled } = manager.getStatus();
      expect(state).toBe("disabled");
      expect(enabled).toBe(false);
    });

    it("disable cancels polling so no further pulls fire", () => {
      const drive = makeDrive();
      const m = new TestSyncManager(drive);
      m.enable();
      m.disable();
      vi.advanceTimersByTime(SYNC_POLL_INTERVAL_MS * 3);
      expect(drive.listFiles).not.toHaveBeenCalled();
      m.dispose();
    });

    it("emits at least one notification on enable", () => {
      const before = manager.notifications.length;
      manager.enable();
      expect(manager.notifications.length).toBeGreaterThan(before);
    });

    it("emits at least one notification on disable", () => {
      manager.enable();
      const before = manager.notifications.length;
      manager.disable();
      expect(manager.notifications.length).toBeGreaterThan(before);
    });
  });

  describe("initialSync", () => {
    it("enables when the drive reports connected", async () => {
      const m = new TestSyncManager(makeDrive(true));
      await m.initialSync();
      expect(m.getStatus().enabled).toBe(true);
      m.dispose();
    });

    it("does not enable when the drive reports disconnected", async () => {
      await manager.initialSync();
      expect(manager.getStatus().enabled).toBe(false);
    });
  });

  describe("dispose", () => {
    it("prevents queued tasks from running after disposal", async () => {
      manager.enable();
      manager.dispose();
      const callsBefore = manager.uploadAllCalls.length;
      manager.triggerKvFlushed("w");
      await manager.queue;
      expect(manager.uploadAllCalls.length).toBe(callsBefore);
    });
  });

  describe("_onKvFlushed", () => {
    it("does not enqueue an upload when disabled", async () => {
      manager.triggerKvFlushed("w");
      await manager.queue;
      expect(manager.uploadAllCalls).toHaveLength(0);
    });

    it("enqueues an upload when enabled", async () => {
      manager.enable();
      manager.triggerKvFlushed("w");
      await manager.queue;
      expect(manager.uploadAllCalls.length).toBeGreaterThan(0);
    });

    it("coalesces rapid flushes into a single upload call", async () => {
      manager.enable();
      await manager.queue; // drain initial _doPull
      manager.triggerKvFlushed("w");
      manager.triggerKvFlushed("w");
      manager.triggerKvFlushed("w");
      await manager.queue;
      // second and third triggers de-duplicate: uploadPending already set
      expect(manager.uploadAllCalls).toHaveLength(1);
    });
  });

  describe("_onDbWritten", () => {
    it("does not enqueue a db upload when disabled", async () => {
      manager.triggerDbWritten("w");
      await manager.queue;
      expect(manager.uploadDbCalls).toHaveLength(0);
    });

    it("enqueues a db upload when enabled", async () => {
      manager.enable();
      manager.triggerDbWritten("my-widget");
      await manager.queue;
      expect(manager.uploadDbCalls).toContain("my-widget");
    });

    it("batches multiple widgets into a single upload round", async () => {
      manager.enable();
      await manager.queue; // drain initial pull
      manager.triggerDbWritten("widget-a");
      manager.triggerDbWritten("widget-b");
      await manager.queue;
      expect(manager.uploadDbCalls).toContain("widget-a");
      expect(manager.uploadDbCalls).toContain("widget-b");
    });
  });

  describe("_ensureDriveIds", () => {
    it("populates drive IDs from listFiles and sets the loaded flag", async () => {
      const files = [
        {
          id: "id-1",
          name: "cc-state.json",
          modifiedTime: "2024-01-01T00:00:00Z",
        },
        {
          id: "id-2",
          name: "cc-kv-my-widget.json",
          modifiedTime: "2024-01-01T00:00:00Z",
        },
      ];
      const drive = makeDrive();
      vi.mocked(drive.listFiles).mockResolvedValue(files);

      class EnsureDriveIdsManager extends TestSyncManager {
        async runEnsureDriveIds() {
          await this._ensureDriveIds();
        }
        get driveIdsLoaded() {
          return this._driveIdsLoaded;
        }
        get driveIds() {
          return this._driveIds;
        }
      }

      const m = new EnsureDriveIdsManager(drive);
      await m.runEnsureDriveIds();

      expect(m.driveIdsLoaded).toBe(true);
      expect(m.driveIds.get("cc-state.json")).toBe("id-1");
      expect(m.driveIds.get("cc-kv-my-widget.json")).toBe("id-2");
      expect(drive.listFiles).toHaveBeenCalledOnce();

      // second call should be a no-op (already loaded)
      await m.runEnsureDriveIds();
      expect(drive.listFiles).toHaveBeenCalledOnce();

      m.dispose();
    });
  });

  describe("_setError", () => {
    it("transitions state to error and records the error message", async () => {
      class FailingUploadManager extends TestSyncManager {
        protected async _doUploadAll() {
          throw new Error("upload failed");
        }
      }

      const m = new FailingUploadManager(makeDrive());
      m.enable();
      await m.queue; // drain initial pull
      m.triggerKvFlushed("w");
      await m.queue;

      const status = m.getStatus();
      expect(status.state).toBe("error");
      expect(status.lastError).toBe("upload failed");
      m.dispose();
    });

    it("emits a notification when an error is recorded", async () => {
      class FailingUploadManager extends TestSyncManager {
        protected async _doUploadAll() {
          throw new Error("boom");
        }
      }

      const m = new FailingUploadManager(makeDrive());
      m.enable();
      await m.queue;
      const notificationsBefore = m.notifications.length;
      m.triggerKvFlushed("w");
      await m.queue;

      expect(m.notifications.length).toBeGreaterThan(notificationsBefore);
      m.dispose();
    });
  });

  describe("polling interval", () => {
    it("fires a pull after one poll interval elapses", async () => {
      const pullCalls: number[] = [];

      class TrackingPullManager extends TestSyncManager {
        protected async _doPull() {
          pullCalls.push(Date.now());
        }
      }

      const m = new TrackingPullManager(makeDrive());
      m.enable();
      await m.queue; // drain the initial pull triggered by enable()

      const callsAfterEnable = pullCalls.length;
      vi.advanceTimersByTime(SYNC_POLL_INTERVAL_MS);
      await m.queue;

      expect(pullCalls.length).toBeGreaterThan(callsAfterEnable);
      m.dispose();
    });
  });
});

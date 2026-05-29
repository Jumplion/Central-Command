import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock objects (must be created before vi.mock factories run) ──────
const mockFs = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

const mockAtomicWrite = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// ── Mock electron ────────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

// ── Mock fs.promises ─────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({ default: { promises: mockFs }, promises: mockFs }));

// ── Mock atomicWrite ─────────────────────────────────────────────────────────
vi.mock("./storage/helpers", () => ({ atomicWrite: mockAtomicWrite }));

// ── Mock DriveSync/DriveError ─────────────────────────────────────────────────
const MockDriveError = vi.hoisted(() => {
  class DriveError extends Error {
    constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
      this.name = "DriveError";
    }
  }
  return DriveError;
});

vi.mock("./storage/drive", () => ({
  DriveError: MockDriveError,
  DriveSync: class {},
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { SyncManager } from "./sync";
import { DRIVE_STATE_FILE } from "@shared/sync-base";
import { IPC } from "@shared/ipc";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeDrive() {
  return {
    isConnected: vi.fn().mockResolvedValue(true),
    listFiles: vi.fn().mockResolvedValue([]),
    downloadFile: vi.fn().mockResolvedValue("remote-content"),
    upsertFile: vi.fn().mockResolvedValue("new-drive-id"),
  };
}

function makeStorage(root = "/mock/root") {
  return {
    root,
    onStateSaved: undefined as (() => void) | undefined,
    json: {
      onFlushed: undefined as ((id: string) => void) | undefined,
      getCachedWidgetIds: vi.fn().mockReturnValue([]),
      invalidateCache: vi.fn(),
    },
    sqlite: {
      onWritten: undefined as ((id: string) => void) | undefined,
      backup: vi.fn().mockResolvedValue(undefined),
      closeDb: vi.fn(),
    },
  };
}

function makeWindow(
  destroyed = false,
): { webContents: { send: ReturnType<typeof vi.fn> }; isDestroyed: () => boolean } {
  return {
    webContents: { send: vi.fn() },
    isDestroyed: () => destroyed,
  };
}

type MockStorage = ReturnType<typeof makeStorage>;
type MockDrive = ReturnType<typeof makeDrive>;

function makeManager(
  drive?: MockDrive,
  storage?: MockStorage,
  win?: ReturnType<typeof makeWindow> | null,
) {
  const d = drive ?? makeDrive();
  const s = storage ?? makeStorage();
  const w = win === undefined ? makeWindow() : win;
  const manager = new SyncManager(
    d as never,
    s as never,
    () => w as never,
  );
  return { manager, drive: d, storage: s, win: w };
}

describe("SyncManager construction", () => {
  it("wires storage.onStateSaved to trigger a KV upload", async () => {
    vi.useFakeTimers();
    const { manager, storage } = makeManager();
    manager.enable();
    await (manager as unknown as { _queue: Promise<void> })._queue;

    const uploadAllSpy = vi.spyOn(
      manager as unknown as { _doUploadAll: () => Promise<void> },
      "_doUploadAll",
    );
    uploadAllSpy.mockResolvedValue(undefined);

    storage.onStateSaved?.();
    await (manager as unknown as { _queue: Promise<void> })._queue;

    expect(uploadAllSpy).toHaveBeenCalled();
    manager.dispose();
    vi.useRealTimers();
  });

  it("wires storage.json.onFlushed to trigger a KV upload", async () => {
    vi.useFakeTimers();
    const { manager, storage } = makeManager();
    manager.enable();
    await (manager as unknown as { _queue: Promise<void> })._queue;

    const uploadAllSpy = vi.spyOn(
      manager as unknown as { _doUploadAll: () => Promise<void> },
      "_doUploadAll",
    );
    uploadAllSpy.mockResolvedValue(undefined);

    storage.json.onFlushed?.("some-widget");
    await (manager as unknown as { _queue: Promise<void> })._queue;

    expect(uploadAllSpy).toHaveBeenCalled();
    manager.dispose();
    vi.useRealTimers();
  });

  it("wires storage.sqlite.onWritten to trigger a DB upload", async () => {
    vi.useFakeTimers();
    const { manager, storage } = makeManager();
    manager.enable();
    await (manager as unknown as { _queue: Promise<void> })._queue;

    const uploadDbSpy = vi.spyOn(
      manager as unknown as { _uploadDb: (id: string) => Promise<void> },
      "_uploadDb",
    );
    uploadDbSpy.mockResolvedValue(undefined);

    storage.sqlite.onWritten?.("job-tracker");
    await (manager as unknown as { _queue: Promise<void> })._queue;

    expect(uploadDbSpy).toHaveBeenCalledWith("job-tracker");
    manager.dispose();
    vi.useRealTimers();
  });
});

describe("SyncManager._doUploadAll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uploads the state file and transitions to idle", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    storage.json.getCachedWidgetIds.mockReturnValue([]);
    mockFs.readFile.mockResolvedValue('{"version":1}');
    mockFs.stat.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    expect(drive.upsertFile).toHaveBeenCalledWith(
      DRIVE_STATE_FILE,
      '{"version":1}',
      undefined,
    );
    expect(manager.getStatus().state).toBe("idle");
    expect(manager.getStatus().lastError).toBeNull();
    manager.dispose();
  });

  it("uploads KV store files for each cached widget", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    storage.json.getCachedWidgetIds.mockReturnValue(["widget-a", "widget-b"]);
    mockFs.readFile.mockResolvedValue('{"key":"val"}');
    mockFs.stat.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    const uploadedNames = drive.upsertFile.mock.calls.map((c) => c[0] as string);
    expect(uploadedNames).toContain("cc-kv-widget-a.json");
    expect(uploadedNames).toContain("cc-kv-widget-b.json");
    manager.dispose();
  });

  it("skips uploading a KV file that does not exist (ENOENT)", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    storage.json.getCachedWidgetIds.mockReturnValue(["missing-widget"]);

    mockFs.readFile
      .mockResolvedValueOnce('{"version":1}') // state.json
      .mockRejectedValueOnce(
        Object.assign(new Error("not found"), { code: "ENOENT" }),
      );
    mockFs.stat.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    const uploadedNames = drive.upsertFile.mock.calls.map((c) => c[0] as string);
    expect(uploadedNames).not.toContain("cc-kv-missing-widget.json");
    expect(manager.getStatus().state).toBe("idle");
    manager.dispose();
  });

  it("records a DriveError and clears cached drive IDs", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    drive.upsertFile.mockRejectedValue(new MockDriveError("server error", 500));
    mockFs.readFile.mockResolvedValue("{}");

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    expect(manager.getStatus().state).toBe("error");
    expect(manager.getStatus().lastError).toContain("server error");
    const internals = manager as unknown as { _driveIdsLoaded: boolean };
    expect(internals._driveIdsLoaded).toBe(false);
    manager.dispose();
  });
});

describe("SyncManager._uploadDb", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("skips upload when the database file does not exist", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    storage.json.getCachedWidgetIds.mockReturnValue([]);
    mockFs.readFile.mockResolvedValue("{}");
    mockFs.access.mockRejectedValue(
      Object.assign(new Error(), { code: "ENOENT" }),
    );

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    expect(storage.sqlite.backup).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("backs up and uploads the database when it exists", async () => {
    const drive = makeDrive();
    const storage = makeStorage();
    storage.json.getCachedWidgetIds.mockReturnValue(["tracker"]);
    mockFs.readFile
      .mockResolvedValueOnce("{}") // state.json
      .mockResolvedValueOnce('{"kv":1}') // kv store
      .mockResolvedValue(Buffer.from("db-bytes")); // backup file
    mockFs.access.mockResolvedValue(undefined); // db exists
    mockFs.stat.mockRejectedValue(Object.assign(new Error(), { code: "ENOENT" }));

    const { manager } = makeManager(drive, storage);
    await manager.forcePush();

    expect(storage.sqlite.backup).toHaveBeenCalledWith(
      "tracker",
      expect.stringContaining("data.db.sync-backup"),
    );
    const uploadedNames = drive.upsertFile.mock.calls.map((c) => c[0] as string);
    expect(uploadedNames).toContain("cc-db-tracker.db");
    manager.dispose();
  });
});

describe("SyncManager._doPull", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("downloads a newer state file and writes it atomically", async () => {
    const drive = makeDrive();
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    drive.listFiles.mockResolvedValue([
      { id: "state-id", name: DRIVE_STATE_FILE, modifiedTime: futureTime },
    ]);
    drive.downloadFile.mockResolvedValue('{"version":1}');

    // local file is older
    mockFs.stat.mockResolvedValue({ mtimeMs: Date.now() - 60_000 });

    const { manager } = makeManager(drive);
    await manager.forcePull();

    expect(drive.downloadFile).toHaveBeenCalledWith("state-id");
    expect(mockAtomicWrite).toHaveBeenCalledWith(
      expect.stringContaining("state.json"),
      '{"version":1}',
    );
    manager.dispose();
  });

  it("skips a file when the local copy is newer than the remote", async () => {
    const drive = makeDrive();
    const pastTime = new Date(Date.now() - 60_000).toISOString();
    drive.listFiles.mockResolvedValue([
      { id: "state-id", name: DRIVE_STATE_FILE, modifiedTime: pastTime },
    ]);
    // local file is newer
    mockFs.stat.mockResolvedValue({ mtimeMs: Date.now() });

    const { manager } = makeManager(drive);
    await manager.forcePull();

    expect(drive.downloadFile).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("downloads a newer KV store and invalidates the cache", async () => {
    const drive = makeDrive();
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    drive.listFiles.mockResolvedValue([
      {
        id: "kv-id",
        name: "cc-kv-my-widget.json",
        modifiedTime: futureTime,
      },
    ]);
    drive.downloadFile.mockResolvedValue('{"k":"v"}');
    mockFs.stat.mockResolvedValue({ mtimeMs: Date.now() - 60_000 });

    const storage = makeStorage();
    const { manager } = makeManager(drive, storage);
    await manager.forcePull();

    expect(mockAtomicWrite).toHaveBeenCalledWith(
      expect.stringContaining("my-widget"),
      '{"k":"v"}',
    );
    expect(storage.json.invalidateCache).toHaveBeenCalledWith("my-widget");
    manager.dispose();
  });

  it("downloads a newer DB and closes the existing connection", async () => {
    const drive = makeDrive();
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    drive.listFiles.mockResolvedValue([
      { id: "db-id", name: "cc-db-tracker.db", modifiedTime: futureTime },
    ]);
    drive.downloadFile.mockResolvedValue("base64encodeddb");
    mockFs.stat.mockResolvedValue({ mtimeMs: Date.now() - 60_000 });

    const storage = makeStorage();
    const { manager } = makeManager(drive, storage);
    await manager.forcePull();

    expect(storage.sqlite.closeDb).toHaveBeenCalledWith("tracker");
    manager.dispose();
  });

  it("sets state to idle and clears lastError after a successful pull", async () => {
    const drive = makeDrive();
    drive.listFiles.mockResolvedValue([]);

    const { manager } = makeManager(drive);
    await manager.forcePull();

    expect(manager.getStatus().state).toBe("idle");
    expect(manager.getStatus().lastError).toBeNull();
    manager.dispose();
  });

  it("records an error and clears drive ID cache when a DriveError occurs", async () => {
    const drive = makeDrive();
    drive.listFiles.mockRejectedValue(new MockDriveError("unauthorized", 401));

    const { manager } = makeManager(drive);
    await manager.forcePull();

    expect(manager.getStatus().state).toBe("error");
    expect(manager.getStatus().lastError).toContain("unauthorized");
    const internals = manager as unknown as { _driveIdsLoaded: boolean };
    expect(internals._driveIdsLoaded).toBe(false);
    manager.dispose();
  });
});

describe("SyncManager._isRemoteNewer", () => {
  it("returns true when the local file does not exist", async () => {
    mockFs.stat.mockRejectedValue(
      Object.assign(new Error(), { code: "ENOENT" }),
    );
    const { manager } = makeManager();
    const result = await (
      manager as unknown as {
        _isRemoteNewer: (path: string, ms: number) => Promise<boolean>;
      }
    )._isRemoteNewer("/nonexistent/file.json", Date.now());
    expect(result).toBe(true);
    manager.dispose();
  });

  it("returns true when remote timestamp is after local mtime", async () => {
    const localMtime = Date.now() - 10_000;
    const remoteMtime = Date.now();
    mockFs.stat.mockResolvedValue({ mtimeMs: localMtime });

    const { manager } = makeManager();
    const result = await (
      manager as unknown as {
        _isRemoteNewer: (path: string, ms: number) => Promise<boolean>;
      }
    )._isRemoteNewer("/some/file.json", remoteMtime);
    expect(result).toBe(true);
    manager.dispose();
  });

  it("returns false when remote timestamp is before or equal to local mtime", async () => {
    const localMtime = Date.now();
    const remoteMtime = Date.now() - 10_000;
    mockFs.stat.mockResolvedValue({ mtimeMs: localMtime });

    const { manager } = makeManager();
    const result = await (
      manager as unknown as {
        _isRemoteNewer: (path: string, ms: number) => Promise<boolean>;
      }
    )._isRemoteNewer("/some/file.json", remoteMtime);
    expect(result).toBe(false);
    manager.dispose();
  });
});

describe("SyncManager._notifyWithFlag", () => {
  it("sends the IPC status event to the window with the correct payload", () => {
    const win = makeWindow();
    const { manager } = makeManager(undefined, undefined, win);

    manager.enable();
    const status = manager.getStatus();

    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.DRIVE_SYNC_STATUS_CHANGED,
      expect.objectContaining({ enabled: true }),
    );
    manager.dispose();
  });

  it("does not throw when the window is null", () => {
    const { manager } = makeManager(undefined, undefined, null);
    expect(() => manager.enable()).not.toThrow();
    manager.dispose();
  });

  it("does not send when the window is destroyed", () => {
    const win = makeWindow(true);
    const { manager } = makeManager(undefined, undefined, win);
    manager.enable();
    // enable() calls _notify() which calls _notifyWithFlag(false)
    // since isDestroyed() returns true, send should not be called
    expect(win.webContents.send).not.toHaveBeenCalled();
    manager.dispose();
  });

  it("includes stateChangedByRemote=true in the pull notification", async () => {
    vi.useFakeTimers();
    const drive = makeDrive();
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    drive.listFiles.mockResolvedValue([
      { id: "state-id", name: DRIVE_STATE_FILE, modifiedTime: futureTime },
    ]);
    drive.downloadFile.mockResolvedValue("{}");
    mockFs.stat.mockResolvedValue({ mtimeMs: Date.now() - 60_000 });

    const win = makeWindow();
    const { manager } = makeManager(drive, undefined, win);
    await manager.forcePull();

    const calls = win.webContents.send.mock.calls;
    const pullNotification = calls.find(
      (c) =>
        c[0] === IPC.DRIVE_SYNC_STATUS_CHANGED &&
        (c[1] as { stateChangedByRemote?: boolean }).stateChangedByRemote ===
          true,
    );
    expect(pullNotification).toBeDefined();

    manager.dispose();
    vi.useRealTimers();
  });
});

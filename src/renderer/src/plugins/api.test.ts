import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WidgetId, InstanceId } from "@shared/types";
import {
  createKvApi,
  createSqlApi,
  createGoogleApi,
  createWidgetApi,
} from "./api";

// Mock window.cc
const mockWindowCc = {
  kv: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keysWithPrefix: vi.fn(),
  },
  sql: {
    run: vi.fn(),
    all: vi.fn(),
    get: vi.fn(),
    exec: vi.fn(),
    runBatch: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
  dialog: {
    openPath: vi.fn(),
  },
  net: {
    fetch: vi.fn(),
  },
  secrets: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    has: vi.fn(),
  },
  google: {
    services: {
      gmail: { id: "gmail", name: "Gmail" },
      calendar: { id: "calendar", name: "Calendar" },
    },
    connect: vi.fn(),
    getToken: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
  },
  clipboard: {
    read: vi.fn(),
  },
};

// Mock emitApiCall and widget lifecycle events
vi.mock("./apiEvents", () => ({
  emitApiCall: vi.fn(),
  emitWidgetMount: vi.fn(),
  emitWidgetUnmount: vi.fn(),
  subscribeWidgetEvents: vi.fn(() => () => {}),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).cc = mockWindowCc;
});

describe("KV API", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should scope keys with instance ID", async () => {
    const kv = createKvApi(widgetId, instanceId);
    mockWindowCc.kv.get.mockResolvedValue("value");

    await kv.get("myKey");

    expect(mockWindowCc.kv.get).toHaveBeenCalledWith(widgetId, "inst-1::myKey");
  });

  it("should set scoped values", async () => {
    const kv = createKvApi(widgetId, instanceId);

    await kv.set("myKey", "myValue");

    expect(mockWindowCc.kv.set).toHaveBeenCalledWith(
      widgetId,
      "inst-1::myKey",
      "myValue",
    );
  });

  it("should delete scoped keys", async () => {
    const kv = createKvApi(widgetId, instanceId);

    await kv.del("myKey");

    expect(mockWindowCc.kv.del).toHaveBeenCalledWith(widgetId, "inst-1::myKey");
  });

  it("should list keys with scoped prefix", async () => {
    const kv = createKvApi(widgetId, instanceId);
    // keysWithPrefix only returns keys that match the prefix
    mockWindowCc.kv.keysWithPrefix.mockResolvedValue([
      "inst-1::key1",
      "inst-1::key2",
    ]);

    const keys = await kv.keys();

    expect(mockWindowCc.kv.keysWithPrefix).toHaveBeenCalledWith(
      widgetId,
      "inst-1::",
    );
    expect(keys).toEqual(["key1", "key2"]);
  });

  it("should handle empty keys list", async () => {
    const kv = createKvApi(widgetId, instanceId);
    mockWindowCc.kv.keysWithPrefix.mockResolvedValue([]);

    const keys = await kv.keys();

    expect(keys).toEqual([]);
  });

  it("should isolate instances from each other", async () => {
    const kv1 = createKvApi(widgetId, "inst-1" as InstanceId);
    const kv2 = createKvApi(widgetId, "inst-2" as InstanceId);

    await kv1.set("key", "value1");
    await kv2.set("key", "value2");

    expect(mockWindowCc.kv.set).toHaveBeenCalledWith(
      widgetId,
      "inst-1::key",
      "value1",
    );
    expect(mockWindowCc.kv.set).toHaveBeenCalledWith(
      widgetId,
      "inst-2::key",
      "value2",
    );
  });

  it("should handle complex values", async () => {
    const kv = createKvApi(widgetId, instanceId);
    const complexValue = { nested: { data: [1, 2, 3] } };

    await kv.set("complex", complexValue);

    expect(mockWindowCc.kv.set).toHaveBeenCalledWith(
      widgetId,
      "inst-1::complex",
      complexValue,
    );
  });
});

describe("SQL API", () => {
  const widgetId = "test-widget" as WidgetId;

  it("should pass through run operations", async () => {
    const sql = createSqlApi(widgetId);
    mockWindowCc.sql.run.mockReturnValue({
      changes: 1,
      lastInsertRowid: 42,
    });

    const result = await sql.run("INSERT INTO table VALUES (?)", [1]);

    expect(mockWindowCc.sql.run).toHaveBeenCalledWith(
      widgetId,
      "INSERT INTO table VALUES (?)",
      [1],
    );
    expect(result).toEqual({ changes: 1, lastInsertRowid: 42 });
  });

  it("should pass through all operations", async () => {
    const sql = createSqlApi(widgetId);
    const rows = [{ id: 1 }, { id: 2 }];
    mockWindowCc.sql.all.mockResolvedValue(rows);

    const result = await sql.all("SELECT * FROM table");

    expect(mockWindowCc.sql.all).toHaveBeenCalledWith(
      widgetId,
      "SELECT * FROM table",
      [],
    );
    expect(result).toEqual(rows);
  });

  it("should pass through get operations", async () => {
    const sql = createSqlApi(widgetId);
    const row = { id: 1, name: "test" };
    mockWindowCc.sql.get.mockResolvedValue(row);

    const result = await sql.get("SELECT * FROM table WHERE id = ?", [1]);

    expect(mockWindowCc.sql.get).toHaveBeenCalledWith(
      widgetId,
      "SELECT * FROM table WHERE id = ?",
      [1],
    );
    expect(result).toEqual(row);
  });

  it("should pass through exec operations", async () => {
    const sql = createSqlApi(widgetId);

    await sql.exec("PRAGMA journal_mode = WAL");

    expect(mockWindowCc.sql.exec).toHaveBeenCalledWith(
      widgetId,
      "PRAGMA journal_mode = WAL",
    );
  });

  it("should pass through batch operations", async () => {
    const sql = createSqlApi(widgetId);
    const batch = [
      { sql: "INSERT INTO a VALUES (?)", params: [1] },
      { sql: "INSERT INTO a VALUES (?)", params: [2] },
    ];
    mockWindowCc.sql.runBatch.mockReturnValue([
      { changes: 1, lastInsertRowid: 1 },
      { changes: 1, lastInsertRowid: 2 },
    ]);

    const result = await sql.runBatch(batch);

    expect(mockWindowCc.sql.runBatch).toHaveBeenCalledWith(widgetId, batch);
    expect(result).toHaveLength(2);
  });

  it("should use default empty params array", async () => {
    const sql = createSqlApi(widgetId);
    mockWindowCc.sql.all.mockResolvedValue([]);

    await sql.all("SELECT * FROM table");

    expect(mockWindowCc.sql.all).toHaveBeenCalledWith(
      widgetId,
      "SELECT * FROM table",
      [],
    );
  });
});

describe("Google API", () => {
  const widgetId = "test-widget" as WidgetId;

  it("should expose available services", async () => {
    const google = createGoogleApi(widgetId);

    expect(google.services).toEqual(mockWindowCc.google.services);
  });

  it("should connect with credentials", async () => {
    const google = createGoogleApi(widgetId);

    await google.connect({
      clientId: "id",
      clientSecret: "secret",
      service: "gmail",
    });

    expect(mockWindowCc.google.connect).toHaveBeenCalledWith(
      widgetId,
      expect.objectContaining({
        clientId: "id",
        clientSecret: "secret",
        service: "gmail",
      }),
    );
  });

  it("should get token for service", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.google.getToken.mockResolvedValue("access-token");

    const token = await google.getToken("gmail");

    expect(mockWindowCc.google.getToken).toHaveBeenCalledWith(
      widgetId,
      "gmail",
    );
    expect(token).toBe("access-token");
  });

  it("should disconnect widget", async () => {
    const google = createGoogleApi(widgetId);

    await google.disconnect("gmail");

    expect(mockWindowCc.google.disconnect).toHaveBeenCalledWith(
      widgetId,
      "gmail",
    );
  });

  it("should check connection status", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.google.isConnected.mockResolvedValue(true);

    const connected = await google.isConnected("gmail");

    expect(mockWindowCc.google.isConnected).toHaveBeenCalledWith(
      widgetId,
      "gmail",
    );
    expect(connected).toBe(true);
  });
});

describe("Google Shared API", () => {
  const widgetId = "test-widget" as WidgetId;

  it("should use shared widget ID for connect", async () => {
    const google = createGoogleApi(widgetId);

    await google.shared.connect({
      clientId: "id",
      clientSecret: "secret",
      service: "gmail",
    });

    // Should call connect with shared widget ID, not the widget's ID
    expect(mockWindowCc.google.connect).toHaveBeenCalledWith(
      expect.not.stringContaining(widgetId),
      expect.any(Object),
    );
  });

  it("should get token from shared namespace", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.google.getToken.mockResolvedValue("shared-token");

    const token = await google.shared.getToken("gmail");

    expect(token).toBe("shared-token");
  });

  it("should check shared connection", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.google.isConnected.mockResolvedValue(true);

    const connected = await google.shared.isConnected("gmail");

    expect(connected).toBe(true);
  });

  it("should disconnect from shared namespace", async () => {
    const google = createGoogleApi(widgetId);

    await google.shared.disconnect("gmail");

    expect(mockWindowCc.google.disconnect).toHaveBeenCalled();
  });

  it("should check if shared creds exist", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.secrets.has.mockResolvedValue(true);

    const hasCreds = await google.shared.hasCreds("gmail");

    expect(hasCreds).toBe(true);
    expect(mockWindowCc.secrets.has).toHaveBeenCalled();
  });

  it("should reconnect with stored credentials", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.secrets.get.mockResolvedValue(
      JSON.stringify({
        clientId: "stored-id",
        clientSecret: "stored-secret",
      }),
    );

    const success = await google.shared.reconnect("gmail");

    expect(success).toBe(true);
    expect(mockWindowCc.google.connect).toHaveBeenCalled();
  });

  it("should return false on reconnect without credentials", async () => {
    const google = createGoogleApi(widgetId);
    mockWindowCc.secrets.get.mockResolvedValue(null);

    const success = await google.shared.reconnect("gmail");

    expect(success).toBe(false);
    expect(mockWindowCc.google.connect).not.toHaveBeenCalled();
  });
});

describe("Secrets API", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should get secrets", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.secrets.get.mockResolvedValue("secret-value");

    const value = await api.secrets.get("key");

    expect(mockWindowCc.secrets.get).toHaveBeenCalledWith(widgetId, "key");
    expect(value).toBe("secret-value");
  });

  it("should set secrets", async () => {
    const api = createWidgetApi(widgetId, instanceId);

    await api.secrets.set("key", "value");

    expect(mockWindowCc.secrets.set).toHaveBeenCalledWith(
      widgetId,
      "key",
      "value",
    );
  });

  it("should delete secrets", async () => {
    const api = createWidgetApi(widgetId, instanceId);

    await api.secrets.del("key");

    expect(mockWindowCc.secrets.del).toHaveBeenCalledWith(widgetId, "key");
  });

  it("should check secret existence", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.secrets.has.mockResolvedValue(true);

    const has = await api.secrets.has("key");

    expect(mockWindowCc.secrets.has).toHaveBeenCalledWith(widgetId, "key");
    expect(has).toBe(true);
  });
});

describe("Shell API", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should open external URLs", async () => {
    const api = createWidgetApi(widgetId, instanceId);

    await api.shell.openExternal("https://example.com");

    expect(mockWindowCc.shell.openExternal).toHaveBeenCalledWith(
      "https://example.com",
    );
  });

  it("should open paths", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.shell.openPath.mockResolvedValue("");

    await api.shell.openPath("/some/path");

    expect(mockWindowCc.shell.openPath).toHaveBeenCalledWith("/some/path");
  });

  it("should show item in folder", async () => {
    const api = createWidgetApi(widgetId, instanceId);

    await api.shell.showItemInFolder("/some/file");

    expect(mockWindowCc.shell.showItemInFolder).toHaveBeenCalledWith(
      "/some/file",
    );
  });
});

describe("Dialog API", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should open file picker", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.dialog.openPath.mockResolvedValue(["/path/1", "/path/2"]);

    const paths = await api.dialog.openPath({ title: "Select files" });

    expect(mockWindowCc.dialog.openPath).toHaveBeenCalledWith({
      title: "Select files",
    });
    expect(paths).toEqual(["/path/1", "/path/2"]);
  });

  it("should return null when dialog is canceled", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.dialog.openPath.mockResolvedValue(null);

    const paths = await api.dialog.openPath();

    expect(paths).toBeNull();
  });
});

describe("Network API", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should fetch with widget context", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.net.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("response"),
    });

    const response = await api.net.fetch("https://api.example.com/data");

    expect(mockWindowCc.net.fetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      undefined,
    );
    expect(response.ok).toBe(true);
  });

  it("should fetch with custom init options", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.net.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      statusText: "Created",
      headers: new Headers(),
    });

    await api.net.fetch("https://api.example.com/data", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    });

    expect(mockWindowCc.net.fetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      }),
    );
  });
});

describe("createWidgetApi", () => {
  const widgetId = "test-widget" as WidgetId;
  const instanceId = "inst-1" as InstanceId;

  it("should provide complete widget API", async () => {
    const api = createWidgetApi(widgetId, instanceId);

    expect(api.widgetId).toBe(widgetId);
    expect(api.instanceId).toBe(instanceId);
    expect(api).toHaveProperty("kv");
    expect(api).toHaveProperty("sql");
    expect(api).toHaveProperty("shell");
    expect(api).toHaveProperty("dialog");
    expect(api).toHaveProperty("net");
    expect(api).toHaveProperty("secrets");
    expect(api).toHaveProperty("google");
    expect(api).toHaveProperty("clipboard");
  });

  it("should properly scope KV operations", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.kv.get.mockResolvedValue("value");

    await api.kv.get("key");

    expect(mockWindowCc.kv.get).toHaveBeenCalledWith(widgetId, "inst-1::key");
  });

  it("should pass widget ID to SQL operations", async () => {
    const api = createWidgetApi(widgetId, instanceId);
    mockWindowCc.sql.all.mockResolvedValue([]);

    await api.sql.all("SELECT * FROM table");

    expect(mockWindowCc.sql.all).toHaveBeenCalledWith(
      widgetId,
      expect.any(String),
      expect.any(Array),
    );
  });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SqliteStore } from "../sqlite";

const W = "test-widget";

let root: string;
let store: SqliteStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cc-sqlite-"));
  store = new SqliteStore(root);
});

afterEach(async () => {
  store.closeAll();
  await fs.rm(root, { recursive: true, force: true });
});

async function createTable(widgetId = W) {
  await store.exec(
    widgetId,
    "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)",
  );
}

describe("exec / run / all / get", () => {
  it("inserts a row and returns changes + lastInsertRowid", async () => {
    await createTable();
    const result = await store.run(W, "INSERT INTO items (name) VALUES (?)", [
      "Alice",
    ]);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(1);
  });

  it("retrieves all rows in insertion order", async () => {
    await createTable();
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["Alice"]);
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["Bob"]);
    const rows = (await store.all(W, "SELECT name FROM items ORDER BY id")) as {
      name: string;
    }[];
    expect(rows.map((r) => r.name)).toEqual(["Alice", "Bob"]);
  });

  it("retrieves a single matching row", async () => {
    await createTable();
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["Only"]);
    const row = (await store.get(
      W,
      "SELECT name FROM items WHERE id = ?",
      [1],
    )) as { name: string };
    expect(row.name).toBe("Only");
  });

  it("returns undefined from get when no rows match", async () => {
    await createTable();
    expect(
      await store.get(W, "SELECT * FROM items WHERE id = ?", [999]),
    ).toBeUndefined();
  });

  it("creates the widget directory automatically", async () => {
    await createTable();
    const dbPath = path.join(root, "widgets", W, "data.db");
    await expect(fs.access(dbPath)).resolves.toBeUndefined();
  });
});

describe("runBatch", () => {
  it("runs all statements and returns one result per statement", async () => {
    await createTable();
    const results = await store.runBatch(W, [
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["X"] },
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["Y"] },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].changes).toBe(1);
    expect(results[1].lastInsertRowid).toBe(2);
  });

  it("rolls back all inserts when a statement fails mid-batch", async () => {
    await store.exec(
      W,
      "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)",
    );
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["taken"]);

    await expect(
      store.runBatch(W, [
        { sql: "INSERT INTO items (name) VALUES (?)", params: ["new-item"] },
        { sql: "INSERT INTO items (name) VALUES (?)", params: ["taken"] }, // UNIQUE conflict
      ]),
    ).rejects.toThrow();

    // Transaction must have been rolled back — 'new-item' should not exist
    expect(
      await store.get(W, "SELECT * FROM items WHERE name = 'new-item' "),
    ).toBeUndefined();
  });

  it("uses default empty params when params are omitted", async () => {
    await createTable();
    await store.runBatch(W, [
      { sql: "INSERT INTO items (name) VALUES (NULL)" },
    ]);
    expect((await store.all(W, "SELECT * FROM items")).length).toBe(1);
  });
});

describe("onWritten callback", () => {
  it("fires after run", async () => {
    await createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["x"]);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it("fires after exec", async () => {
    const cb = vi.fn();
    store.onWritten = cb;
    await createTable(); // exec is called inside createTable
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it("fires after runBatch", async () => {
    await createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    await store.runBatch(W, [
      { sql: "INSERT INTO items (name) VALUES (?)", params: ["x"] },
    ]);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it("does not fire after all or get (read-only)", async () => {
    await createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    await store.all(W, "SELECT * FROM items");
    await store.get(W, "SELECT * FROM items LIMIT 1");
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("closeDb", () => {
  it("allows re-opening and reading existing data after close", async () => {
    await createTable();
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["persistent"]);
    store.closeDb(W);
    const rows = (await store.all(W, "SELECT name FROM items")) as {
      name: string;
    }[];
    expect(rows[0].name).toBe("persistent");
  });

  it("is a no-op when the widget db was never opened", () => {
    expect(() => store.closeDb("never-opened")).not.toThrow();
  });
});

describe("closeAll", () => {
  it("closes connections for multiple widgets without throwing", async () => {
    await createTable("widget-a");
    await createTable("widget-b");
    expect(() => store.closeAll()).not.toThrow();
  });
});

describe("invalid widgetId", () => {
  it("throws before opening any db file for path-traversal ids", async () => {
    await expect(store.exec("../evil", "SELECT 1")).rejects.toThrow();
  });

  it("throws for ids with uppercase letters", async () => {
    await expect(store.run("UpperCase", "SELECT 1")).rejects.toThrow();
  });

  it("throws for ids with special characters", async () => {
    await expect(store.run("bad!id", "SELECT 1")).rejects.toThrow(
      /Invalid widget id/,
    );
  });

  it("throws for ids starting with a hyphen", async () => {
    await expect(store.all("-bad", "SELECT 1")).rejects.toThrow(
      /Invalid widget id/,
    );
  });
});

describe("backup", () => {
  it("creates a readable copy of the database at the destination path", async () => {
    await createTable();
    await store.run(W, "INSERT INTO items (name) VALUES (?)", ["snapshot"]);

    const destPath = path.join(root, "backup.db");
    await store.backup(W, destPath);

    // Open backup independently and verify the row is there
    const { DatabaseSync } = await import("node:sqlite");
    const backup = new DatabaseSync(destPath, { readOnly: true });
    const row = backup.prepare("SELECT name FROM items WHERE id = 1").get() as {
      name: string;
    };
    backup.close();
    expect(row.name).toBe("snapshot");
  });
});

describe("WAL mode and foreign keys", () => {
  it("enables WAL journal mode on new databases", async () => {
    await createTable();
    const journalMode = (await store.get(W, "PRAGMA journal_mode")) as {
      journal_mode: string;
    };
    expect(journalMode.journal_mode).toBe("wal");
  });

  it("enforces foreign key constraints", async () => {
    await store.exec(
      W,
      `
      CREATE TABLE parent (id INTEGER PRIMARY KEY);
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
    `,
    );
    await expect(
      store.run(W, "INSERT INTO child (parent_id) VALUES (?)", [999]),
    ).rejects.toThrow();
  });
});

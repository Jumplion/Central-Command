import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SqliteStore } from './sqlite';

const W = 'test-widget';

let root: string;
let store: SqliteStore;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-sqlite-'));
  store = new SqliteStore(root);
});

afterEach(async () => {
  store.closeAll();
  await fs.rm(root, { recursive: true, force: true });
});

function createTable(widgetId = W) {
  store.exec(widgetId, 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
}

describe('exec / run / all / get', () => {
  it('inserts a row and returns changes + lastInsertRowid', () => {
    createTable();
    const result = store.run(W, 'INSERT INTO items (name) VALUES (?)', ['Alice']);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(1);
  });

  it('retrieves all rows in insertion order', () => {
    createTable();
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['Alice']);
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['Bob']);
    const rows = store.all(W, 'SELECT name FROM items ORDER BY id') as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('retrieves a single matching row', () => {
    createTable();
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['Only']);
    const row = store.get(W, 'SELECT name FROM items WHERE id = ?', [1]) as { name: string };
    expect(row.name).toBe('Only');
  });

  it('returns undefined from get when no rows match', () => {
    createTable();
    expect(store.get(W, 'SELECT * FROM items WHERE id = ?', [999])).toBeUndefined();
  });

  it('creates the widget directory automatically', async () => {
    createTable();
    const dbPath = path.join(root, 'widgets', W, 'data.db');
    await expect(fs.access(dbPath)).resolves.toBeUndefined();
  });
});

describe('runBatch', () => {
  it('runs all statements and returns one result per statement', () => {
    createTable();
    const results = store.runBatch(W, [
      { sql: 'INSERT INTO items (name) VALUES (?)', params: ['X'] },
      { sql: 'INSERT INTO items (name) VALUES (?)', params: ['Y'] },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].changes).toBe(1);
    expect(results[1].lastInsertRowid).toBe(2);
  });

  it('rolls back all inserts when a statement fails mid-batch', () => {
    store.exec(W, 'CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)');
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['taken']);

    expect(() =>
      store.runBatch(W, [
        { sql: 'INSERT INTO items (name) VALUES (?)', params: ['new-item'] },
        { sql: 'INSERT INTO items (name) VALUES (?)', params: ['taken'] }, // UNIQUE conflict
      ])
    ).toThrow();

    // Transaction must have been rolled back — 'new-item' should not exist
    expect(store.get(W, "SELECT * FROM items WHERE name = 'new-item'")).toBeUndefined();
  });

  it('uses default empty params when params are omitted', () => {
    createTable();
    expect(() =>
      store.runBatch(W, [{ sql: 'INSERT INTO items (name) VALUES (NULL)' }])
    ).not.toThrow();
    expect(store.all(W, 'SELECT * FROM items')).toHaveLength(1);
  });
});

describe('onWritten callback', () => {
  it('fires after run', () => {
    createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['x']);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it('fires after exec', () => {
    const cb = vi.fn();
    store.onWritten = cb;
    createTable(); // exec is called inside createTable
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it('fires after runBatch', () => {
    createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    store.runBatch(W, [{ sql: 'INSERT INTO items (name) VALUES (?)', params: ['x'] }]);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(W);
  });

  it('does not fire after all or get (read-only)', () => {
    createTable();
    const cb = vi.fn();
    store.onWritten = cb;
    store.all(W, 'SELECT * FROM items');
    store.get(W, 'SELECT * FROM items LIMIT 1');
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('closeDb', () => {
  it('allows re-opening and reading existing data after close', () => {
    createTable();
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['persistent']);
    store.closeDb(W);
    const rows = store.all(W, 'SELECT name FROM items') as { name: string }[];
    expect(rows[0].name).toBe('persistent');
  });

  it('is a no-op when the widget db was never opened', () => {
    expect(() => store.closeDb('never-opened')).not.toThrow();
  });
});

describe('closeAll', () => {
  it('closes connections for multiple widgets without throwing', () => {
    createTable('widget-a');
    createTable('widget-b');
    expect(() => store.closeAll()).not.toThrow();
  });
});

describe('invalid widgetId', () => {
  it('throws before opening any db file for path-traversal ids', () => {
    expect(() => store.exec('../evil', 'SELECT 1')).toThrow();
  });

  it('throws for ids with uppercase letters', () => {
    expect(() => store.run('UpperCase', 'SELECT 1')).toThrow();
  });
});

describe('backup', () => {
  it('creates a readable copy of the database at the destination path', async () => {
    createTable();
    store.run(W, 'INSERT INTO items (name) VALUES (?)', ['snapshot']);

    const destPath = path.join(root, 'backup.db');
    await store.backup(W, destPath);

    // Open backup independently and verify the row is there
    const { default: Database } = await import('better-sqlite3');
    const backup = new Database(destPath, { readonly: true });
    const row = backup.prepare('SELECT name FROM items WHERE id = 1').get() as { name: string };
    backup.close();
    expect(row.name).toBe('snapshot');
  });
});

describe('WAL mode and foreign keys', () => {
  it('enables WAL journal mode on new databases', () => {
    createTable();
    const journalMode = store.get(W, 'PRAGMA journal_mode') as { journal_mode: string };
    expect(journalMode.journal_mode).toBe('wal');
  });

  it('enforces foreign key constraints', () => {
    store.exec(W, `
      CREATE TABLE parent (id INTEGER PRIMARY KEY);
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
    `);
    expect(() =>
      store.run(W, 'INSERT INTO child (parent_id) VALUES (?)', [999])
    ).toThrow();
  });
});

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { assertValidWidgetId } from '@shared/validation';
import type { SqlRunResult } from '@shared/types';

export class SqliteStore {
  private dbs = new Map<string, Database.Database>();

  /** Called after each write operation with the affected widgetId. */
  onWritten: (widgetId: string) => void = () => {};

  constructor(private root: string) {}

  private dbFor(widgetId: string): Database.Database {
    assertValidWidgetId(widgetId);
    let db = this.dbs.get(widgetId);
    if (db) return db;
    const dir = path.join(this.root, 'widgets', widgetId);
    fs.mkdirSync(dir, { recursive: true });
    db = new Database(path.join(dir, 'data.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    this.dbs.set(widgetId, db);
    return db;
  }

  run(widgetId: string, sql: string, params: unknown[] = []): SqlRunResult {
    const stmt = this.dbFor(widgetId).prepare(sql);
    const result = stmt.run(...(params as unknown[]));
    this.onWritten(widgetId);
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
  }

  all(widgetId: string, sql: string, params: unknown[] = []): unknown[] {
    return this.dbFor(widgetId).prepare(sql).all(...(params as unknown[])) as unknown[];
  }

  get(widgetId: string, sql: string, params: unknown[] = []): unknown {
    return this.dbFor(widgetId).prepare(sql).get(...(params as unknown[]));
  }

  exec(widgetId: string, sql: string): void {
    this.dbFor(widgetId).exec(sql);
    this.onWritten(widgetId);
  }

  runBatch(widgetId: string, items: { sql: string; params?: unknown[] }[]): SqlRunResult[] {
    const db = this.dbFor(widgetId);
    const results: SqlRunResult[] = [];
    const run = db.transaction(() => {
      for (const item of items) {
        const result = db.prepare(item.sql).run(...((item.params ?? []) as unknown[]));
        results.push({ changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) });
      }
    });
    run();
    this.onWritten(widgetId);
    return results;
  }

  /** Creates a safe hot backup of a widget's database to the given destination path. */
  async backup(widgetId: string, destPath: string): Promise<void> {
    const db = this.dbFor(widgetId);
    await db.backup(destPath);
  }

  /** Closes a single widget's database connection so it can be replaced on disk. */
  closeDb(widgetId: string): void {
    const db = this.dbs.get(widgetId);
    if (!db) return;
    try { db.close(); } catch { /* ignore */ }
    this.dbs.delete(widgetId);
  }

  closeAll(): void {
    for (const db of this.dbs.values()) {
      try { db.close(); } catch { /* ignore */ }
    }
    this.dbs.clear();
  }
}

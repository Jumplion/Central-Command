import Database from 'better-sqlite3';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { assertValidWidgetId } from '@shared/validation';
import type { SqlRunResult } from '@shared/types';
import { widgetDir } from './helpers';

export class SqliteStore {
  private dbs = new Map<string, Database.Database>();
  private dirInit = new Map<string, Promise<void>>();

  /** Called after each write operation with the affected widgetId. */
  onWritten: (widgetId: string) => void = () => {};

  constructor(private root: string) {}

  private async ensureWidgetDir(widgetId: string): Promise<void> {
    assertValidWidgetId(widgetId);
    const dir = widgetDir(this.root, widgetId);

    let pending = this.dirInit.get(widgetId);
    if (!pending) {
      pending = fs.mkdir(dir, { recursive: true }).then(() => undefined).finally(() => {
        this.dirInit.delete(widgetId);
      });
      this.dirInit.set(widgetId, pending);
    }

    await pending;
  }

  private dbFor(widgetId: string): Database.Database {
    let db = this.dbs.get(widgetId);
    if (db) return db;
    const dir = widgetDir(this.root, widgetId);
    db = new Database(path.join(dir, 'data.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    this.dbs.set(widgetId, db);
    return db;
  }

  async run(widgetId: string, sql: string, params: unknown[] = []): Promise<SqlRunResult> {
    await this.ensureWidgetDir(widgetId);
    const stmt = this.dbFor(widgetId).prepare(sql);
    const result = stmt.run(...(params as unknown[]));
    this.onWritten(widgetId);
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
  }

  async all(widgetId: string, sql: string, params: unknown[] = []): Promise<unknown[]> {
    await this.ensureWidgetDir(widgetId);
    return this.dbFor(widgetId).prepare(sql).all(...(params as unknown[])) as unknown[];
  }

  async get(widgetId: string, sql: string, params: unknown[] = []): Promise<unknown> {
    await this.ensureWidgetDir(widgetId);
    return this.dbFor(widgetId).prepare(sql).get(...(params as unknown[]));
  }

  async exec(widgetId: string, sql: string): Promise<void> {
    await this.ensureWidgetDir(widgetId);
    this.dbFor(widgetId).exec(sql);
    this.onWritten(widgetId);
  }

  async runBatch(widgetId: string, items: { sql: string; params?: unknown[] }[]): Promise<SqlRunResult[]> {
    await this.ensureWidgetDir(widgetId);
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
    await this.ensureWidgetDir(widgetId);
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

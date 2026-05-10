import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { assertValidWidgetId } from './json';
import type { SqlRunResult } from '@shared/types';

export class SqliteStore {
  private dbs = new Map<string, Database.Database>();

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
  }

  closeAll(): void {
    for (const db of this.dbs.values()) {
      try { db.close(); } catch { /* ignore */ }
    }
    this.dbs.clear();
  }
}

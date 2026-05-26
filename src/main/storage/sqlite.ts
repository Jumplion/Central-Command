import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import path from "node:path";
import type { SqlRunResult } from "@shared/types";
import { widgetDir, ensureWidgetDir } from "./helpers";

export class SqliteStore {
  private dbs = new Map<string, DatabaseSync>();

  /** Called after each write operation with the affected widgetId. */
  onWritten: (widgetId: string) => void = () => {};

  constructor(private root: string) {}

  private dbFor(widgetId: string): DatabaseSync {
    let db = this.dbs.get(widgetId);
    if (db) return db;
    const dir = widgetDir(this.root, widgetId);
    db = new DatabaseSync(path.join(dir, "data.db"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    this.dbs.set(widgetId, db);
    return db;
  }

  async run(
    widgetId: string,
    sql: string,
    params: unknown[] = [],
  ): Promise<SqlRunResult> {
    await ensureWidgetDir(this.root, widgetId);
    const result = this.dbFor(widgetId)
      .prepare(sql)
      .run(...(params as SQLInputValue[]));
    this.onWritten(widgetId);
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  async all(
    widgetId: string,
    sql: string,
    params: unknown[] = [],
  ): Promise<unknown[]> {
    await ensureWidgetDir(this.root, widgetId);
    return this.dbFor(widgetId)
      .prepare(sql)
      .all(...(params as SQLInputValue[])) as unknown[];
  }

  async get(
    widgetId: string,
    sql: string,
    params: unknown[] = [],
  ): Promise<unknown> {
    await ensureWidgetDir(this.root, widgetId);
    return this.dbFor(widgetId)
      .prepare(sql)
      .get(...(params as SQLInputValue[]));
  }

  async exec(widgetId: string, sql: string): Promise<void> {
    await ensureWidgetDir(this.root, widgetId);
    this.dbFor(widgetId).exec(sql);
    this.onWritten(widgetId);
  }

  async runBatch(
    widgetId: string,
    items: { sql: string; params?: unknown[] }[],
  ): Promise<SqlRunResult[]> {
    await ensureWidgetDir(this.root, widgetId);
    const db = this.dbFor(widgetId);
    const results: SqlRunResult[] = [];
    db.exec("BEGIN");
    try {
      for (const item of items) {
        const result = db
          .prepare(item.sql)
          .run(...((item.params ?? []) as SQLInputValue[]));
        results.push({
          changes: Number(result.changes),
          lastInsertRowid: Number(result.lastInsertRowid),
        });
      }
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* ignore if already rolled back */
      }
      throw err;
    }
    this.onWritten(widgetId);
    return results;
  }

  /** Creates a consistent copy of the database at the destination path. */
  async backup(widgetId: string, destPath: string): Promise<void> {
    await ensureWidgetDir(this.root, widgetId);
    if (destPath.includes("'"))
      throw new Error("destPath cannot contain single quotes");
    this.dbFor(widgetId).exec(`VACUUM INTO '${destPath}'`);
  }

  /** Closes a single widget's database connection so it can be replaced on disk. */
  closeDb(widgetId: string): void {
    const db = this.dbs.get(widgetId);
    if (!db) return;
    try {
      db.close();
    } catch {
      /* ignore */
    }
    this.dbs.delete(widgetId);
  }

  closeAll(): void {
    for (const db of this.dbs.values()) {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
    this.dbs.clear();
  }
}

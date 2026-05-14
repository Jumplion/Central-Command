import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SqlRunResult } from '@shared/types';

const sqlite = new SQLiteConnection(CapacitorSQLite);
const connections = new Map<string, Awaited<ReturnType<SQLiteConnection['createConnection']>>>();
let initPromise: Promise<void> | null = null;

export let onWritten: (widgetId: string) => void = () => {};

export async function initSqlite(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const isAvailable = await CapacitorSQLite.checkConnectionsConsistency({ dbNames: [], openModes: [] });
    if (!isAvailable.result) {
      console.warn('[mobile-sql] SQLite consistency check failed');
    }
  })();
  return initPromise;
}

async function getDb(widgetId: string) {
  await initSqlite();
  if (connections.has(widgetId)) return connections.get(widgetId)!;
  const db = await sqlite.createConnection(widgetId, false, 'no-encryption', 1, false);
  await db.open();
  connections.set(widgetId, db);
  return db;
}

export async function closeDb(widgetId: string): Promise<void> {
  const db = connections.get(widgetId);
  if (!db) return;
  try {
    await db.close();
  } catch { /* ignore */ }
  connections.delete(widgetId);
  await sqlite.closeConnection(widgetId, false);
}

export async function reopenDb(widgetId: string): Promise<void> {
  await getDb(widgetId);
}

export const sqlApi = {
  async run(widgetId: string, sql: string, params: unknown[] = []): Promise<SqlRunResult> {
    const db = await getDb(widgetId);
    const result = await db.run(sql, params as (string | number | null)[], false);
    onWritten(widgetId);
    return {
      changes: result.changes?.changes ?? 0,
      lastInsertRowid: result.changes?.lastId ?? 0,
    };
  },

  async all(widgetId: string, sql: string, params: unknown[] = []): Promise<unknown[]> {
    const db = await getDb(widgetId);
    const result = await db.query(sql, params as (string | number | null)[]);
    return result.values ?? [];
  },

  async get(widgetId: string, sql: string, params: unknown[] = []): Promise<unknown> {
    const db = await getDb(widgetId);
    const result = await db.query(sql, params as (string | number | null)[]);
    return result.values?.[0] ?? undefined;
  },

  async exec(widgetId: string, sql: string): Promise<void> {
    const db = await getDb(widgetId);
    await db.execute(sql, false);
    onWritten(widgetId);
  },

  async runBatch(
    widgetId: string,
    items: { sql: string; params?: unknown[] }[]
  ): Promise<SqlRunResult[]> {
    const db = await getDb(widgetId);
    const results: SqlRunResult[] = [];
    await db.beginTransaction();
    try {
      for (const item of items) {
        const r = await db.run(
          item.sql,
          (item.params ?? []) as (string | number | null)[],
          false
        );
        results.push({
          changes: r.changes?.changes ?? 0,
          lastInsertRowid: r.changes?.lastId ?? 0,
        });
      }
      await db.commitTransaction();
    } catch (err) {
      await db.rollbackTransaction();
      throw err;
    }
    onWritten(widgetId);
    return results;
  },
};

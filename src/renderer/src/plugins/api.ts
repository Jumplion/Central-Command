import type { InstanceId, SqlRunResult, WidgetId } from '@shared/types';

export interface WidgetApi {
  widgetId: WidgetId;
  instanceId: InstanceId;
  /**
   * Per-instance JSON key/value store. Keys are scoped to this widget instance,
   * so two instances of the same widget will not collide.
   */
  kv: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };
  /**
   * Per-widget SQLite database. Tables are shared across all instances of the
   * same widget. Use parameterized queries; never interpolate untrusted values.
   */
  sql: {
    run(sql: string, params?: unknown[]): Promise<SqlRunResult>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    get<T = unknown>(sql: string, params?: unknown[]): Promise<T | undefined>;
    exec(sql: string): Promise<void>;
  };
}

const SCOPE_SEP = '::';

function scoped(instanceId: InstanceId, key: string): string {
  return `${instanceId}${SCOPE_SEP}${key}`;
}

export function createWidgetApi(widgetId: WidgetId, instanceId: InstanceId): WidgetApi {
  return {
    widgetId,
    instanceId,
    kv: {
      get: <T,>(key: string) =>
        window.cc.kv.get(widgetId, scoped(instanceId, key)) as Promise<T | undefined>,
      set: (key, value) => window.cc.kv.set(widgetId, scoped(instanceId, key), value),
      del: (key) => window.cc.kv.del(widgetId, scoped(instanceId, key)),
      keys: async () => {
        const all = await window.cc.kv.keys(widgetId);
        const prefix = instanceId + SCOPE_SEP;
        return all.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
      }
    },
    sql: {
      run: (sql, params = []) => window.cc.sql.run(widgetId, sql, params),
      all: <T,>(sql: string, params: unknown[] = []) =>
        window.cc.sql.all(widgetId, sql, params) as Promise<T[]>,
      get: <T,>(sql: string, params: unknown[] = []) =>
        window.cc.sql.get(widgetId, sql, params) as Promise<T | undefined>,
      exec: (sql) => window.cc.sql.exec(widgetId, sql)
    }
  };
}

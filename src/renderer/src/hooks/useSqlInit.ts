import { useState, useEffect } from "react";
import type { WidgetApi } from "@renderer/plugins/api";

export interface SqlMigration {
  table: string;
  column: string;
  sql: string;
}

// One init promise per widget type — prevents redundant INIT_SQL exec and
// PRAGMA table_info IPC calls when multiple instances of the same widget
// are mounted simultaneously.
const _initCache = new Map<string, Promise<void>>();

export function useSqlInit(
  api: WidgetApi,
  initSql: string,
  migrations?: SqlMigration[],
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = api.widgetId;

    if (!_initCache.has(key)) {
      const p = (async () => {
        await api.sql.exec(initSql);
        if (migrations?.length) {
          for (const m of migrations) {
            const cols = await api.sql.all<{ name: string }>(
              `PRAGMA table_info(${m.table})`,
            );
            if (!cols.find((c) => c.name === m.column)) {
              await api.sql.run(m.sql, []);
            }
          }
        }
      })();
      // On failure clear the cache so the next mount retries
      p.catch(() => _initCache.delete(key));
      _initCache.set(key, p);
    }

    void _initCache.get(key)!.then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

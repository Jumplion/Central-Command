import { useState, useEffect } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';

export interface SqlMigration {
  table: string;
  column: string;
  sql: string;
}

export function useSqlInit(
  api: WidgetApi,
  initSql: string,
  migrations?: SqlMigration[],
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      await api.sql.exec(initSql);
      if (migrations?.length) {
        for (const m of migrations) {
          const cols = await api.sql.all<{ name: string }>(`PRAGMA table_info(${m.table})`);
          if (!cols.find((c) => c.name === m.column)) {
            await api.sql.run(m.sql, []);
          }
        }
      }
      setReady(true);
    };
    void run();
  }, []);

  return ready;
}

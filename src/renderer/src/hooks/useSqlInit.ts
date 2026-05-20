import { useState, useEffect } from "react";
import type { WidgetApi } from "@renderer/plugins/api";

export interface SqlMigration {
  table: string;
  column: string;
  sql: string;
}

/**
 * Extracts column names from a CREATE TABLE statement.
 * Used for validation to catch duplicate columns between INIT_SQL and migrations.
 */
function extractColumnsFromCreateTable(
  initSql: string,
): Record<string, Set<string>> {
  const tables: Record<string, Set<string>> = {};
  // Simple regex to find CREATE TABLE statements and their columns
  const createTableRegex =
    /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = createTableRegex.exec(initSql)) !== null) {
    const tableName = match[1];
    const content = match[2];
    tables[tableName] = new Set();

    // Extract column names (first word after whitespace, excluding keywords)
    const columnRegex = /,?\s*(\w+)\s+[A-Z]/g;
    let colMatch;
    while ((colMatch = columnRegex.exec(content)) !== null) {
      tables[tableName].add(colMatch[1]);
    }
  }

  return tables;
}

export function useSqlInit(
  api: WidgetApi,
  initSql: string,
  migrations?: SqlMigration[],
): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      // Validate migrations don't duplicate columns from INIT_SQL
      if (migrations?.length) {
        const initialColumns = extractColumnsFromCreateTable(initSql);
        for (const m of migrations) {
          const cols = initialColumns[m.table];
          if (cols && cols.has(m.column)) {
            console.error(
              `[useSqlInit] Migration tries to add column "${m.column}" to table "${m.table}", ` +
                `but it's already defined in INIT_SQL. Remove it from INIT_SQL or remove this migration.`,
            );
            throw new Error(
              `Migration conflict: "${m.column}" already exists in table "${m.table}"`,
            );
          }
        }
      }

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
      setReady(true);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

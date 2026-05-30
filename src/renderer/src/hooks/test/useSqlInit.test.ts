import { describe, expect, it } from "vitest";
import {
  INIT_SQL,
  EMAIL_INIT_SQL,
  SCHEMA_MIGRATIONS,
} from "@widgets/job-tracker/schema";
import {
  INIT_SQL as MEDIA_INIT_SQL,
  MIGRATIONS as MEDIA_MIGRATIONS,
} from "@widgets/media-tracker/schema";
import {
  INIT_SQL as GMAIL_INIT_SQL,
  MIGRATIONS as GMAIL_MIGRATIONS,
} from "@widgets/gmail-dashboard/schema";
import {
  INIT_SQL as EXAMPLE_INIT_SQL,
  MIGRATIONS as EXAMPLE_MIGRATIONS,
} from "@widgets/example-widget/constants";
import type { SqlMigration } from "../useSqlInit";

/**
 * Parses CREATE TABLE statements and returns a map of table name → set of column names.
 * Intentionally kept simple: first word in each line that's followed by a SQL type keyword.
 */
function extractColumns(sql: string): Record<string, Set<string>> {
  const tables: Record<string, Set<string>> = {};
  const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const content = match[2];
    tables[tableName] = new Set();
    const colRegex = /,?\s*(\w+)\s+[A-Z]/g;
    let colMatch;
    while ((colMatch = colRegex.exec(content)) !== null) {
      tables[tableName].add(colMatch[1]);
    }
  }
  return tables;
}

const WIDGET_SCHEMAS: Array<{
  name: string;
  initSql: string;
  migrations: SqlMigration[];
}> = [
  {
    name: "job-tracker",
    initSql: INIT_SQL + EMAIL_INIT_SQL,
    migrations: SCHEMA_MIGRATIONS,
  },
  {
    name: "media-tracker",
    initSql: MEDIA_INIT_SQL,
    migrations: MEDIA_MIGRATIONS,
  },
  {
    name: "gmail-dashboard",
    initSql: GMAIL_INIT_SQL,
    migrations: GMAIL_MIGRATIONS,
  },
  {
    name: "example-widget",
    initSql: EXAMPLE_INIT_SQL,
    migrations: EXAMPLE_MIGRATIONS,
  },
];

describe("SQL migration safety", () => {
  for (const { name, initSql, migrations } of WIDGET_SCHEMAS) {
    if (migrations.length === 0) continue;

    it(`${name}: no migration column is already defined in INIT_SQL`, () => {
      const initialColumns = extractColumns(initSql);
      for (const m of migrations) {
        const cols = initialColumns[m.table];
        expect(
          cols?.has(m.column),
          `Migration adds "${m.column}" to table "${m.table}" but it is already in INIT_SQL — ` +
            `remove the column from INIT_SQL or remove the migration.`,
        ).toBe(false);
      }
    });
  }
});

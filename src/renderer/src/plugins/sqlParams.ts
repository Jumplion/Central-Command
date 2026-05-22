/**
 * Converts a named-parameter SQL string and params object into a positional
 * [sql, params] pair suitable for api.sql.run / api.sql.get / api.sql.all.
 *
 * Named params use :name syntax. Every :name token in the SQL must have a
 * matching key in the params object. Literal SQL values (e.g. 'Interested',
 * NULL, 0) embedded directly in the query string are untouched.
 *
 * Usage:
 *   await api.sql.run(...namedSql(
 *     "INSERT INTO t (a, b) VALUES (:a, :b)",
 *     { a: "foo", b: 42 },
 *   ));
 *
 * Why: positional ? arrays silently accept the wrong number of arguments and
 * produce NOT NULL / type constraint failures that are hard to trace. Named
 * params make the mapping explicit and throw at call-time for missing keys.
 */
export function namedSql<T extends Record<string, unknown>>(
  sql: string,
  params: T,
): [string, unknown[]] {
  const values: unknown[] = [];
  const out = sql.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => {
    if (!(key in params)) throw new Error(`Missing SQL param: :${key}`);
    values.push(params[key]);
    return "?";
  });
  return [out, values];
}

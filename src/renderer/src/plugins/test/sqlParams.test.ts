import { describe, expect, it } from "vitest";
import { namedSql } from "../sqlParams";

describe("namedSql", () => {
  it("substitutes a single named param", () => {
    const [sql, values] = namedSql("SELECT * FROM t WHERE id = :id", { id: 1 });
    expect(sql).toBe("SELECT * FROM t WHERE id = ?");
    expect(values).toEqual([1]);
  });

  it("substitutes multiple named params in declaration order", () => {
    const [sql, values] = namedSql(
      "INSERT INTO t (a, b, c) VALUES (:a, :b, :c)",
      { a: "foo", b: 42, c: null },
    );
    expect(sql).toBe("INSERT INTO t (a, b, c) VALUES (?, ?, ?)");
    expect(values).toEqual(["foo", 42, null]);
  });

  it("substitutes the same param multiple times, pushing a value per occurrence", () => {
    const [sql, values] = namedSql("SELECT :x + :x AS total", { x: 5 });
    expect(sql).toBe("SELECT ? + ? AS total");
    expect(values).toEqual([5, 5]);
  });

  it("throws when a :name token has no matching key in params", () => {
    expect(() => namedSql("SELECT :missing", {})).toThrow(
      "Missing SQL param: :missing",
    );
  });

  it("returns empty values array when the sql contains no params", () => {
    const [sql, values] = namedSql("SELECT 1", {});
    expect(sql).toBe("SELECT 1");
    expect(values).toEqual([]);
  });

  it("ignores extra keys in params that are not referenced in sql", () => {
    const [sql, values] = namedSql("SELECT :a", { a: 1, b: 2 });
    expect(sql).toBe("SELECT ?");
    expect(values).toEqual([1]);
  });

  it("handles param names with underscores and numeric suffixes", () => {
    const [sql, values] = namedSql(":item_id AND :count2", {
      item_id: "x",
      count2: 9,
    });
    expect(sql).toBe("? AND ?");
    expect(values).toEqual(["x", 9]);
  });

  it("passes boolean values through unchanged", () => {
    const [sql, values] = namedSql("(:flag)", { flag: false });
    expect(values).toEqual([false]);
    expect(sql).toBe("(?)");
  });

  it("passes null values through unchanged", () => {
    const [sql, values] = namedSql("(:nothing)", { nothing: null });
    expect(values).toEqual([null]);
  });

  it("does not replace :name tokens that are part of a longer word (regex anchoring)", () => {
    // ':status' in 'LIKE :status_code' — the token is :status_code, not :status
    const [sql, values] = namedSql("WHERE code = :status_code", {
      status_code: "ok",
    });
    expect(sql).toBe("WHERE code = ?");
    expect(values).toEqual(["ok"]);
  });

  it("returns a two-element tuple [string, unknown[]]", () => {
    const result = namedSql("SELECT :v", { v: 42 });
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe("string");
    expect(Array.isArray(result[1])).toBe(true);
  });
});

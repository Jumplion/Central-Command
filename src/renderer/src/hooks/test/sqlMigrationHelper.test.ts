import { describe, expect, it, vi } from "vitest";
import { createMigration } from "../sqlMigrationHelper";

describe("createMigration", () => {
  it("returns a SqlMigration with the provided table, column, and sql", () => {
    const m = createMigration(
      "items",
      "priority",
      "ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0",
    );
    expect(m).toEqual({
      table: "items",
      column: "priority",
      sql: "ALTER TABLE items ADD COLUMN priority INTEGER DEFAULT 0",
    });
  });

  it("throws when table is empty", () => {
    expect(() =>
      createMigration("", "col", "ALTER TABLE t ADD COLUMN col TEXT"),
    ).toThrow("createMigration: table, column, and sql are required");
  });

  it("throws when column is empty", () => {
    expect(() =>
      createMigration("t", "", "ALTER TABLE t ADD COLUMN col TEXT"),
    ).toThrow("createMigration: table, column, and sql are required");
  });

  it("throws when sql is empty", () => {
    expect(() => createMigration("t", "col", "")).toThrow(
      "createMigration: table, column, and sql are required",
    );
  });

  it("throws when sql is not an ALTER TABLE statement", () => {
    expect(() =>
      createMigration("t", "col", "CREATE TABLE t (col TEXT)"),
    ).toThrow("createMigration: sql must be an ALTER TABLE statement");
  });

  it("throws when sql does not include ADD COLUMN", () => {
    expect(() =>
      createMigration("t", "col", "ALTER TABLE t RENAME TO t2"),
    ).toThrow("createMigration: sql must ADD a column");
  });

  it("warns when the column name does not appear in the sql", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createMigration(
      "items",
      "tags",
      "ALTER TABLE items ADD COLUMN priority TEXT",
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"tags"'));
    warn.mockRestore();
  });

  it("does not warn when the column name appears in the sql", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createMigration(
      "items",
      "priority",
      "ALTER TABLE items ADD COLUMN priority TEXT",
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is case-insensitive for ALTER TABLE and ADD COLUMN keywords", () => {
    expect(() =>
      createMigration("t", "col", "alter table t add column col TEXT"),
    ).not.toThrow();
  });

  it("allows TEXT column type", () => {
    const m = createMigration(
      "notes",
      "body",
      "ALTER TABLE notes ADD COLUMN body TEXT",
    );
    expect(m.table).toBe("notes");
    expect(m.column).toBe("body");
  });

  it("allows INTEGER column with default", () => {
    const m = createMigration(
      "tasks",
      "done",
      "ALTER TABLE tasks ADD COLUMN done INTEGER DEFAULT 0",
    );
    expect(m.sql).toContain("DEFAULT 0");
  });
});

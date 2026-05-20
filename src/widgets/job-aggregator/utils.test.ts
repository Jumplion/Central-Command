import { afterEach, describe, expect, it, vi } from "vitest";
import { empTypeLabel, formatSalary, relativeDate, stripHtml } from "./utils";

describe("formatSalary", () => {
  it("formats min and max salary with period suffix", () => {
    expect(formatSalary(100000, 150000, "USD", "YEAR")).toBe("$100k–150k/yr");
  });

  it("formats minimum-only salary", () => {
    expect(formatSalary(950, null, "EUR", "HOUR")).toBe("€950+/hr");
  });

  it("formats maximum-only salary", () => {
    expect(formatSalary(null, 5000, "GBP", "MONTH")).toBe("Up to £5k/mo");
  });

  it("returns empty string when no values are provided", () => {
    expect(formatSalary()).toBe("");
  });
});

describe("relativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns friendly relative labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00.000Z"));

    expect(relativeDate("2026-01-10")).toBe("Today");
    expect(relativeDate("2026-01-09")).toBe("Yesterday");
    expect(relativeDate("2026-01-07")).toBe("3d ago");
    expect(relativeDate("2025-12-31")).toBe("1w ago");
  });

  it("returns formatted date for older entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));

    expect(relativeDate("2026-01-01")).toBe("Jan 1");
  });

  it("passes through invalid date strings", () => {
    expect(relativeDate("not-a-date")).toBe("not-a-date");
  });
});

describe("empTypeLabel", () => {
  it("maps known labels case-insensitively", () => {
    expect(empTypeLabel("fulltime")).toBe("Full-time");
    expect(empTypeLabel("PARTTIME")).toBe("Part-time");
  });

  it("returns original value for unknown labels", () => {
    expect(empTypeLabel("temporary")).toBe("temporary");
  });
});

describe("stripHtml", () => {
  it("removes tags and normalizes whitespace", () => {
    expect(
      stripHtml("  <p>Hello <strong>world</strong></p>\n<div>again</div>  "),
    ).toBe("Hello world again");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { today } from "../date";

describe("today", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current date in YYYY-MM-DD format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
    expect(today()).toBe("2026-03-15");
  });

  it("returns a string matching the ISO date pattern", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("zero-pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));
    expect(today()).toBe("2026-01-05");
  });
});

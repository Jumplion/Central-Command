import { describe, expect, it } from "vitest";
import {
  COMPANY_TYPE_COLORS,
  COMPANY_TYPE_LABELS,
  COMPANY_TYPE_ORDER,
  EMP_TYPES,
  FEED_COLORS,
  FEED_LABELS,
  MONTH_NAMES,
  SEED_VERSION,
  STATUSES,
  STATUS_COLORS,
} from "./constants";

describe("MONTH_NAMES", () => {
  it("has exactly 12 entries", () => {
    expect(MONTH_NAMES).toHaveLength(12);
  });

  it("has no duplicate month names", () => {
    expect(new Set(MONTH_NAMES).size).toBe(12);
  });
});

describe("STATUSES", () => {
  it("contains the expected statuses", () => {
    expect(STATUSES).toEqual([
      "Interested",
      "Applied",
      "Phone",
      "Onsite",
      "Offer",
      "Rejected",
    ]);
  });

  it("has no duplicate values", () => {
    expect(new Set(STATUSES).size).toBe(STATUSES.length);
  });
});

describe("STATUS_COLORS", () => {
  it("has a color entry for every status in STATUSES", () => {
    for (const status of STATUSES) {
      expect(STATUS_COLORS).toHaveProperty(status);
    }
  });

  it("every color value looks like a hex color", () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("no two statuses share the same color", () => {
    const colors = Object.values(STATUS_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

const FEED_TYPES = ["rss", "lever", "greenhouse", "search"] as const;

describe("FEED_COLORS", () => {
  it("has an entry for every feed type", () => {
    for (const type of FEED_TYPES) {
      expect(FEED_COLORS).toHaveProperty(type);
    }
  });

  it("every value looks like a hex color", () => {
    for (const color of Object.values(FEED_COLORS)) {
      expect(color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe("FEED_LABELS", () => {
  it("has a non-empty label for every feed type", () => {
    for (const type of FEED_TYPES) {
      expect(typeof FEED_LABELS[type]).toBe("string");
      expect(FEED_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("COMPANY_TYPE_ORDER / COMPANY_TYPE_LABELS / COMPANY_TYPE_COLORS", () => {
  it("COMPANY_TYPE_ORDER length matches COMPANY_TYPE_LABELS key count", () => {
    expect(COMPANY_TYPE_ORDER).toHaveLength(
      Object.keys(COMPANY_TYPE_LABELS).length,
    );
  });

  it("COMPANY_TYPE_ORDER length matches COMPANY_TYPE_COLORS key count", () => {
    expect(COMPANY_TYPE_ORDER).toHaveLength(
      Object.keys(COMPANY_TYPE_COLORS).length,
    );
  });

  it("every type in COMPANY_TYPE_ORDER has a label", () => {
    for (const type of COMPANY_TYPE_ORDER) {
      expect(COMPANY_TYPE_LABELS).toHaveProperty(type);
    }
  });

  it("every type in COMPANY_TYPE_ORDER has a hex color", () => {
    for (const type of COMPANY_TYPE_ORDER) {
      expect(COMPANY_TYPE_COLORS[type]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("has no duplicate types in COMPANY_TYPE_ORDER", () => {
    expect(new Set(COMPANY_TYPE_ORDER).size).toBe(COMPANY_TYPE_ORDER.length);
  });
});

describe("EMP_TYPES", () => {
  it('first entry is "all"', () => {
    expect(EMP_TYPES[0].value).toBe("all");
  });

  it("has no duplicate values", () => {
    const values = EMP_TYPES.map((e) => e.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("every entry has a non-empty label", () => {
    for (const entry of EMP_TYPES) {
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});

describe("SEED_VERSION", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(SEED_VERSION)).toBe(true);
    expect(SEED_VERSION).toBeGreaterThan(0);
  });
});

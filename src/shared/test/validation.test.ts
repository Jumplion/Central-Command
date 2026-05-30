import { describe, expect, it } from "vitest";
import { assertValidWidgetId, isValidWidgetId } from "../validation";

describe("isValidWidgetId", () => {
  it("accepts a single lowercase letter", () =>
    expect(isValidWidgetId("a")).toBe(true));
  it("accepts alphanumeric ids", () =>
    expect(isValidWidgetId("widget123")).toBe(true));
  it("accepts hyphens within the id", () =>
    expect(isValidWidgetId("job-aggregator")).toBe(true));
  it("accepts a 64-character id (maximum length)", () => {
    expect(isValidWidgetId("a" + "b".repeat(63))).toBe(true);
  });

  it("rejects an empty string", () => expect(isValidWidgetId("")).toBe(false));
  it("rejects ids that start with a hyphen", () =>
    expect(isValidWidgetId("-widget")).toBe(false));
  it("rejects ids with uppercase letters", () =>
    expect(isValidWidgetId("MyWidget")).toBe(false));
  it("rejects ids exceeding 64 characters", () => {
    expect(isValidWidgetId("a" + "b".repeat(64))).toBe(false);
  });
  it("rejects ids with underscores", () =>
    expect(isValidWidgetId("my_widget")).toBe(false));
  it("rejects ids with dots", () =>
    expect(isValidWidgetId("widget.one")).toBe(false));
  it("rejects ids with spaces", () =>
    expect(isValidWidgetId("my widget")).toBe(false));
  it("rejects path-traversal strings", () => {
    expect(isValidWidgetId("../etc")).toBe(false);
    expect(isValidWidgetId("../../passwd")).toBe(false);
  });
});

describe("assertValidWidgetId", () => {
  it("does not throw for a valid id", () => {
    expect(() => assertValidWidgetId("valid-id-123")).not.toThrow();
  });

  it("throws with a descriptive message for an empty string", () => {
    expect(() => assertValidWidgetId("")).toThrow("Invalid widget id");
  });

  it("throws for a path-traversal id", () => {
    expect(() => assertValidWidgetId("../evil")).toThrow(
      "Invalid widget id: ../evil",
    );
  });

  it("throws for an id with uppercase letters", () => {
    expect(() => assertValidWidgetId("UpperCase")).toThrow("Invalid widget id");
  });
});

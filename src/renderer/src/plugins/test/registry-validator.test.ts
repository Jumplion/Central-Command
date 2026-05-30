import { describe, expect, it } from "vitest";
import { getWidgetRegistrationError } from "../registry-validator";

describe("getWidgetRegistrationError", () => {
  const currentPlatform = "desktop" as const;

  it("returns undefined for a valid widget", () => {
    const widget = {
      default: {
        manifest: {
          id: "foo",
          name: "Foo",
          version: "0.1.0",
          defaultSize: { w: 2, h: 2 },
        },
        Component: () => null,
      },
    };
    const usedIds = new Set<string>();
    expect(
      getWidgetRegistrationError(widget, usedIds, currentPlatform),
    ).toBeUndefined();
  });

  it("rejects missing default export shape", () => {
    const widget = { default: { foo: "bar" } };
    expect(getWidgetRegistrationError(widget, new Set(), currentPlatform)).toBe(
      "export is not a valid widget",
    );
  });

  it("rejects invalid widget ids", () => {
    const widget = {
      default: {
        manifest: {
          id: "BadId",
          name: "Bad",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
        },
        Component: () => null,
      },
    };
    expect(getWidgetRegistrationError(widget, new Set(), currentPlatform)).toBe(
      'invalid widget id "BadId"',
    );
  });

  it("skips widgets for unsupported platforms without warning", () => {
    const widget = {
      default: {
        manifest: {
          id: "bar",
          name: "Bar",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
          platforms: ["mobile"],
        },
        Component: () => null,
      },
    };
    expect(getWidgetRegistrationError(widget, new Set(), currentPlatform)).toBe(
      "unsupported platform",
    );
  });

  it("rejects duplicate widget ids", () => {
    const widget = {
      default: {
        manifest: {
          id: "foo",
          name: "Foo",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
        },
        Component: () => null,
      },
    };
    const usedIds = new Set<string>(["foo"]);
    expect(getWidgetRegistrationError(widget, usedIds, currentPlatform)).toBe(
      'duplicate widget id "foo"',
    );
  });

  it("rejects a non-string manifest.id", () => {
    const widget = {
      default: {
        manifest: {
          id: 123,
          name: "Foo",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
        },
        Component: () => null,
      },
    };
    expect(getWidgetRegistrationError(widget, new Set(), currentPlatform)).toBe(
      "manifest.id must be a string",
    );
  });

  it("rejects a widget with no Component", () => {
    const widget = {
      default: {
        manifest: {
          id: "foo",
          name: "Foo",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
        },
      },
    };
    expect(getWidgetRegistrationError(widget, new Set(), currentPlatform)).toBe(
      "export is not a valid widget",
    );
  });

  it("accepts a widget that targets the current platform explicitly", () => {
    const widget = {
      default: {
        manifest: {
          id: "baz",
          name: "Baz",
          version: "0.1.0",
          defaultSize: { w: 1, h: 1 },
          platforms: ["desktop"],
        },
        Component: () => null,
      },
    };
    expect(
      getWidgetRegistrationError(widget, new Set(), currentPlatform),
    ).toBeUndefined();
  });
});

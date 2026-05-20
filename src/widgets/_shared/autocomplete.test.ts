import { describe, expect, it } from "vitest";
import {
  filterSuggestions,
  findSuggestion,
  normalizeSuggestionText,
} from "./autocomplete";

describe("autocomplete helpers", () => {
  it("normalizes text to lowercase trimmed string", () => {
    expect(normalizeSuggestionText("  FooBar  ")).toBe("foobar");
  });

  it("finds the first suggestion that starts with the current value", () => {
    expect(findSuggestion(["apple", "apricot", "banana"], "ap")).toBe("apple");
  });

  it("returns undefined when there is no suggestion", () => {
    expect(findSuggestion(["apple", "banana"], "orange")).toBeUndefined();
  });

  it("returns undefined for an empty value string", () => {
    expect(findSuggestion(["apple", "banana"], "")).toBeUndefined();
  });

  it("returns undefined for an empty suggestions array", () => {
    expect(findSuggestion([], "ap")).toBeUndefined();
  });

  it("returns undefined for undefined suggestions", () => {
    expect(findSuggestion(undefined, "ap")).toBeUndefined();
  });

  it("filters suggestions using a prefix and limits the result count", () => {
    expect(
      filterSuggestions(
        ["apple", "apricot", "apartment", "banana"],
        "ap",
        undefined,
        2,
      ),
    ).toEqual(["apple", "apricot"]);
  });

  it("ignores exact matches when filtering suggestions", () => {
    expect(
      filterSuggestions(["apple", "appletree", "apricot"], "apple"),
    ).toEqual(["appletree"]);
  });

  it("returns empty array for an empty value string", () => {
    expect(filterSuggestions(["apple", "banana"], "")).toEqual([]);
  });

  it("returns empty array for undefined suggestions", () => {
    expect(filterSuggestions(undefined, "ap")).toEqual([]);
  });

  it("uses accessor to extract label from object items", () => {
    const items = [
      { name: "apple pie" },
      { name: "apricot jam" },
      { name: "banana bread" },
    ];
    const accessor = (item: { name: string }) => item.name;
    expect(filterSuggestions(items, "ap", accessor)).toEqual([
      { name: "apple pie" },
      { name: "apricot jam" },
    ]);
  });

  it("findSuggestion uses accessor to match object items", () => {
    const items = [
      { label: "frontend" },
      { label: "fullstack" },
      { label: "backend" },
    ];
    const accessor = (item: { label: string }) => item.label;
    expect(findSuggestion(items, "fr", accessor)).toEqual({
      label: "frontend",
    });
  });

  it("findSuggestion excludes exact case-insensitive matches via accessor", () => {
    const items = [{ label: "apple" }, { label: "appletree" }];
    const accessor = (item: { label: string }) => item.label;
    expect(findSuggestion(items, "Apple", accessor)).toEqual({
      label: "appletree",
    });
  });

  it("applies default maxResults of 5", () => {
    const items = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
    expect(filterSuggestions(items, "a")).toHaveLength(5);
  });
});

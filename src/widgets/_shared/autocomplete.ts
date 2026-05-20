import type { CSSProperties } from "react";

export function normalizeSuggestionText(value: string): string {
  return value.trim().toLowerCase();
}

function getLabel<T>(item: T, accessor?: (item: T) => string): string {
  return accessor ? accessor(item) : String(item);
}

export function findSuggestion<T>(
  items: T[] | undefined,
  value: string,
  accessor?: (item: T) => string,
): T | undefined {
  const prefix = normalizeSuggestionText(value);
  if (!items?.length || !prefix) return undefined;
  return items.find((item) => {
    const label = normalizeSuggestionText(getLabel(item, accessor));
    return label.startsWith(prefix) && label !== prefix;
  });
}

export function filterSuggestions<T>(
  items: T[] | undefined,
  value: string,
  accessor?: (item: T) => string,
  maxResults = 5,
): T[] {
  const prefix = normalizeSuggestionText(value);
  if (!items?.length || !prefix) return [];
  return items
    .filter((item) => {
      const label = normalizeSuggestionText(getLabel(item, accessor));
      return label.startsWith(prefix) && label !== prefix;
    })
    .slice(0, maxResults);
}

export const autocompleteInputStyle: CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--panel-2)",
  color: "var(--text)",
  width: "100%",
  boxSizing: "border-box",
};

export const suggestionMenuStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "100%",
  marginTop: 6,
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
  zIndex: 20,
  overflow: "hidden",
};

export const suggestionItemStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  font: "inherit",
  color: "var(--text)",
  background: "transparent",
  border: "none",
  padding: "10px 12px",
  cursor: "pointer",
};

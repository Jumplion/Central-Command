import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listWidgets } from "@renderer/plugins/registry";
import { useDashboard } from "@renderer/state/dashboard";
import type { Widget } from "@renderer/plugins/registry";

const RECENT_KEY = "cc:widget-palette:recent";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function recordRecent(widgetId: string): string[] {
  const prev = loadRecent();
  const next = [widgetId, ...prev.filter((id) => id !== widgetId)].slice(
    0,
    MAX_RECENT,
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

/**
 * Returns a relevance score if every character of `query` appears in `target`
 * as a subsequence, or null if they don't. Consecutive runs and prefix matches
 * score higher so that tighter matches float to the top.
 */
function fuzzyScore(target: string, query: string): number | null {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let firstMatch = -1;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      if (firstMatch === -1) firstMatch = ti;
      score += 1 + consecutive * 2;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
    ti++;
  }
  if (qi < q.length) return null;
  if (firstMatch === 0) score += 20;
  if (t.includes(q)) score += 30;
  return score;
}

interface Section {
  label: string | null;
  widgets: Widget[];
  offset: number;
}

interface Props {
  onClose: () => void;
}

export function WidgetPalette({ onClose }: Props) {
  const allWidgets = useMemo(() => listWidgets(), []);
  const addInstance = useDashboard((s) => s.addInstance);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>(() => loadRecent());
  const resultsRef = useRef<HTMLDivElement>(null);

  const widgetById = useMemo(
    () => new Map(allWidgets.map((w) => [w.manifest.id, w])),
    [allWidgets],
  );

  const sections = useMemo<Section[]>(() => {
    const q = query.trim().toLowerCase();

    if (q) {
      const scored = allWidgets.flatMap((w) => {
        const best = Math.max(
          fuzzyScore(w.manifest.name, q) ?? -1,
          fuzzyScore(w.manifest.id, q) ?? -1,
          w.manifest.description
            ? (fuzzyScore(w.manifest.description, q) ?? -1)
            : -1,
        );
        return best >= 0 ? [{ widget: w, score: best }] : [];
      });
      scored.sort((a, b) => b.score - a.score);
      return [{ label: null, widgets: scored.map((s) => s.widget), offset: 0 }];
    }

    const recentSet = new Set(recentIds);
    const recent = recentIds.flatMap((id) => {
      const w = widgetById.get(id);
      return w ? [w] : [];
    });
    const rest = allWidgets.filter((w) => !recentSet.has(w.manifest.id));

    const result: Section[] = [];
    let offset = 0;
    if (recent.length > 0) {
      result.push({ label: "Recent", widgets: recent, offset });
      offset += recent.length;
    }
    if (rest.length > 0) {
      result.push({
        label: recent.length > 0 ? "All widgets" : null,
        widgets: rest,
        offset,
      });
    }
    return result;
  }, [allWidgets, widgetById, recentIds, query]);

  const totalItems = useMemo(
    () => sections.reduce((sum, s) => sum + s.widgets.length, 0),
    [sections],
  );

  useEffect(() => setSelectedIndex(0), [query]);

  useEffect(() => {
    resultsRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleAdd = useCallback(
    (widgetId: string) => {
      addInstance(widgetId);
      setRecentIds(recordRecent(widgetId));
      onClose();
    },
    [addInstance, onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        for (const section of sections) {
          const localIdx = selectedIndex - section.offset;
          if (localIdx >= 0 && localIdx < section.widgets.length) {
            handleAdd(section.widgets[localIdx].manifest.id);
            break;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, selectedIndex, totalItems, handleAdd, onClose]);

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="widget-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add widget"
        aria-modal="true"
      >
        <div className="palette-search-row">
          <input
            autoFocus
            className="palette-input"
            placeholder="Search widgets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search widgets"
          />
        </div>

        <div className="palette-results" ref={resultsRef}>
          {allWidgets.length === 0 ? (
            <div className="palette-empty">
              No widgets installed. Add a widget under <code>src/widgets/</code>
              .
            </div>
          ) : totalItems === 0 ? (
            <div className="palette-empty">
              No widgets match &ldquo;{query.trim()}&rdquo;.
            </div>
          ) : (
            sections.map((section, si) => (
              <div key={si}>
                {section.label && (
                  <div className="palette-section-label">{section.label}</div>
                )}
                <ul className="palette-list" role="listbox">
                  {section.widgets.map((w, wi) => {
                    const idx = section.offset + wi;
                    const isSelected = idx === selectedIndex;
                    return (
                      <li
                        key={w.manifest.id}
                        className={`palette-item${isSelected ? " selected" : ""}`}
                        data-selected={isSelected ? "true" : undefined}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleAdd(w.manifest.id)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <span className="palette-item-icon">
                          {w.manifest.icon ?? "◻"}
                        </span>
                        <div className="palette-item-text">
                          <span className="palette-item-name">
                            {w.manifest.name}
                          </span>
                          {w.manifest.description && (
                            <span className="palette-item-desc">
                              {w.manifest.description}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <span className="palette-item-action">↵ Add</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="palette-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> add widget
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

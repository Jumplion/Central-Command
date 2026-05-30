import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import {
  buttonSmall,
  buttonTiny,
  centeredEmptyState,
  dimText,
  inputBase,
} from "../_shared/styles";

const MAX_ITEMS = 50;
const TTL_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 1500;

interface ClipboardEntry {
  id: string;
  text: string;
  copiedAt: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

function ClipboardHistory({ api }: WidgetProps) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const initDoneRef = useRef(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.kv
      .get<ClipboardEntry[]>("history")
      .then((saved) => {
        const now = Date.now();
        setEntries((saved ?? []).filter((e) => now - e.copiedAt < TTL_MS));
      })
      .catch(() => {});
  }, [api]);

  const addEntry = useCallback(
    (text: string) => {
      const now = Date.now();
      setEntries((prev) => {
        const withoutExpired = prev.filter((e) => now - e.copiedAt < TTL_MS);
        if (withoutExpired[0]?.text === text) return withoutExpired;
        const next = [
          { id: crypto.randomUUID(), text, copiedAt: now },
          ...withoutExpired,
        ].slice(0, MAX_ITEMS);
        void api.kv.set("history", next);
        return next;
      });
    },
    [api],
  );

  useEffect(() => {
    const id = setInterval(() => {
      void (async () => {
        try {
          const text = await api.clipboard.read();
          if (!initDoneRef.current) {
            lastSeenRef.current = text;
            initDoneRef.current = true;
            return;
          }
          if (text && text !== lastSeenRef.current) {
            lastSeenRef.current = text;
            addEntry(text);
          }
        } catch {
          // clipboard unavailable; skip silently
        }
      })();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [api, addEntry]);

  const deleteEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        void api.kv.set("history", next);
        return next;
      });
    },
    [api],
  );

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copyEntry = useCallback(async (entry: ClipboardEntry) => {
    try {
      await writeClipboard(entry.text);
      lastSeenRef.current = entry.text;
      setCopiedId(entry.id);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopiedId((c) => (c === entry.id ? null : c));
      }, 1200);
    } catch {
      // ignore
    }
  }, []);

  const clearAll = useCallback(async () => {
    setEntries([]);
    await api.kv.set("history", []);
  }, [api]);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter((e) => e.text.toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search history…"
          style={{ ...inputBase, flex: 1 }}
        />
        {entries.length > 0 && (
          <button
            className="ghost danger"
            style={buttonSmall}
            onClick={() => void clearAll()}
            title="Clear all history"
          >
            Clear
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div style={{ ...dimText, fontSize: 11, flexShrink: 0 }}>
          {entries.length} {entries.length === 1 ? "item" : "items"} · last 24h
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          style={{
            ...centeredEmptyState,
            border: "1px dashed var(--border)",
            borderRadius: 6,
            fontSize: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          {query.trim()
            ? "No matches."
            : "Copy anything to start tracking history."}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {filtered.map((entry) => {
            const isHovered = hoveredId === entry.id;
            const isCopied = copiedId === entry.id;
            return (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => void copyEntry(entry)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") void copyEntry(entry);
                }}
                style={{
                  background: isCopied
                    ? "rgba(72,199,142,0.10)"
                    : isHovered
                      ? "rgba(110,168,255,0.06)"
                      : "var(--panel-2)",
                  border: isCopied
                    ? "1px solid rgba(72,199,142,0.4)"
                    : "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  cursor: "pointer",
                  transition: "background 0.1s, border-color 0.1s",
                  userSelect: "none",
                  outline: "none",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 6 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: isCopied ? "var(--accent)" : "var(--text)",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.4,
                        transition: "color 0.1s",
                      }}
                    >
                      {isCopied ? "✓ Copied!" : entry.text}
                    </div>
                    <div style={{ ...dimText, fontSize: 10, marginTop: 2 }}>
                      {relativeTime(entry.copiedAt)}
                    </div>
                  </div>
                  {isHovered && !isCopied && (
                    <button
                      className="ghost danger"
                      style={{ ...buttonTiny, flexShrink: 0, marginTop: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEntry(entry.id);
                      }}
                      title="Delete entry"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: "clipboard-history",
    name: "Clipboard History",
    description:
      "Tracks the last 50 clipboard items (24-hour window). Click any entry to restore.",
    version: "0.1.0",
    icon: "📋",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
  },
  Component: ClipboardHistory,
};

export default widget;

import { useState, useEffect, useCallback } from "react";
import type { Widget, WidgetProps } from "@renderer/plugins/registry";
import {
  buttonSmall,
  buttonTiny,
  dimText,
  centeredEmptyState,
} from "../_shared/styles";
import { NotConnected } from "../_shared/NotConnected";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

interface CalendarEventsResponse {
  items?: CalendarEvent[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function todayBounds(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function formatTime(dt: string | undefined, date: string | undefined): string {
  if (date && !dt) return "All day";
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateHeading(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isAllDay(event: CalendarEvent): boolean {
  return Boolean(event.start.date && !event.start.dateTime);
}

// ─── Sub-components ────────────────────────────────────────────────────────

function EventRow({
  event,
  onOpen,
}: {
  event: CalendarEvent;
  onOpen: (url: string) => void;
}) {
  const allDay = isAllDay(event);
  const startTime = formatTime(event.start.dateTime, event.start.date);
  const endTime = formatTime(event.end.dateTime, event.end.date);
  const timeLabel = allDay ? "All day" : `${startTime} – ${endTime}`;

  return (
    <div
      style={{
        padding: "8px 4px",
        borderBottom: "1px solid var(--border)",
        display: "grid",
        gridTemplateColumns: "80px 1fr auto",
        gap: "0 10px",
        alignItems: "start",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {timeLabel}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={event.summary}
        >
          {event.summary || "(No title)"}
        </div>
        {event.location && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 1,
            }}
            title={event.location}
          >
            📍 {event.location}
          </div>
        )}
        {event.description && !event.location && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-dim)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 1,
            }}
            title={event.description}
          >
            {event.description}
          </div>
        )}
      </div>
      {event.htmlLink && (
        <button
          className="ghost"
          style={{ ...buttonTiny, flexShrink: 0 }}
          onClick={() => onOpen(event.htmlLink!)}
          title="Open in Google Calendar"
        >
          ↗
        </button>
      )}
    </div>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────

function DailyCalendarWidget({ api, setTitle }: WidgetProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await api.google.shared.getToken();
      if (!token) {
        setConnected(false);
        return;
      }

      const { timeMin, timeMax } = todayBounds();
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      });

      const res = await api.net.fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        if (res.status === 401) {
          setConnected(false);
          setError("Session expired — please reconnect.");
        } else {
          throw new Error(`Calendar API error: ${res.status}`);
        }
        return;
      }

      const data = JSON.parse(res.body) as CalendarEventsResponse;
      const items = data.items ?? [];
      setEvents(items);
      setTitle?.(items.length > 0 ? `Calendar (${items.length})` : "Calendar");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, setTitle]);

  useEffect(() => {
    api.google.shared
      .isConnected()
      .then((c) => setConnected(c))
      .catch(() => setConnected(false));
  }, [api]);

  useEffect(() => {
    if (connected) void loadEvents();
  }, [connected, loadEvents]);

  const openEvent = (url: string) => {
    void api.shell.openExternal(url);
  };

  // ── Loading connection status ───────────────────────────────────────────
  if (connected === null) {
    return (
      <div style={{ padding: 12, ...dimText, fontSize: 12 }}>Loading…</div>
    );
  }

  // ── Not connected ───────────────────────────────────────────────────────
  if (!connected) {
    return <NotConnected />;
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexShrink: 0,
          paddingBottom: 4,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {formatDateHeading()}
        </span>
        <button
          className="ghost"
          style={buttonSmall}
          onClick={() => void loadEvents()}
          disabled={loading}
          title="Refresh events"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "var(--danger)", flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {events.length === 0 && !loading ? (
          <div
            style={{ ...centeredEmptyState, fontSize: 12, padding: "24px 0" }}
          >
            No events today.
          </div>
        ) : (
          events.map((event) => (
            <EventRow key={event.id} event={event} onOpen={openEvent} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: "daily-calendar",
    name: "Daily Calendar",
    description:
      "Shows today's events from your primary Google Calendar. Requires a Google Cloud OAuth app.",
    version: "0.1.0",
    icon: "📅",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 3, h: 4 },
    permissions: { google: true },
  },
  Component: DailyCalendarWidget,
};

export default widget;

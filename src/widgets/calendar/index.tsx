import { useState, useEffect, useCallback, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string;
}

interface CalendarInfo {
  id: string;
  name: string;
  color: string;
}

interface PositionedEvent {
  event: CalEvent;
  col: number;
  totalCols: number;
}

type ViewMode = 'day' | 'week';

// ─── Constants ─────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 48; // px per hour in the time grid

// ─── Date helpers ───────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Week starts on Monday */
function startOfWeek(d: Date): Date {
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parse Google Calendar date/dateTime fields as local time */
function parseGCalDate(dateStr?: string, dateTimeStr?: string): Date {
  if (dateTimeStr) return new Date(dateTimeStr);
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatTimeShort(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

function formatDayFull(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDayShort(d: Date): string {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${dow} ${d.getDate()}`;
}

// ─── Overlap layout ─────────────────────────────────────────────────────────

function eventsOverlap(a: CalEvent, b: CalEvent): boolean {
  return a.start < b.end && b.start < a.end;
}

function positionEvents(events: CalEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: PositionedEvent[] = sorted.map((event) => ({ event, col: 0, totalCols: 1 }));

  for (let i = 0; i < result.length; i++) {
    const usedCols = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (eventsOverlap(result[j].event, result[i].event)) {
        usedCols.add(result[j].col);
      }
    }
    let col = 0;
    while (usedCols.has(col)) col++;
    result[i].col = col;
  }

  for (let i = 0; i < result.length; i++) {
    let maxCol = result[i].col;
    for (let j = 0; j < result.length; j++) {
      if (i !== j && eventsOverlap(result[i].event, result[j].event)) {
        maxCol = Math.max(maxCol, result[j].col);
      }
    }
    result[i].totalCols = maxCol + 1;
  }

  return result;
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function fetchCalendarList(api: WidgetProps['api']): Promise<CalendarInfo[]> {
  const token = await api.google.getToken('calendar');
  if (!token) return [];

  const res = await api.net.fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList' +
      '?fields=items(id,summary,backgroundColor)',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Calendar list error: ${res.status}`);

  const data = JSON.parse(res.body) as {
    items?: { id: string; summary: string; backgroundColor?: string }[];
  };
  return (data.items ?? []).map((item) => ({
    id: item.id,
    name: item.summary,
    color: item.backgroundColor ?? '#4285f4',
  }));
}

async function fetchCalendarEvents(
  api: WidgetProps['api'],
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  color: string
): Promise<CalEvent[]> {
  const token = await api.google.getToken('calendar');
  if (!token) return [];

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
    fields: 'items(id,summary,start,end)',
  });

  const res = await api.net.fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    if (res.status === 404 || res.status === 403) return [];
    throw new Error(`Events fetch error: ${res.status}`);
  }

  const data = JSON.parse(res.body) as {
    items?: Array<{
      id: string;
      summary?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
    }>;
  };

  return (data.items ?? []).map((item) => {
    const allDay = !item.start.dateTime;
    const start = parseGCalDate(item.start.date, item.start.dateTime);
    const end = parseGCalDate(item.end.date, item.end.dateTime);
    return {
      id: `${calendarId}::${item.id}`,
      calendarId,
      title: item.summary ?? '(no title)',
      start,
      end,
      allDay,
      color,
    };
  });
}

// ─── Setup guide ────────────────────────────────────────────────────────────

function SetupGuide() {
  return (
    <div style={{ padding: '12px 10px', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
      <p style={{ marginBottom: 8, color: 'var(--text)', fontWeight: 500 }}>Setup required</p>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        <li>
          Create a project in{' '}
          <a href="https://console.cloud.google.com/" style={{ color: 'var(--accent)' }}>
            Google Cloud Console
          </a>
        </li>
        <li>
          Enable the <strong>Google Calendar API</strong>
        </li>
        <li>
          Create OAuth 2.0 credentials for a <strong>Desktop app</strong>
        </li>
        <li>Add your email as a test user under the OAuth consent screen</li>
        <li>Paste the Client ID and Client Secret in this widget&apos;s settings</li>
      </ol>
    </div>
  );
}

// ─── Day View ───────────────────────────────────────────────────────────────

function DayView({
  date,
  events,
  startHour,
  endHour,
}: {
  date: Date;
  events: CalEvent[];
  startHour: number;
  endHour: number;
}) {
  const totalHours = endHour - startHour;
  const containerHeight = totalHours * HOUR_HEIGHT;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    const scrollTop = Math.max(0, ((nowH - startHour - 1) / totalHours) * containerHeight);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
    // Only scroll on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayStart = startOfDay(date);
  const allDayEvents = events.filter(
    (e) => e.allDay && e.start <= dayStart && e.end > dayStart
  );
  const timedEvents = events.filter((e) => !e.allDay && isSameDay(e.start, date));
  const visibleTimed = timedEvents.filter((e) => {
    const eEnd = e.end.getHours() + e.end.getMinutes() / 60;
    const eStart = e.start.getHours() + e.start.getMinutes() / 60;
    return eEnd > startHour && eStart < endHour;
  });
  const positioned = positionEvents(visibleTimed);

  const now = new Date();
  const isToday = isSameDay(date, now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowTop =
    isToday && nowH >= startHour && nowH <= endHour
      ? ((nowH - startHour) / totalHours) * containerHeight
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {allDayEvents.length > 0 && (
        <div
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '3px 4px 3px 50px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            flexShrink: 0,
          }}
        >
          <span
            style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: '18px', marginRight: 2 }}
          >
            All day
          </span>
          {allDayEvents.map((e) => (
            <span
              key={e.id}
              title={e.title}
              style={{
                background: e.color,
                color: '#fff',
                borderRadius: 3,
                padding: '1px 6px',
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 220,
              }}
            >
              {e.title}
            </span>
          ))}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', height: containerHeight, position: 'relative' }}>
          {/* Time labels */}
          <div style={{ width: 46, flexShrink: 0, position: 'relative' }}>
            {Array.from({ length: totalHours }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * HOUR_HEIGHT - 7,
                  left: 0,
                  width: 46,
                  textAlign: 'right',
                  paddingRight: 6,
                  fontSize: 9,
                  color: 'var(--text-dim)',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {formatHour(startHour + i)}
              </div>
            ))}
          </div>

          {/* Events column */}
          <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--border)' }}>
            {/* Hour lines */}
            {Array.from({ length: totalHours }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * HOUR_HEIGHT,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'var(--border)',
                  pointerEvents: 'none',
                }}
              />
            ))}

            {/* Now indicator */}
            {nowTop !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: nowTop,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--accent)',
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -4,
                    top: -3,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              </div>
            )}

            {/* Events */}
            {positioned.map(({ event, col, totalCols }) => {
              const eStartH = Math.max(
                event.start.getHours() + event.start.getMinutes() / 60,
                startHour
              );
              const eEndH = Math.min(
                event.end.getHours() + event.end.getMinutes() / 60,
                endHour
              );
              const top = ((eStartH - startHour) / totalHours) * containerHeight;
              const height = Math.max(((eEndH - eStartH) / totalHours) * containerHeight, 20);
              const colW = 100 / totalCols;

              return (
                <div
                  key={event.id}
                  title={`${event.title}\n${formatTimeShort(event.start)} – ${formatTimeShort(event.end)}`}
                  style={{
                    position: 'absolute',
                    top: top + 1,
                    height: height - 2,
                    left: `calc(${col * colW}% + 1px)`,
                    width: `calc(${colW}% - 2px)`,
                    background: `${event.color}28`,
                    borderLeft: `3px solid ${event.color}`,
                    color: 'var(--text)',
                    borderRadius: '0 3px 3px 0',
                    padding: '1px 4px',
                    fontSize: 11,
                    overflow: 'hidden',
                    cursor: 'default',
                    boxSizing: 'border-box',
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '15px',
                    }}
                  >
                    {event.title}
                  </div>
                  {height >= 34 && (
                    <div style={{ fontSize: 10, opacity: 0.65, lineHeight: '13px' }}>
                      {formatTimeShort(event.start)} – {formatTimeShort(event.end)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  events,
  startHour,
  endHour,
}: {
  weekStart: Date;
  events: CalEvent[];
  startHour: number;
  endHour: number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const totalHours = endHour - startHour;
  const containerHeight = totalHours * HOUR_HEIGHT;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const nowH = now.getHours() + now.getMinutes() / 60;
    const scrollTop = Math.max(0, ((nowH - startHour - 1) / totalHours) * containerHeight);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
    // Only scroll on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDayByDay = days.map((day) => {
    const dayStart = startOfDay(day);
    return events.filter((e) => e.allDay && e.start <= dayStart && e.end > dayStart);
  });
  const hasAllDay = allDayByDay.some((d) => d.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      {/* Day headers */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(7, 1fr)' }}>
          <div />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.getTime()}
                style={{
                  textAlign: 'center',
                  padding: '4px 2px',
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--accent)' : 'var(--text)',
                  borderLeft: '1px solid var(--border)',
                  userSelect: 'none',
                }}
              >
                {formatDayShort(day)}
              </div>
            );
          })}
        </div>

        {hasAllDay && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '36px repeat(7, 1fr)',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 3,
                paddingBottom: 2,
              }}
            >
              all
            </div>
            {allDayByDay.map((dayEvents, i) => (
              <div
                key={i}
                style={{
                  borderLeft: '1px solid var(--border)',
                  padding: '1px 2px',
                  minHeight: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {dayEvents.map((e) => (
                  <div
                    key={e.id}
                    title={e.title}
                    style={{
                      background: e.color,
                      color: '#fff',
                      borderRadius: 2,
                      fontSize: 10,
                      padding: '0 3px',
                      lineHeight: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px repeat(7, 1fr)',
            height: containerHeight,
          }}
        >
          {/* Time labels */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: totalHours }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * HOUR_HEIGHT - 7,
                  right: 3,
                  fontSize: 9,
                  color: 'var(--text-dim)',
                  userSelect: 'none',
                  textAlign: 'right',
                  pointerEvents: 'none',
                }}
              >
                {formatHour(startHour + i)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const dayTimed = events.filter((e) => !e.allDay && isSameDay(e.start, day));
            const visible = dayTimed.filter((e) => {
              const eEnd = e.end.getHours() + e.end.getMinutes() / 60;
              const eStart = e.start.getHours() + e.start.getMinutes() / 60;
              return eEnd > startHour && eStart < endHour;
            });
            const positioned = positionEvents(visible);

            const nowH = today.getHours() + today.getMinutes() / 60;
            const nowTop =
              isToday && nowH >= startHour && nowH <= endHour
                ? ((nowH - startHour) / totalHours) * containerHeight
                : null;

            return (
              <div
                key={day.getTime()}
                style={{
                  position: 'relative',
                  borderLeft: '1px solid var(--border)',
                  background: isToday ? 'color-mix(in srgb, var(--accent) 4%, transparent)' : undefined,
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--border)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Now indicator */}
                {nowTop !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: nowTop,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--accent)',
                      zIndex: 5,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Events */}
                {positioned.map(({ event, col, totalCols }) => {
                  const eStartH = Math.max(
                    event.start.getHours() + event.start.getMinutes() / 60,
                    startHour
                  );
                  const eEndH = Math.min(
                    event.end.getHours() + event.end.getMinutes() / 60,
                    endHour
                  );
                  const top = ((eStartH - startHour) / totalHours) * containerHeight;
                  const height = Math.max(((eEndH - eStartH) / totalHours) * containerHeight, 14);
                  const colW = 100 / totalCols;

                  return (
                    <div
                      key={event.id}
                      title={`${event.title}\n${formatTimeShort(event.start)} – ${formatTimeShort(event.end)}`}
                      style={{
                        position: 'absolute',
                        top: top + 1,
                        height: height - 2,
                        left: `${col * colW}%`,
                        width: `${colW}%`,
                        background: `${event.color}28`,
                        borderLeft: `2px solid ${event.color}`,
                        color: 'var(--text)',
                        fontSize: 10,
                        padding: '0 2px',
                        overflow: 'hidden',
                        cursor: 'default',
                        boxSizing: 'border-box',
                        zIndex: 1,
                        borderRadius: '0 2px 2px 0',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '13px',
                        }}
                      >
                        {event.title}
                      </div>
                      {height >= 28 && (
                        <div style={{ fontSize: 9, opacity: 0.65, lineHeight: '12px' }}>
                          {formatTimeShort(event.start)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main widget ────────────────────────────────────────────────────────────

function CalendarWidget({ api, settings, setTitle }: WidgetProps) {
  const clientId = (settings.googleClientId as string) ?? '';
  const clientSecret = (settings.googleClientSecret as string) ?? '';
  const defaultView = (settings.defaultView as ViewMode) ?? 'week';
  const startHour = Math.max(0, Math.min(22, Number(settings.startHour ?? 7)));
  const endHour = Math.max(startHour + 2, Math.min(24, Number(settings.endHour ?? 22)));

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<ViewMode>(defaultView);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [showCalPicker, setShowCalPicker] = useState(false);

  const calPickerContainerRef = useRef<HTMLDivElement>(null);

  // Load persisted hidden-calendar list
  useEffect(() => {
    api.kv
      .get('hiddenCalendars')
      .then((val) => {
        if (typeof val === 'string') {
          try {
            setHiddenCalendars(new Set(JSON.parse(val) as string[]));
          } catch {
            // ignore corrupt stored value
          }
        }
      })
      .catch(() => {});
  }, [api]);

  const persistHiddenCalendars = useCallback(
    (hidden: Set<string>) => {
      void api.kv.set('hiddenCalendars', JSON.stringify([...hidden]));
    },
    [api]
  );

  // Click-outside to close calendar picker
  useEffect(() => {
    if (!showCalPicker) return;
    const handler = (e: MouseEvent) => {
      if (!calPickerContainerRef.current?.contains(e.target as Node)) {
        setShowCalPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCalPicker]);

  // Check connection
  useEffect(() => {
    if (!clientId || !clientSecret) {
      setConnected(false);
      return;
    }
    api.google
      .isConnected('calendar')
      .then(setConnected)
      .catch(() => setConnected(false));
  }, [api, clientId, clientSecret]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cals = await fetchCalendarList(api);
      setCalendars(cals);

      let rangeStart: Date, rangeEnd: Date;
      if (view === 'day') {
        rangeStart = startOfDay(currentDate);
        rangeEnd = endOfDay(currentDate);
      } else {
        const ws = startOfWeek(currentDate);
        rangeStart = ws;
        rangeEnd = endOfDay(addDays(ws, 6));
      }

      const visibleCals = cals.filter((c) => !hiddenCalendars.has(c.id));
      const allEvents = (
        await Promise.all(
          visibleCals.map((cal) =>
            fetchCalendarEvents(api, cal.id, rangeStart, rangeEnd, cal.color)
          )
        )
      ).flat();
      setEvents(allEvents);

      if (view === 'day') {
        setTitle?.(formatDayFull(currentDate));
      } else {
        const ws = startOfWeek(currentDate);
        const we = addDays(ws, 6);
        const fmt = (d: Date) =>
          d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        setTitle?.(`${fmt(ws)} – ${fmt(we)}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, view, currentDate, hiddenCalendars, setTitle]);

  useEffect(() => {
    if (connected) void loadData();
  }, [connected, loadData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => void loadData(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [connected, loadData]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((d) => addDays(d, dir * (view === 'day' ? 1 : 7)));
  };

  const goToday = () => setCurrentDate(new Date());

  const toggleCalendar = (id: string) => {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistHiddenCalendars(next);
      return next;
    });
  };

  // ── Not configured ───────────────────────────────────────────────────────
  if (!clientId || !clientSecret) return <SetupGuide />;

  // ── Checking connection ──────────────────────────────────────────────────
  if (connected === null) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>Loading…</div>
    );
  }

  // ── Not connected ────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>📅</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
          Connect your Google account to see calendar events.
        </p>
        <button
          className="primary"
          style={{ fontSize: 13, padding: '6px 16px' }}
          disabled={connecting}
          onClick={() => {
            setConnecting(true);
            setError(null);
            api.google
              .connect({ clientId, clientSecret, service: 'calendar' })
              .then(() => setConnected(true))
              .catch((e: Error) => setError(e.message))
              .finally(() => setConnecting(false));
          }}
        >
          {connecting ? 'Waiting for browser…' : 'Connect with Google'}
        </button>
        {error && (
          <p style={{ fontSize: 11, color: 'var(--danger)', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  const weekStart = startOfWeek(currentDate);

  const dateLabel =
    view === 'day'
      ? formatDayFull(currentDate)
      : (() => {
          const ws = weekStart;
          const we = addDays(ws, 6);
          const fmt = (d: Date) =>
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return `${fmt(ws)} – ${fmt(we)}, ${we.getFullYear()}`;
        })();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '3px 4px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          className="ghost"
          style={{ padding: '2px 7px', fontSize: 14, lineHeight: 1 }}
          onClick={() => navigate(-1)}
          title="Previous"
        >
          ‹
        </button>
        <button
          className="ghost"
          style={{ padding: '2px 6px', fontSize: 11 }}
          onClick={goToday}
        >
          Today
        </button>
        <button
          className="ghost"
          style={{ padding: '2px 7px', fontSize: 14, lineHeight: 1 }}
          onClick={() => navigate(1)}
          title="Next"
        >
          ›
        </button>

        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginLeft: 2,
          }}
        >
          {dateLabel}
        </span>

        {/* View toggle */}
        {(['day', 'week'] as const).map((v) => (
          <button
            key={v}
            className={view === v ? 'primary' : 'ghost'}
            style={{ padding: '1px 8px', fontSize: 11 }}
            onClick={() => setView(v)}
          >
            {v === 'day' ? 'Day' : 'Week'}
          </button>
        ))}

        {/* Calendar picker toggle */}
        <div ref={calPickerContainerRef} style={{ position: 'relative' }}>
          <button
            className={showCalPicker ? 'primary' : 'ghost'}
            style={{ padding: '2px 6px', fontSize: 11 }}
            onClick={() => setShowCalPicker((v) => !v)}
            title="Select calendars"
          >
            ☰
          </button>

          {showCalPicker && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                zIndex: 30,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 0',
                minWidth: 190,
                maxWidth: 260,
                maxHeight: 260,
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  padding: '0 10px 4px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Calendars
              </div>
              {calendars.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 10px' }}>
                  No calendars found
                </div>
              )}
              {calendars.map((cal) => {
                const visible = !hiddenCalendars.has(cal.id);
                return (
                  <div
                    key={cal.id}
                    onClick={() => toggleCalendar(cal.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--text)',
                    }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 3,
                        background: visible ? cal.color : 'transparent',
                        border: `2px solid ${cal.color}`,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cal.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          className="ghost"
          style={{ padding: '2px 6px', fontSize: 11 }}
          onClick={() => void loadData()}
          disabled={loading}
          title="Refresh"
        >
          {loading ? '…' : '↻'}
        </button>

        {/* Disconnect */}
        <button
          className="ghost danger"
          style={{ padding: '2px 6px', fontSize: 11 }}
          title="Disconnect Google account"
          onClick={() => {
            void api.google.disconnect('calendar').then(() => {
              setConnected(false);
              setEvents([]);
              setCalendars([]);
            });
          }}
        >
          ✕
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', padding: '2px 6px', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* View content */}
      {loading && events.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontSize: 12,
          }}
        >
          Loading events…
        </div>
      ) : view === 'day' ? (
        <DayView
          date={currentDate}
          events={events}
          startHour={startHour}
          endHour={endHour}
        />
      ) : (
        <WeekView
          weekStart={weekStart}
          events={events}
          startHour={startHour}
          endHour={endHour}
        />
      )}
    </div>
  );
}

// ─── Widget export ──────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'calendar',
    name: 'Calendar',
    description:
      'Google Calendar with Day and Week views. Requires a Google Cloud OAuth app with Calendar API enabled.',
    version: '0.1.0',
    icon: '📅',
    defaultSize: { w: 8, h: 9 },
    minSize: { w: 5, h: 6 },
    permissions: { google: true },
    settings: [
      {
        kind: 'string',
        key: 'googleClientId',
        label: 'Google Client ID',
        placeholder: 'Paste your OAuth 2.0 Client ID',
      },
      {
        kind: 'string',
        key: 'googleClientSecret',
        label: 'Google Client Secret',
        placeholder: 'Paste your OAuth 2.0 Client Secret',
      },
      {
        kind: 'select',
        key: 'defaultView',
        label: 'Default view',
        default: 'week',
        options: [
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
        ],
      },
      {
        kind: 'number',
        key: 'startHour',
        label: 'Start hour (0–22)',
        default: 7,
        min: 0,
        max: 22,
        step: 1,
      },
      {
        kind: 'number',
        key: 'endHour',
        label: 'End hour (2–24)',
        default: 22,
        min: 2,
        max: 24,
        step: 1,
      },
    ],
  },
  Component: CalendarWidget,
};

export default widget;

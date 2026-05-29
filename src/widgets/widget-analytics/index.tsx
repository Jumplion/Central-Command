import { useState, useEffect, useCallback, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import { useSqlInit } from '@renderer/hooks/useSqlInit';
import { namedSql } from '@renderer/plugins/sqlParams';
import { subscribeWidgetEvents } from '@renderer/plugins/apiEvents';
import type { WidgetLifecycleEvent } from '@renderer/plugins/apiEvents';
import { LineChart, WidgetLoading, TabBar } from '../_shared';
import type { TabDef } from '../_shared';
import { buttonSmall, dimText } from '../_shared/styles';
import {
  INIT_SQL, MIGRATIONS,
  UPSERT_USAGE, UPSERT_DAILY,
  SELECT_TOP_WIDGETS, SELECT_DAILY_SERIES,
} from './constants';
import type { UsageRow, DailyRow } from './types';

// -- Helpers -----------------------------------------------------------------

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function buildChartData(
  rows: DailyRow[],
  dayCount: number,
): Array<{ label: string; mounts: number }> {
  const map = new Map(rows.map((r) => [r.day, r.mount_count]));
  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(Date.now() - (dayCount - 1 - i) * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    return { label, mounts: map.get(day) ?? 0 };
  });
}

function exportCsvData(rows: UsageRow[]): void {
  const header = ['Widget', 'Mounts', 'Total Time (s)', 'Avg Session (s)', 'Last Accessed'];
  const body = rows.map((r) => [
    r.widget_id,
    String(r.mount_count),
    (r.total_duration_ms / 1000).toFixed(1),
    r.mount_count > 0 ? (r.total_duration_ms / r.mount_count / 1000).toFixed(1) : '0',
    new Date(r.last_accessed_at).toISOString(),
  ]);
  const csv = [header, ...body]
    .map((row) => row.map((v) => JSON.stringify(v)).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `widget-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -- Component ---------------------------------------------------------------

type TabId = 'table' | 'chart';

const TABS: TabDef<TabId>[] = [
  { value: 'table', label: 'Usage Table' },
  { value: 'chart', label: 'Daily Chart' },
];

const CHART_SERIES = [{ key: 'mounts', color: 'var(--accent)' }];

function WidgetAnalytics({ api, settings }: WidgetProps) {
  const ready = useSqlInit(api, INIT_SQL, MIGRATIONS);
  const [topWidgets, setTopWidgets] = useState<UsageRow[]>([]);
  const [dailySeries, setDailySeries] = useState<DailyRow[]>([]);
  const [tab, setTab] = useState<TabId>('table');

  const dayCount = Number(settings?.chartDays ?? 14);

  const loadData = useCallback(async () => {
    const sinceDay = new Date(Date.now() - dayCount * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [top, daily] = await Promise.all([
      api.sql.all<UsageRow>(SELECT_TOP_WIDGETS),
      api.sql.all<DailyRow>(...namedSql(SELECT_DAILY_SERIES, { since_day: sinceDay })),
    ]);
    setTopWidgets(top);
    setDailySeries(daily);
  }, [api, dayCount]);

  useEffect(() => {
    if (ready) void loadData();
  }, [ready, loadData]);

  // Keep a stable ref so the lifecycle event handler always calls the latest loadData
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  useEffect(() => {
    if (!ready) return;
    return subscribeWidgetEvents((event: WidgetLifecycleEvent) => {
      if (event.kind !== 'unmount') return;
      // Don't track self to avoid feedback loop
      if (event.widgetId === 'widget-analytics') return;
      // Filter out React strict-mode phantom unmounts (< 100 ms)
      if ((event.durationMs ?? 0) < 100) return;

      const day = new Date(event.timestamp).toISOString().slice(0, 10);

      void (async () => {
        await api.sql.run(
          ...namedSql(UPSERT_USAGE, {
            widget_id: event.widgetId,
            instance_id: event.instanceId,
            mount_count: 1,
            total_duration_ms: event.durationMs ?? 0,
            last_accessed_at: event.timestamp,
          }),
        );
        await api.sql.run(
          ...namedSql(UPSERT_DAILY, {
            widget_id: event.widgetId,
            day,
            mount_count: 1,
            total_duration_ms: event.durationMs ?? 0,
          }),
        );
        void loadDataRef.current();
      })();
    });
  }, [ready, api]);

  if (!ready) return <WidgetLoading />;

  const chartData = buildChartData(dailySeries, dayCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: 4 }}>
      {/* Header row: tabs + export button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <TabBar tabs={TABS} active={tab} onChange={setTab} />
        <button
          className="ghost small"
          style={{ ...buttonSmall, marginLeft: 'auto' }}
          onClick={() => exportCsvData(topWidgets)}
        >
          Export CSV
        </button>
      </div>

      {/* Usage Table */}
      {tab === 'table' && (
        topWidgets.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              textAlign: 'center',
              ...dimText,
            }}
          >
            No usage data yet. Widgets will be tracked as you use them.
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px' }}>Widget</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Mounts</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Avg Session</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px' }}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {topWidgets.map((r) => (
                  <tr key={r.widget_id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontSize: 11 }}>
                      {r.widget_id}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right' }}>
                      {r.mount_count}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--text-dim)' }}>
                      {r.mount_count > 0
                        ? `${(r.total_duration_ms / r.mount_count / 1000).toFixed(1)}s`
                        : '—'}
                    </td>
                    <td
                      style={{
                        padding: '5px 6px',
                        textAlign: 'right',
                        color: 'var(--text-dim)',
                        fontSize: 10,
                      }}
                    >
                      {r.last_accessed_at > 0 ? fmtRelative(r.last_accessed_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Daily Chart */}
      {tab === 'chart' && (
        chartData.every((d) => d.mounts === 0) ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              textAlign: 'center',
              ...dimText,
            }}
          >
            No data in the last {dayCount} days.
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <LineChart data={chartData} series={CHART_SERIES} />
          </div>
        )
      )}
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: 'widget-analytics',
    name: 'Widget Analytics',
    description:
      'Tracks widget mount counts and session durations. Shows usage stats, daily chart, and CSV export.',
    version: '0.1.0',
    icon: '📊',
    defaultSize: { w: 5, h: 8 },
    minSize: { w: 4, h: 5 },
    permissions: { sqlite: true },
    settings: [
      {
        kind: 'number',
        key: 'chartDays',
        label: 'Chart window (days)',
        default: 14,
      },
    ],
  },
  Component: WidgetAnalytics,
};

export default widget;

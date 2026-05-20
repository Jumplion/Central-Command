import { useState, useEffect } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import { subscribeApiCalls } from '@renderer/plugins/apiEvents';
import type { ApiCallRecord } from '@renderer/plugins/apiEvents';
import { WidgetLoading } from '../_shared';

const MAX_STORED = 500;

const PERIOD_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const PERIOD_LABEL: Record<string, string> = {
  '1h': 'hour',
  '6h': '6 hours',
  '24h': '24 hours',
};

function ApiTracker({ api, settings, setTitle }: WidgetProps) {
  const [calls, setCalls] = useState<ApiCallRecord[]>([]);
  const [ready, setReady] = useState(false);

  const limit = Math.max(1, Number(settings.limit ?? 100));
  const period = String(settings.period ?? '1h');
  const warnAt = Math.max(1, Math.min(99, Number(settings.warnAt ?? 80)));

  const periodMs = PERIOD_MS[period] ?? PERIOD_MS['1h'];
  const periodLabel = PERIOD_LABEL[period] ?? 'hour';

  useEffect(() => {
    api.kv.get<ApiCallRecord[]>('calls').then((stored) => {
      if (Array.isArray(stored)) setCalls(stored);
      setReady(true);
    });
  }, [api]);

  useEffect(() => {
    return subscribeApiCalls((record) => {
      setCalls((prev) => {
        const next = [...prev, record].slice(-MAX_STORED);
        void api.kv.set('calls', next);
        return next;
      });
    });
  }, [api]);

  const now = Date.now();
  const periodCalls = calls.filter((c) => now - c.timestamp <= periodMs);
  const count = periodCalls.length;
  const pct = Math.min(100, Math.round((count / limit) * 100));
  const isWarning = pct >= warnAt;
  const isOver = count >= limit;
  const gaugeColor = isOver ? '#ef4444' : isWarning ? '#f59e0b' : '#34d399';

  const byWidget = periodCalls.reduce<Record<string, number>>((acc, c) => {
    acc[c.widgetId] = (acc[c.widgetId] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (isOver) setTitle('API Limit Reached');
    else if (isWarning) setTitle('API Near Limit');
    else setTitle(undefined);
  }, [isOver, isWarning, setTitle]);

  if (!ready) return <WidgetLoading />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>

      {/* Gauge */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
          <span style={{ color: 'var(--text-dim)' }}>
            Net calls this {periodLabel}
          </span>
          <span style={{ fontWeight: 600, color: isOver ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text)' }}>
            {count} / {limit}
          </span>
        </div>
        <div style={{ height: 10, background: 'var(--panel-2)', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: gaugeColor,
              borderRadius: 5,
              transition: 'width 0.3s, background 0.3s',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: 'var(--text-dim)' }}>
          <span>0</span>
          <span style={{ color: isWarning ? '#f59e0b55' : 'var(--border)' }}>
            {warnAt}%
          </span>
          <span>{limit}</span>
        </div>
      </div>

      {/* Warning banner */}
      {(isWarning || isOver) && (
        <div
          style={{
            flexShrink: 0,
            padding: '6px 10px',
            borderRadius: 6,
            background: isOver ? '#ef444418' : '#f59e0b18',
            border: `1px solid ${isOver ? '#ef444455' : '#f59e0b55'}`,
            color: isOver ? '#ef4444' : '#f59e0b',
            fontSize: 12,
          }}
        >
          {isOver
            ? `Limit exceeded — ${count} / ${limit} calls this ${periodLabel}`
            : `${limit - count} call${limit - count !== 1 ? 's' : ''} remaining this ${periodLabel}`}
        </div>
      )}

      {/* Per-widget breakdown */}
      {Object.keys(byWidget).length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>By widget</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(byWidget)
              .sort((a, b) => b[1] - a[1])
              .map(([wid, cnt]) => (
                <div key={wid} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-dim)', fontFamily: 'monospace', flexShrink: 0 }}>
                    {wid}
                  </span>
                  <div style={{ flex: 1, height: 6, background: 'var(--panel-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.round((cnt / count) * 100)}%`,
                        background: 'var(--accent)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span style={{ width: 24, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>{cnt}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent calls log */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5 }}>
          Recent calls
          {periodCalls.length > 0 && ` (${periodCalls.length})`}
        </div>
        {periodCalls.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', paddingTop: 16 }}>
            No API calls this {periodLabel}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...periodCalls].reverse().map((c, i) => {
              const host = (() => {
                try { return new URL(c.url).hostname; } catch { return c.url; }
              })();
              const path = (() => {
                try { return new URL(c.url).pathname; } catch { return ''; }
              })();
              const age = Math.round((now - c.timestamp) / 1000);
              const ageLabel = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 28px 1fr auto auto',
                    gap: 4,
                    alignItems: 'center',
                    padding: '3px 6px',
                    borderRadius: 4,
                    background: 'var(--panel-2)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ fontWeight: 700, color: c.ok ? '#34d399' : '#ef4444', fontSize: 10 }}>
                    {c.status}
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{c.method}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.url}>
                    <span style={{ color: 'var(--text)' }}>{host}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{path}</span>
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10, whiteSpace: 'nowrap' }}>
                    {c.duration}ms
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10, whiteSpace: 'nowrap' }}>
                    {ageLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear */}
      <button
        style={{ fontSize: 11, padding: '3px 8px', alignSelf: 'flex-end', flexShrink: 0 }}
        onClick={() => {
          setCalls([]);
          void api.kv.set('calls', []);
        }}
      >
        Clear history
      </button>
    </div>
  );
}

const widget: Widget = {
  manifest: {
    id: 'api-tracker',
    name: 'API Tracker',
    description: 'Tracks net.fetch calls from all widgets and warns when approaching your configured rate limit.',
    version: '0.1.0',
    icon: '📡',
    defaultSize: { w: 5, h: 9 },
    minSize: { w: 4, h: 5 },
    settings: [
      {
        kind: 'number',
        key: 'limit',
        label: 'Call limit',
        default: 100,
        min: 1,
        step: 1,
      },
      {
        kind: 'select',
        key: 'period',
        label: 'Period',
        default: '1h',
        options: [
          { value: '1h', label: 'Per hour' },
          { value: '6h', label: 'Per 6 hours' },
          { value: '24h', label: 'Per 24 hours' },
        ],
      },
      {
        kind: 'number',
        key: 'warnAt',
        label: 'Warn at (%)',
        default: 80,
        min: 1,
        max: 99,
        step: 1,
      },
    ],
  },
  Component: ApiTracker,
};

export default widget;

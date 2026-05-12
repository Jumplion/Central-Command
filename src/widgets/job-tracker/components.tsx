import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Application, AppFormData, Status } from './types';
import { STATUSES, STATUS_COLOR } from './types';

export const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company      TEXT    NOT NULL,
    role         TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'Applied',
    applied_at   TEXT    NOT NULL,
    source       TEXT    NOT NULL DEFAULT '',
    link         TEXT    NOT NULL DEFAULT '',
    notes        TEXT    NOT NULL DEFAULT '',
    last_updated INTEGER NOT NULL
  );
`;

export const today = (): string => new Date().toISOString().slice(0, 10);

// ─── StatusBar ────────────────────────────────────────────────────────────

export function StatusBar({
  counts, total, filter, onFilter,
}: {
  counts: Record<Status, number>;
  total: number;
  filter: Status | 'All';
  onFilter: (f: Status | 'All') => void;
}) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
        <Chip active={filter === 'All'} color="var(--accent)" onClick={() => onFilter('All')}>
          All ({total})
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={filter === s} color={STATUS_COLOR[s]} onClick={() => onFilter(s)}>
            {s} ({counts[s]})
          </Chip>
        ))}
      </div>
      {total > 0 && (
        <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
          {STATUSES.filter((s) => counts[s] > 0).map((s) => (
            <div
              key={s}
              style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS_COLOR[s] }}
              title={`${s}: ${counts[s]}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────

export function Chip({ active, color, onClick, children }: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        background: active ? color + '22' : 'transparent',
        border: active ? `1px solid ${color}55` : '1px solid transparent',
        color: active ? color : 'var(--text-dim)',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 0.1s',
      }}
    >
      {children}
    </button>
  );
}

// ─── AppForm ──────────────────────────────────────────────────────────────

const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

export function AppForm({ initial, onSave, onCancel }: {
  initial?: Application;
  onSave: (data: AppFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AppFormData>({
    company: initial?.company ?? '',
    role: initial?.role ?? '',
    status: initial?.status ?? 'Applied',
    applied_at: initial?.applied_at ?? today(),
    source: initial?.source ?? '',
    link: initial?.link ?? '',
    notes: initial?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof AppFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--panel-2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input style={inp} placeholder="Company *" value={form.company} onChange={set('company')} required />
        <input style={inp} placeholder="Role *" value={form.role} onChange={set('role')} required />
        <select style={inp} value={form.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input style={inp} type="date" value={form.applied_at} onChange={set('applied_at')} />
        <input style={inp} placeholder="Source (LinkedIn, referral…)" value={form.source} onChange={set('source')} />
        <input style={inp} placeholder="Link" value={form.link} onChange={set('link')} />
      </div>
      <textarea
        style={{ ...inp, resize: 'vertical', minHeight: 44 }}
        placeholder="Notes"
        value={form.notes}
        onChange={set('notes')}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" className="primary" style={{ fontSize: 12, padding: '4px 10px' }} disabled={saving}>
          {initial ? 'Save' : 'Add'}
        </button>
        <button type="button" className="ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── WeeklyChart ──────────────────────────────────────────────────────────

export function WeeklyChart({ apps }: { apps: Application[] }) {
  const data = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weeks: { label: string; start: Date }[] = [];

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay()); // anchor to Sunday
      weeks.push({
        label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: weekStart,
      });
    }

    return weeks.map(({ label, start }) => {
      const weekEnd = new Date(start);
      weekEnd.setDate(start.getDate() + 7);
      const weekApps = apps.filter((a) => {
        const d = new Date(a.applied_at);
        return d >= start && d < weekEnd;
      });
      const entry: Record<string, string | number> = { label };
      STATUSES.forEach((s) => { entry[s] = weekApps.filter((a) => a.status === s).length; });
      return entry;
    });
  }, [apps]);

  if (apps.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        No applications yet
      </div>
    );
  }

  const tooltipStyle = {
    background: 'var(--panel-2)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 11,
    color: 'var(--text)',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        Applications by week (applied date) — last 8 weeks
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            {STATUSES.map((s) => (
              <Bar key={s} dataKey={s} stackId="week" fill={STATUS_COLOR[s]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ padding: '4px 6px', fontWeight: 500, fontSize: 11, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  );
}

export function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '5px 6px', verticalAlign: 'middle' }}>{children}</td>;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      style={{
        background: STATUS_COLOR[status] + '22',
        color: STATUS_COLOR[status],
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}

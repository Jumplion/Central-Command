import { useState, useMemo } from 'react';
import { StackedBarChart } from '@widgets/_shared/StackedBarChart';
import type { Audition, AuditionFormData, CastingSite, ProjectType, Status } from './types';
import { CASTING_SITES, PROJECT_TYPES, STATUSES, STATUS_COLOR } from './constants';
import { formatAgo, recencyColor, today } from './helpers';

// ─── Chip ──────────────────────────────────────────────────────────────────────

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

// ─── SiteRow ───────────────────────────────────────────────────────────────────

export function SiteRow({
  checks, onVisit,
}: {
  checks: Record<string, number>;
  onVisit: (site: CastingSite) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
      {CASTING_SITES.map((site) => {
        const ts = checks[site.id];
        const color = recencyColor(ts);
        return (
          <button
            key={site.id}
            onClick={() => onVisit(site)}
            title={ts
              ? `Last checked ${new Date(ts).toLocaleString()}`
              : 'Not yet checked — click to open and mark checked'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              padding: '3px 8px',
              background: 'var(--panel-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <span>{site.name}</span>
            <span style={{ color, fontWeight: 600, fontSize: 10 }}>{formatAgo(ts)}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── StatusBar ─────────────────────────────────────────────────────────────────

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

// ─── TypeBar ───────────────────────────────────────────────────────────────────

export function TypeBar({
  counts, filter, onFilter,
}: {
  counts: Record<ProjectType, number>;
  filter: ProjectType | 'All';
  onFilter: (f: ProjectType | 'All') => void;
}) {
  const total = PROJECT_TYPES.reduce((s, t) => s + counts[t], 0);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
      <Chip active={filter === 'All'} color="var(--text-dim)" onClick={() => onFilter('All')}>
        All types ({total})
      </Chip>
      {PROJECT_TYPES.map((t) => (
        <Chip key={t} active={filter === t} color="var(--accent)" onClick={() => onFilter(t)}>
          {t} ({counts[t]})
        </Chip>
      ))}
    </div>
  );
}

// ─── AuditionForm ──────────────────────────────────────────────────────────────

const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

export function AuditionForm({ initial, onSave, onCancel }: {
  initial?: Audition;
  onSave: (data: AuditionFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AuditionFormData>({
    project_title:       initial?.project_title       ?? '',
    role:                initial?.role                ?? '',
    project_type:        initial?.project_type        ?? 'Film',
    status:              initial?.status              ?? 'Interested',
    casting_studio:      initial?.casting_studio      ?? '',
    location:            initial?.location            ?? '',
    pay_rate:            initial?.pay_rate            ?? '',
    submitted_at:        initial?.submitted_at        ?? today(),
    submission_deadline: initial?.submission_deadline ?? '',
    shoot_date:          initial?.shoot_date          ?? '',
    link:                initial?.link                ?? '',
    notes:               initial?.notes               ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof AuditionFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_title.trim()) return;
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
        <input style={inp} placeholder="Project title *" value={form.project_title} onChange={set('project_title')} required />
        <input style={inp} placeholder="Role" value={form.role} onChange={set('role')} />
        <select style={inp} value={form.project_type} onChange={set('project_type')}>
          {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select style={inp} value={form.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input style={inp} placeholder="Casting studio / director" value={form.casting_studio} onChange={set('casting_studio')} />
        <input style={inp} placeholder="Location (city, remote, self-tape…)" value={form.location} onChange={set('location')} />
        <input style={inp} placeholder="Pay rate (e.g. SAG scale, $250/day)" value={form.pay_rate} onChange={set('pay_rate')} />
        <input style={inp} placeholder="Link" value={form.link} onChange={set('link')} />
        <label style={{ ...inp, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>Submitted</span>
          <input style={{ ...inp, flex: 1 }} type="date" value={form.submitted_at} onChange={set('submitted_at')} />
        </label>
        <label style={{ ...inp, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>Deadline</span>
          <input style={{ ...inp, flex: 1 }} type="date" value={form.submission_deadline} onChange={set('submission_deadline')} />
        </label>
        <label style={{ ...inp, display: 'flex', alignItems: 'center', gap: 4, padding: 0, gridColumn: '1 / span 2' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>Shoot date</span>
          <input style={{ ...inp, flex: 1 }} type="date" value={form.shoot_date} onChange={set('shoot_date')} />
        </label>
      </div>
      <textarea
        style={{ ...inp, resize: 'vertical', minHeight: 44 }}
        placeholder="Notes (sides, wardrobe, conflicts…)"
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

// ─── WeeklyChart ───────────────────────────────────────────────────────────────

export function WeeklyChart({ auditions }: { auditions: Audition[] }) {
  const data = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const weeks: { label: string; start: Date }[] = [];

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      weeks.push({
        label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: weekStart,
      });
    }

    return weeks.map(({ label, start }) => {
      const weekEnd = new Date(start);
      weekEnd.setDate(start.getDate() + 7);
      const weekAuds = auditions.filter((a) => {
        if (!a.submitted_at) return false;
        const d = new Date(a.submitted_at);
        return d >= start && d < weekEnd;
      });
      const entry: Record<string, string | number> = { label };
      STATUSES.forEach((s) => { entry[s] = weekAuds.filter((a) => a.status === s).length; });
      return entry;
    });
  }, [auditions]);

  if (auditions.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        No auditions yet
      </div>
    );
  }

  const series = useMemo(() => STATUSES.map((s) => ({ key: s, color: STATUS_COLOR[s] })), []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        Auditions by week (submitted date) — last 8 weeks
      </div>
      <StackedBarChart data={data} series={series} />
    </div>
  );
}

// ─── Table helpers ─────────────────────────────────────────────────────────────

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ padding: '4px 6px', fontWeight: 500, fontSize: 11, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  );
}

export function Td({ children, dim }: { children?: React.ReactNode; dim?: boolean }) {
  return (
    <td style={{ padding: '5px 6px', verticalAlign: 'middle', color: dim ? 'var(--text-dim)' : undefined }}>
      {children}
    </td>
  );
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

export function DeadlineCell({ date }: { date: string }) {
  if (!date) return <Td dim>—</Td>;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const color =
    days < 0 ? STATUS_COLOR.Passed :
    days <= 3 ? STATUS_COLOR.Callback :
    undefined;
  return (
    <td style={{ padding: '5px 6px', color, fontWeight: color ? 600 : undefined }}>
      {date}
    </td>
  );
}

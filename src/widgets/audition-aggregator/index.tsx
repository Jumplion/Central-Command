import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ExtensionTab } from './ExtensionTab';

// ─── Enums ─────────────────────────────────────────────────────────────────

type Status = 'Interested' | 'Submitted' | 'Callback' | 'Booked' | 'Released' | 'Passed';
const STATUSES: Status[] = ['Interested', 'Submitted', 'Callback', 'Booked', 'Released', 'Passed'];
const STATUS_COLOR: Record<Status, string> = {
  Interested: '#6ea8ff',
  Submitted:  '#a78bfa',
  Callback:   '#f59e0b',
  Booked:     '#34d399',
  Released:   '#6b7280',
  Passed:     '#ff6e6e',
};

type ProjectType = 'Film' | 'TV' | 'Commercial' | 'Theater' | 'Voiceover' | 'Student/Indie';
const PROJECT_TYPES: ProjectType[] = ['Film', 'TV', 'Commercial', 'Theater', 'Voiceover', 'Student/Indie'];

// ─── Domain ────────────────────────────────────────────────────────────────

interface Audition {
  id: number;
  project_title: string;
  role: string;
  project_type: ProjectType;
  status: Status;
  casting_studio: string;
  location: string;
  pay_rate: string;
  submitted_at: string;
  submission_deadline: string;
  shoot_date: string;
  link: string;
  notes: string;
  last_updated: number;
}

type AuditionFormData = Omit<Audition, 'id' | 'last_updated'>;

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS auditions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_title       TEXT    NOT NULL,
    role                TEXT    NOT NULL DEFAULT '',
    project_type        TEXT    NOT NULL DEFAULT 'Film',
    status              TEXT    NOT NULL DEFAULT 'Interested',
    casting_studio      TEXT    NOT NULL DEFAULT '',
    location            TEXT    NOT NULL DEFAULT '',
    pay_rate            TEXT    NOT NULL DEFAULT '',
    submitted_at        TEXT    NOT NULL,
    submission_deadline TEXT    NOT NULL DEFAULT '',
    shoot_date          TEXT    NOT NULL DEFAULT '',
    link                TEXT    NOT NULL DEFAULT '',
    notes               TEXT    NOT NULL DEFAULT '',
    last_updated        INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_checks (
    site_id      TEXT    PRIMARY KEY,
    last_checked INTEGER NOT NULL
  );
`;

const today = () => new Date().toISOString().slice(0, 10);

// ─── Casting sites ─────────────────────────────────────────────────────────

interface CastingSite {
  id: string;
  name: string;
  url: string;
}

const CASTING_SITES: CastingSite[] = [
  { id: 'actors-access',    name: 'Actors Access',    url: 'https://actorsaccess.com/' },
  { id: 'backstage',        name: 'Backstage',        url: 'https://www.backstage.com/casting/' },
  { id: 'casting-networks', name: 'Casting Networks', url: 'https://www.castingnetworks.com/' },
  { id: 'casting-frontier', name: 'Casting Frontier', url: 'https://castingfrontier.com/' },
  { id: 'project-casting',  name: 'Project Casting',  url: 'https://www.projectcasting.com/' },
  { id: 'nycastings',       name: 'NYCastings',       url: 'https://www.nycastings.com/casting-calls/' },
  { id: 'playbill',         name: 'Playbill Jobs',    url: 'https://playbill.com/jobs' },
  { id: 'voice123',         name: 'Voice123',         url: 'https://voice123.com/' },
  { id: 'voices',           name: 'Voices.com',       url: 'https://www.voices.com/' },
];

// Format ms-since-checked as a compact relative string.
function formatAgo(ts: number | undefined): string {
  if (!ts) return 'never';
  const delta = Date.now() - ts;
  const min = Math.floor(delta / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.floor(day / 30);
  return `${mo}mo`;
}

// Color tier by recency.
function recencyColor(ts: number | undefined): string {
  if (!ts) return 'var(--text-dim)';
  const hr = (Date.now() - ts) / 3_600_000;
  if (hr < 24) return '#34d399';        // green: checked today
  if (hr < 24 * 4) return 'var(--text)'; // neutral: 1-3 days
  if (hr < 24 * 7) return '#f59e0b';    // amber: 4-6 days
  return '#ff6e6e';                      // red: 7+ days
}

// ─── CSV helpers ───────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const CSV_HEADERS = [
  'project_title', 'role', 'project_type', 'status', 'casting_studio',
  'location', 'pay_rate', 'submitted_at', 'submission_deadline', 'shoot_date',
  'link', 'notes',
] as const;

// ─── Filter chips ──────────────────────────────────────────────────────────

function Chip({ active, color, onClick, children }: {
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

function SiteRow({
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

function StatusBar({
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

function TypeBar({
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

// ─── Form ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

function AuditionForm({ initial, onSave, onCancel }: {
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

// ─── Weekly chart ──────────────────────────────────────────────────────────

function WeeklyChart({ auditions }: { auditions: Audition[] }) {
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
        Auditions by week (submitted date) — last 8 weeks
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

// ─── Row helpers ───────────────────────────────────────────────────────────

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ padding: '4px 6px', fontWeight: 500, fontSize: 11, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  );
}

function Td({ children, dim }: { children?: React.ReactNode; dim?: boolean }) {
  return (
    <td style={{ padding: '5px 6px', verticalAlign: 'middle', color: dim ? 'var(--text-dim)' : undefined }}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: Status }) {
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

// Deadline cell: red if today/overdue, amber within 3 days, dim otherwise.
function DeadlineCell({ date }: { date: string }) {
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

// ─── Main widget ───────────────────────────────────────────────────────────

function AuditionAggregator({ api }: WidgetProps) {
  const [auds, setAuds] = useState<Audition[]>([]);
  const [siteChecks, setSiteChecks] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'All'>('All');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'list' | 'chart' | 'extension'>('list');
  const [importing, setImporting] = useState(false);
  const [ready, setReady] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const rows = await api.sql.all<Audition>(
      'SELECT * FROM auditions ORDER BY last_updated DESC'
    );
    setAuds(rows);
  }, [api]);

  const loadSiteChecks = useCallback(async () => {
    const rows = await api.sql.all<{ site_id: string; last_checked: number }>(
      'SELECT site_id, last_checked FROM site_checks'
    );
    setSiteChecks(Object.fromEntries(rows.map((r) => [r.site_id, r.last_checked])));
  }, [api]);

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(async () => {
      await Promise.all([load(), loadSiteChecks()]);
      setReady(true);
    });
  }, []);

  const handleVisitSite = useCallback(async (site: CastingSite) => {
    const now = Date.now();
    setSiteChecks((prev) => ({ ...prev, [site.id]: now }));
    await api.shell.openExternal(site.url);
    await api.sql.run(
      `INSERT INTO site_checks (site_id, last_checked) VALUES (?, ?)
       ON CONFLICT(site_id) DO UPDATE SET last_checked = excluded.last_checked`,
      [site.id, now]
    );
  }, [api]);

  const statusCounts = STATUSES.reduce<Record<Status, number>>(
    (acc, s) => { acc[s] = auds.filter((a) => a.status === s).length; return acc; },
    {} as Record<Status, number>
  );
  const typeCounts = PROJECT_TYPES.reduce<Record<ProjectType, number>>(
    (acc, t) => { acc[t] = auds.filter((a) => a.project_type === t).length; return acc; },
    {} as Record<ProjectType, number>
  );

  const filtered = auds.filter((a) =>
    (statusFilter === 'All' || a.status === statusFilter) &&
    (typeFilter === 'All' || a.project_type === typeFilter)
  );

  const handleAdd = async (data: AuditionFormData) => {
    await api.sql.run(
      `INSERT INTO auditions
       (project_title, role, project_type, status, casting_studio, location, pay_rate,
        submitted_at, submission_deadline, shoot_date, link, notes, last_updated)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.project_title, data.role, data.project_type, data.status, data.casting_studio,
        data.location, data.pay_rate, data.submitted_at, data.submission_deadline, data.shoot_date,
        data.link, data.notes, Date.now(),
      ]
    );
    await load();
    setShowAdd(false);
  };

  const handleEdit = (aud: Audition) => async (data: AuditionFormData) => {
    await api.sql.run(
      `UPDATE auditions SET
         project_title=?, role=?, project_type=?, status=?, casting_studio=?,
         location=?, pay_rate=?, submitted_at=?, submission_deadline=?, shoot_date=?,
         link=?, notes=?, last_updated=?
       WHERE id=?`,
      [
        data.project_title, data.role, data.project_type, data.status, data.casting_studio,
        data.location, data.pay_rate, data.submitted_at, data.submission_deadline, data.shoot_date,
        data.link, data.notes, Date.now(), aud.id,
      ]
    );
    await load();
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    await api.sql.run('DELETE FROM auditions WHERE id=?', [id]);
    await load();
  };

  const handleExportCSV = () => {
    const header = CSV_HEADERS.join(',');
    const rows = auds.map((a) =>
      CSV_HEADERS.map((h) => `"${String(a[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'auditions.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      for (const line of lines.slice(1)) {
        const fields = parseCSVLine(line);
        if (fields.length < 1 || !fields[0]) continue;
        const [
          project_title, role = '', project_type_raw = 'Film', status_raw = 'Interested',
          casting_studio = '', location = '', pay_rate = '',
          submitted_at = '', submission_deadline = '', shoot_date = '',
          link = '', notes = '',
        ] = fields;
        const project_type = (PROJECT_TYPES as string[]).includes(project_type_raw) ? project_type_raw : 'Film';
        const status = (STATUSES as string[]).includes(status_raw) ? status_raw : 'Interested';
        await api.sql.run(
          `INSERT INTO auditions
           (project_title, role, project_type, status, casting_studio, location, pay_rate,
            submitted_at, submission_deadline, shoot_date, link, notes, last_updated)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            project_title, role, project_type, status, casting_studio,
            location, pay_rate, submitted_at || today(), submission_deadline, shoot_date,
            link, notes, Date.now(),
          ]
        );
      }
      await load();
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (!ready) return <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <SiteRow checks={siteChecks} onVisit={handleVisitSite} />
      <StatusBar counts={statusCounts} total={auds.length} filter={statusFilter} onFilter={setStatusFilter} />
      <TypeBar counts={typeCounts} filter={typeFilter} onFilter={setTypeFilter} />

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button
          className="primary"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => { setShowAdd(true); setEditingId(null); setView('list'); }}
        >
          + Add
        </button>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {(['list', 'chart', 'extension'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                background: view === v ? 'var(--accent)22' : 'transparent',
                color: view === v ? 'var(--accent)' : 'var(--text-dim)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {v === 'list' ? 'List' : v === 'chart' ? 'Chart' : '🧩 Extension'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <input
            ref={importRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => importRef.current?.click()}
            disabled={importing}
            title="Import CSV"
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={handleExportCSV}
            title="Export all as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>

      {showAdd && (
        <AuditionForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {view === 'extension' ? (
        <ExtensionTab api={api} onAuditionAdded={load} />
      ) : view === 'chart' ? (
        <WeeklyChart auditions={auds} />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', padding: '16px 0', textAlign: 'center', fontSize: 13 }}>
              {auds.length === 0
                ? 'No auditions yet — click + Add to log your first breakdown.'
                : 'No results for this filter.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <Th>Project</Th>
                  <Th>Role</Th>
                  <Th>Type</Th>
                  <Th>Status</Th>
                  <Th>Casting</Th>
                  <Th>Location</Th>
                  <Th>Pay</Th>
                  <Th>Deadline</Th>
                  <Th>Shoot</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((aud) =>
                  editingId === aud.id ? (
                    <tr key={aud.id}>
                      <td colSpan={10} style={{ padding: '4px 0' }}>
                        <AuditionForm initial={aud} onSave={handleEdit(aud)} onCancel={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={aud.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td>{aud.project_title}</Td>
                      <Td dim={!aud.role}>{aud.role || '—'}</Td>
                      <Td>{aud.project_type}</Td>
                      <Td><StatusBadge status={aud.status} /></Td>
                      <Td dim={!aud.casting_studio}>{aud.casting_studio || '—'}</Td>
                      <Td dim={!aud.location}>{aud.location || '—'}</Td>
                      <Td dim={!aud.pay_rate}>{aud.pay_rate || '—'}</Td>
                      <DeadlineCell date={aud.submission_deadline} />
                      <Td dim={!aud.shoot_date}>{aud.shoot_date || '—'}</Td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {aud.link && (
                          <button
                            className="ghost"
                            style={{ fontSize: 11, padding: '1px 6px' }}
                            onClick={() => void api.shell.openExternal(aud.link)}
                            title="Open link"
                          >
                            ↗
                          </button>
                        )}
                        <button
                          className="ghost"
                          style={{ fontSize: 11, padding: '1px 6px' }}
                          onClick={() => setEditingId(aud.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost danger"
                          style={{ fontSize: 11, padding: '1px 6px' }}
                          onClick={() => handleDelete(aud.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'audition-aggregator',
    name: 'Audition Aggregator',
    description: 'Track acting auditions by project type, casting studio, deadline, shoot date, and pay rate. Status pipeline from Interested through Booked.',
    version: '0.1.0',
    icon: '🎭',
    defaultSize: { w: 9, h: 8 },
    minSize: { w: 6, h: 6 },
    permissions: { sqlite: true },
  },
  Component: AuditionAggregator,
};

export default widget;

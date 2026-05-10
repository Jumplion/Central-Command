import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

type Status = 'Applied' | 'Phone' | 'Onsite' | 'Offer' | 'Rejected' | 'Ghosted';
const STATUSES: Status[] = ['Applied', 'Phone', 'Onsite', 'Offer', 'Rejected', 'Ghosted'];
const STATUS_COLOR: Record<Status, string> = {
  Applied: '#6ea8ff',
  Phone: '#a78bfa',
  Onsite: '#f59e0b',
  Offer: '#34d399',
  Rejected: '#ff6e6e',
  Ghosted: '#6b7280',
};

interface Application {
  id: number;
  company: string;
  role: string;
  status: Status;
  applied_at: string;
  source: string;
  link: string;
  notes: string;
  last_updated: number;
}

type AppFormData = Omit<Application, 'id' | 'last_updated'>;

const INIT_SQL = `
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

const today = () => new Date().toISOString().slice(0, 10);

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

// ─── Sub-components ────────────────────────────────────────────────────────

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

const inp: React.CSSProperties = { fontSize: 12, padding: '4px 6px' };

function AppForm({ initial, onSave, onCancel }: {
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

// ─── Weekly burndown chart ─────────────────────────────────────────────────

function WeeklyChart({ apps }: { apps: Application[] }) {
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

// ─── Main widget ───────────────────────────────────────────────────────────

function JobTracker({ api }: WidgetProps) {
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Status | 'All'>('All');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'list' | 'chart'>('list');
  const [importing, setImporting] = useState(false);
  const [ready, setReady] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const rows = await api.sql.all<Application>(
      'SELECT * FROM applications ORDER BY last_updated DESC'
    );
    setApps(rows);
  }, [api]);

  useEffect(() => {
    api.sql.exec(INIT_SQL).then(() => {
      load();
      setReady(true);
    });
  }, []);

  const counts = STATUSES.reduce<Record<Status, number>>(
    (acc, s) => { acc[s] = apps.filter((a) => a.status === s).length; return acc; },
    {} as Record<Status, number>
  );

  const filtered = filter === 'All' ? apps : apps.filter((a) => a.status === filter);

  const handleAdd = async (data: AppFormData) => {
    await api.sql.run(
      'INSERT INTO applications (company,role,status,applied_at,source,link,notes,last_updated) VALUES (?,?,?,?,?,?,?,?)',
      [data.company, data.role, data.status, data.applied_at, data.source, data.link, data.notes, Date.now()]
    );
    await load();
    setShowAdd(false);
  };

  const handleEdit = (app: Application) => async (data: AppFormData) => {
    await api.sql.run(
      'UPDATE applications SET company=?,role=?,status=?,applied_at=?,source=?,link=?,notes=?,last_updated=? WHERE id=?',
      [data.company, data.role, data.status, data.applied_at, data.source, data.link, data.notes, Date.now(), app.id]
    );
    await load();
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    await api.sql.run('DELETE FROM applications WHERE id=?', [id]);
    await load();
  };

  const handleExportCSV = () => {
    const header = 'company,role,status,applied_at,source,link,notes';
    const rows = apps.map((a) =>
      [a.company, a.role, a.status, a.applied_at, a.source, a.link, a.notes]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applications.csv';
    a.click();
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
        if (fields.length < 4) continue;
        const [company, role, status, applied_at, source = '', link = '', notes = ''] = fields;
        if (!company || !role) continue;
        const safeStatus = (STATUSES as string[]).includes(status) ? status : 'Applied';
        await api.sql.run(
          'INSERT INTO applications (company,role,status,applied_at,source,link,notes,last_updated) VALUES (?,?,?,?,?,?,?,?)',
          [company, role, safeStatus, applied_at || today(), source, link, notes, Date.now()]
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
      <StatusBar counts={counts} total={apps.length} filter={filter} onFilter={setFilter} />

      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <button
          className="primary"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={() => { setShowAdd(true); setEditingId(null); setView('list'); }}
        >
          + Add
        </button>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          {(['list', 'chart'] as const).map((v) => (
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
              {v === 'list' ? 'List' : 'Chart'}
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
        <AppForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      )}

      {view === 'chart' ? (
        <WeeklyChart apps={apps} />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', padding: '16px 0', textAlign: 'center', fontSize: 13 }}>
              {apps.length === 0 ? 'No applications yet — click + Add to get started.' : 'No results for this filter.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <Th>Company</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Applied</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) =>
                  editingId === app.id ? (
                    <tr key={app.id}>
                      <td colSpan={5} style={{ padding: '4px 0' }}>
                        <AppForm initial={app} onSave={handleEdit(app)} onCancel={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={app.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <Td>{app.company}</Td>
                      <Td>{app.role}</Td>
                      <Td><StatusBadge status={app.status} /></Td>
                      <Td>{app.applied_at}</Td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {app.link && (
                          <button
                            className="ghost"
                            style={{ fontSize: 11, padding: '1px 6px' }}
                            onClick={() => void api.shell.openExternal(app.link)}
                            title="Open link"
                          >
                            ↗
                          </button>
                        )}
                        <button
                          className="ghost"
                          style={{ fontSize: 11, padding: '1px 6px' }}
                          onClick={() => setEditingId(app.id)}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost danger"
                          style={{ fontSize: 11, padding: '1px 6px' }}
                          onClick={() => handleDelete(app.id)}
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th style={{ padding: '4px 6px', fontWeight: 500, fontSize: 11, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  );
}

function Td({ children }: { children?: React.ReactNode }) {
  return <td style={{ padding: '5px 6px', verticalAlign: 'middle' }}>{children}</td>;
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

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'job-tracker',
    name: 'Job Tracker',
    description: 'Track job applications with status, weekly chart, and CSV import/export.',
    version: '0.2.0',
    icon: '💼',
    defaultSize: { w: 8, h: 8 },
    minSize: { w: 5, h: 5 },
    permissions: { sqlite: true },
  },
  Component: JobTracker,
};

export default widget;

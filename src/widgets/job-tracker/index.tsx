import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';
import { useSqlInit } from '@renderer/hooks/useSqlInit';
import { STATUSES, STATUS_COLOR } from './types';
import type { Application, AppFormData, Status } from './types';
import { parseCSVLine } from './csv';
import {
  INIT_SQL, EMAIL_INIT_SQL, SCHEMA_MIGRATIONS, today,
  StatusBar, AppForm, WeeklyChart,
  Th, Td, StatusBadge,
} from './components';
import { EmailsTab } from './EmailsTab';

function JobTracker({ api }: WidgetProps) {
  const [apps, setApps] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Status | 'All'>('All');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'list' | 'chart' | 'emails'>('list');
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const ready = useSqlInit(api, INIT_SQL + EMAIL_INIT_SQL, SCHEMA_MIGRATIONS);

  const load = useCallback(async () => {
    const rows = await api.sql.all<Application>(
      'SELECT * FROM applications ORDER BY last_updated DESC'
    );
    setApps(rows);
  }, [api]);

  useEffect(() => {
    if (ready) void load();
  }, [ready]);

  const counts = useMemo(() => {
    const acc = STATUSES.reduce<Record<Status, number>>(
      (a, s) => { a[s] = 0; return a; },
      {} as Record<Status, number>
    );
    for (const a of apps) if (a.status in acc) acc[a.status as Status]++;
    return acc;
  }, [apps]);

  const filtered = useMemo(
    () => (filter === 'All' ? apps : apps.filter((a) => a.status === filter)),
    [apps, filter]
  );

  const handleAdd = async (data: AppFormData) => {
    await api.sql.run(
      'INSERT INTO applications (company,role,status,applied_at,source,link,notes,req_number,last_updated) VALUES (?,?,?,?,?,?,?,?,?)',
      [data.company, data.role, data.status, data.applied_at, data.source, data.link, data.notes, data.req_number, Date.now()]
    );
    await load();
    setShowAdd(false);
  };

  const handleEdit = (app: Application) => async (data: AppFormData) => {
    await api.sql.run(
      'UPDATE applications SET company=?,role=?,status=?,applied_at=?,source=?,link=?,notes=?,req_number=?,last_updated=? WHERE id=?',
      [data.company, data.role, data.status, data.applied_at, data.source, data.link, data.notes, data.req_number, Date.now(), app.id]
    );
    await load();
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    await api.sql.run('DELETE FROM applications WHERE id=?', [id]);
    await load();
  };

  const handleExportCSV = () => {
    const header = 'company,role,status,applied_at,source,link,notes,req_number';
    const rows = apps.map((a) =>
      [a.company, a.role, a.status, a.applied_at, a.source, a.link, a.notes, a.req_number]
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
        const [company, role, status, applied_at, source = '', link = '', notes = '', req_number = ''] = fields;
        if (!company || !role) continue;
        const safeStatus = (STATUSES as string[]).includes(status) ? status : 'Applied';
        await api.sql.run(
          'INSERT INTO applications (company,role,status,applied_at,source,link,notes,req_number,last_updated) VALUES (?,?,?,?,?,?,?,?,?)',
          [company, role, safeStatus, applied_at || today(), source, link, notes, req_number, Date.now()]
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
          {(['list', 'chart', 'emails'] as const).map((v) => (
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
              {v === 'list' ? 'List' : v === 'chart' ? 'Chart' : 'Emails'}
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

      {view === 'emails' ? (
        <EmailsTab
          api={api}
          apps={apps}
          onAppAdded={load}
          onAppUpdated={load}
        />
      ) : view === 'chart' ? (
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
                  <Th>Req #</Th>
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
                    <tr
                      key={app.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(110, 168, 255, 0.07)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                      <Td>{app.company}</Td>
                      <Td>{app.role}</Td>
                      <Td><StatusBadge status={app.status} /></Td>
                      <Td>{app.applied_at}</Td>
                      <Td>{app.req_number}</Td>
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
    permissions: { sqlite: true, google: true },
  },
  Component: JobTracker,
};

export default widget;

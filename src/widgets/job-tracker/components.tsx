import { useState, useMemo, useRef } from 'react';
import { StackedBarChart } from '@widgets/_shared/StackedBarChart';
import type { Application, AppFormData, Status } from './types';
import { STATUSES, STATUS_COLOR } from './types';

export { INIT_SQL, EMAIL_INIT_SQL, SCHEMA_MIGRATIONS } from './schema';

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

const COMMON_SOURCES = [
  'LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter', 'Monster', 'Dice',
  'Built In', 'Wellfound', 'AngelList', 'Y Combinator', 'Greenhouse',
  'Lever', 'Workday', 'iCIMS', 'SimplyHired', 'CareerBuilder',
  'Remote OK', 'We Work Remotely', 'Hired', 'Referral', 'Company Website', 'Robert Half Technologies',
];

const LINK_SOURCE_MAP: [RegExp, string][] = [
  [/linkedin\.com/i, 'LinkedIn'],
  [/indeed\.com/i, 'Indeed'],
  [/glassdoor\.com/i, 'Glassdoor'],
  [/ziprecruiter\.com/i, 'ZipRecruiter'],
  [/monster\.com/i, 'Monster'],
  [/dice\.com/i, 'Dice'],
  [/builtin\.com/i, 'Built In'],
  [/wellfound\.com/i, 'Wellfound'],
  [/angel\.co/i, 'AngelList'],
  [/workatastartup\.com|ycombinator\.com/i, 'Y Combinator'],
  [/greenhouse\.io/i, 'Greenhouse'],
  [/lever\.co/i, 'Lever'],
  [/myworkdayjobs\.com|workday\.com/i, 'Workday'],
  [/icims\.com/i, 'iCIMS'],
  [/simplyhired\.com/i, 'SimplyHired'],
  [/careerbuilder\.com/i, 'CareerBuilder'],
  [/remoteok\.com/i, 'Remote OK'],
  [/weworkremotely\.com/i, 'We Work Remotely'],
  [/hired\.com/i, 'Hired'],
  [/roberthalf\.com/i, 'Robert Half Technologies'],
];

function deriveSourceFromLink(url: string): string {
  for (const [pattern, source] of LINK_SOURCE_MAP) {
    if (pattern.test(url)) return source;
  }
  return '';
}

const normalizePrefix = (value: string) => value.trim().toLowerCase();

function getSuggestion(items: string[] | undefined, value: string): string {
  const prefix = normalizePrefix(value);
  if (!items?.length || !prefix) return '';
  return items.find((item) => {
    const candidate = normalizePrefix(item);
    return candidate.startsWith(prefix) && candidate !== prefix;
  }) ?? '';
}

export function AppForm({
  initial,
  onSave,
  onCancel,
  companySuggestions,
  roleSuggestions,
}: {
  initial?: Application;
  onSave: (data: AppFormData) => Promise<void>;
  onCancel: () => void;
  companySuggestions?: string[];
  roleSuggestions?: string[];
}) {
  const [form, setForm] = useState<AppFormData>({
    company: initial?.company ?? '',
    role: initial?.role ?? '',
    status: initial?.status ?? 'Applied',
    applied_at: initial?.applied_at ?? today(),
    source: initial?.source ?? '',
    link: initial?.link ?? '',
    notes: initial?.notes ?? '',
    req_number: initial?.req_number ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof AppFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const [activeField, setActiveField] = useState<'company' | 'role' | null>(null);
  const blurTimer = useRef<number | null>(null);

  const companySuggestion = useMemo(
    () => getSuggestion(companySuggestions, form.company),
    [companySuggestions, form.company]
  );

  const roleSuggestion = useMemo(
    () => getSuggestion(roleSuggestions, form.role),
    [roleSuggestions, form.role]
  );

  const matchingCompanySuggestions = useMemo(
    () => companySuggestions?.filter((item) => {
      const prefix = normalizePrefix(form.company);
      const candidate = normalizePrefix(item);
      return prefix && candidate.startsWith(prefix) && candidate !== prefix;
    }).slice(0, 5) ?? [],
    [companySuggestions, form.company]
  );

  const matchingRoleSuggestions = useMemo(
    () => roleSuggestions?.filter((item) => {
      const prefix = normalizePrefix(form.role);
      const candidate = normalizePrefix(item);
      return prefix && candidate.startsWith(prefix) && candidate !== prefix;
    }).slice(0, 5) ?? [],
    [roleSuggestions, form.role]
  );

  const completeSuggestion = (
    key: 'company' | 'role',
    suggestion: string,
  ) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Tab' || e.shiftKey || !suggestion) return;
    e.preventDefault();
    setForm((f) => ({ ...f, [key]: suggestion }));
  };

  const hideSuggestions = () => {
    blurTimer.current = window.setTimeout(() => {
      setActiveField(null);
      blurTimer.current = null;
    }, 100);
  };

  const keepSuggestions = () => {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const link = e.target.value;
    setForm((f) => {
      const derived = deriveSourceFromLink(link);
      return { ...f, link, source: f.source === '' && derived ? derived : f.source };
    });
  };

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
        <div style={{ position: 'relative' }} onMouseEnter={keepSuggestions} onMouseLeave={hideSuggestions}>
          <input
            style={inp}
            placeholder="Company *"
            value={form.company}
            onChange={(e) => { set('company')(e); setActiveField('company'); }}
            onFocus={() => { keepSuggestions(); setActiveField('company'); }}
            onBlur={hideSuggestions}
            onKeyDown={completeSuggestion('company', companySuggestion)}
            autoComplete="off"
            required
          />
          {activeField === 'company' && matchingCompanySuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 6,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                zIndex: 20,
                overflow: 'hidden',
              }}
            >
              {matchingCompanySuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setForm((f) => ({ ...f, company: item })); setActiveField(null); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} onMouseEnter={keepSuggestions} onMouseLeave={hideSuggestions}>
          <input
            style={inp}
            placeholder="Role *"
            value={form.role}
            onChange={(e) => { set('role')(e); setActiveField('role'); }}
            onFocus={() => { keepSuggestions(); setActiveField('role'); }}
            onBlur={hideSuggestions}
            onKeyDown={completeSuggestion('role', roleSuggestion)}
            autoComplete="off"
            required
          />
          {activeField === 'role' && matchingRoleSuggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 6,
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                zIndex: 20,
                overflow: 'hidden',
              }}
            >
              {matchingRoleSuggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setForm((f) => ({ ...f, role: item })); setActiveField(null); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <select style={inp} value={form.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input style={inp} type="date" value={form.applied_at} onChange={set('applied_at')} />
        <input style={inp} placeholder="Source (LinkedIn, referral…)" value={form.source} onChange={set('source')} list="job-sources" autoComplete="off" />
        <datalist id="job-sources">
          {COMMON_SOURCES.map((s) => <option key={s} value={s} />)}
        </datalist>
        <input style={inp} placeholder="Link" value={form.link} onChange={handleLinkChange} />
        <input style={inp} placeholder="Req # (optional)" value={form.req_number} onChange={set('req_number')} />
      </div>
      <datalist id="job-company-suggestions">
        {companySuggestions?.map((company) => <option key={company} value={company} />)}
      </datalist>
      <datalist id="job-role-suggestions">
        {roleSuggestions?.map((role) => <option key={role} value={role} />)}
      </datalist>
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

  const series = useMemo(() => STATUSES.map((s) => ({ key: s, color: STATUS_COLOR[s] })), []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        Applications by week (applied date) — last 8 weeks
      </div>
      <StackedBarChart data={data} series={series} />
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

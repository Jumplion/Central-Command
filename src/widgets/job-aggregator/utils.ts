import { EMP_TYPES } from './constants';

// ─── Pure formatting helpers ──────────────────────────────────────────────────

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency = 'USD',
  period = 'YEAR',
): string {
  if (!min && !max) return '';
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : `${currency} `;
  const sfx = period === 'YEAR' ? '/yr' : period === 'HOUR' ? '/hr' : period === 'MONTH' ? '/mo' : '';
  if (min && max) return `${sym}${fmt(min)}–${fmt(max)}${sfx}`;
  if (min) return `${sym}${fmt(min)}+${sfx}`;
  return `Up to ${sym}${fmt(max!)}${sfx}`;
}

export function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const EMP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMP_TYPES.filter((t) => t.value !== 'all').map((t) => [t.value.toUpperCase(), t.label])
);

export function empTypeLabel(t: string): string {
  return EMP_TYPE_LABELS[t.toUpperCase()] ?? t;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

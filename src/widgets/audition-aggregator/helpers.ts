export { parseCSVLine } from '@shared/csv';

export const today = () => new Date().toISOString().slice(0, 10);

export function formatAgo(ts: number | undefined): string {
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

export function recencyColor(ts: number | undefined): string {
  if (!ts) return 'var(--text-dim)';
  const hr = (Date.now() - ts) / 3_600_000;
  if (hr < 24) return '#34d399';
  if (hr < 24 * 4) return 'var(--text)';
  if (hr < 24 * 7) return '#f59e0b';
  return '#ff6e6e';
}

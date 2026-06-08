import { EMP_TYPES, MONTH_NAMES } from "./constants";

// ─── Pure formatting helpers ──────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

const PERIOD_SUFFIXES: Record<string, string> = {
  YEAR: "/yr",
  HOUR: "/hr",
  MONTH: "/mo",
};

function formatSalaryAmount(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency = "USD",
  period = "YEAR",
): string {
  if (!min && !max) return "";
  const sym = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const sfx = PERIOD_SUFFIXES[period] ?? "";
  if (min && max)
    return `${sym}${formatSalaryAmount(min)}–${formatSalaryAmount(max)}${sfx}`;
  if (min) return `${sym}${formatSalaryAmount(min)}+${sfx}`;
  return `Up to ${sym}${formatSalaryAmount(max!)}${sfx}`;
}

export function relativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const EMP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EMP_TYPES.filter((t) => t.value !== "all").map((t) => [
    t.value.toUpperCase(),
    t.label,
  ]),
);

export function empTypeLabel(t: string): string {
  return EMP_TYPE_LABELS[t.toUpperCase()] ?? t;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

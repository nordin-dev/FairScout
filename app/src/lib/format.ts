import { monthYearWords } from './i18n';

/** Euro amount in the short form used on every screen: €250k, €500k, €1M, €1.1M, €40M. */
export function money(eur: number): string {
  const abs = Math.abs(eur);
  if (abs >= 1_000_000) return `€${trim(eur / 1_000_000)}M`;
  if (abs >= 1_000) return `€${trim(eur / 1_000)}k`;
  return `€${Math.round(eur)}`;
}

function trim(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Month and year of an ISO date, for example "2027-06-30" gives "Jun 2027". Null for anything else. */
export function monthYear(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(iso ?? '');
  if (!m) return null;
  const month = Number(m[2]) - 1;
  return month >= 0 && month < 12 ? monthYearWords(month, m[1]) : null;
}

/** A whole number with a thousands separator: 1180 gives "1,180". */
export function thousands(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Percentage points as a whole number, half up: 7.76 gives "8", 9.5 gives "10". */
export function points(n: number): string {
  return String(Math.round(n));
}

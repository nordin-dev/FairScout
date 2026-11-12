import { dayMonthYearWords, getLang } from '../i18n';
import type { TennisMeta, TennisPlayer } from './types';

/** The ranking range of the pool: players ranked 101 to 1000. */
export const POOL_TOP = 100;
export const POOL_BOTTOM = 1000;
export const RANK_MIN = 100;
export const RANK_MAX = 900;
export const RANK_STEP = 50;

export type TennisFilters = {
  /** Keeps players ranked worse than this number. */
  minRank: number;
  /** The country codes that are ticked. */
  countries: readonly string[];
  under18Only: boolean;
  leftOnly: boolean;
};

export const defaultFilters = (players: readonly TennisPlayer[]): TennisFilters => ({
  minRank: RANK_MIN,
  countries: countryList(players).map((c) => c.code),
  under18Only: false,
  leftOnly: false,
});

type Skip = 'country' | 'under18' | 'left' | null;

function passes(p: TennisPlayer, f: TennisFilters, skip: Skip): boolean {
  if (p.rank <= f.minRank) return false;
  if (skip !== 'country' && !f.countries.includes(p.country_code)) return false;
  if (skip !== 'under18' && f.under18Only && !p.flags.under18) return false;
  if (skip !== 'left' && f.leftOnly && p.hand !== 'Left') return false;
  return true;
}

/** The players that fit every filter. */
export const applyFilters = (players: readonly TennisPlayer[], f: TennisFilters): TennisPlayer[] =>
  players.filter((p) => passes(p, f, null));

const TIER_ORDER = { A: 0, B: 1, C: 2 } as const;

/** Tier A, B, C; inside a tier the highest score first; ties by id. Returns a new list. */
export function sortRows(players: readonly TennisPlayer[]): TennisPlayer[] {
  return [...players].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** The countries of the pool sorted by name. */
export function countryList(players: readonly TennisPlayer[]): { code: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const p of players) seen.set(p.country_code, p.country);
  return [...seen].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

/** For each country, the players it would add under every other current filter. */
export function countryCounts(players: readonly TennisPlayer[], f: TennisFilters): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) if (passes(p, f, 'country')) out[p.country_code] = (out[p.country_code] ?? 0) + 1;
  return out;
}

/** How many players the two switches would leave under the other current filters. */
export function switchCounts(players: readonly TennisPlayer[], f: TennisFilters): { under18: number; left: number } {
  return {
    under18: players.filter((p) => passes(p, f, 'under18') && p.flags.under18).length,
    left: players.filter((p) => passes(p, f, 'left') && p.hand === 'Left').length,
  };
}

/** The number of matching players and the number in tier A. */
export const titleCounts = (rows: readonly TennisPlayer[]): { total: number; tierA: number } => ({
  total: rows.length,
  tierA: rows.filter((p) => p.tier === 'A').length,
});

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** The count as a word up to twelve, a number above; always a number outside English. */
export const countWord = (k: number): string => (getLang() === 'en' ? (WORDS[k] ?? String(k)) : String(k));

/** "2026-06-08" gives "8 Jun 2026"; anything else comes back unchanged. */
export function dayMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const month = m ? Number(m[2]) - 1 : -1;
  return m && month >= 0 && month < 12 ? dayMonthYearWords(Number(m[3]), month, m[1]) : iso;
}

/** The lede inputs: the ranking date and the lowest rank shown. */
export const ledeParts = (meta: Pick<TennisMeta, 'source_last_date'>, f: TennisFilters) => ({
  date: dayMonthYear(meta.source_last_date),
  from: f.minRank + 1,
  to: POOL_BOTTOM,
});

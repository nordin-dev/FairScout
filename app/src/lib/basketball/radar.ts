import type { BasketMeta, BasketPlayer } from './types';

/** The minutes-per-game slider: players averaging below the value stay. */
export const MINUTES_MIN = 6;
export const MINUTES_MAX = 18;
export const MINUTES_STEP = 2;

export const COMPETITIONS = ['EuroLeague', 'EuroCup'] as const;
export type Competition = (typeof COMPETITIONS)[number];
export type PositionFilter = 'All' | 'Guard' | 'Forward' | 'Center';
export const POSITIONS: readonly PositionFilter[] = ['All', 'Guard', 'Forward', 'Center'];

export type BasketFilters = {
  /** Keeps players with fewer minutes per game than this. */
  maxMpg: number;
  position: PositionFilter;
  /** The competitions that are ticked. */
  competitions: readonly Competition[];
  /** The ticked countries by key; a player without a country has the key "". */
  countries: readonly string[];
  under20Only: boolean;
};

/** The country key of a player: the name, or "" when it is not known. */
export const countryKey = (p: Pick<BasketPlayer, 'country'>): string => p.country ?? '';

export const defaultFilters = (players: readonly BasketPlayer[]): BasketFilters => ({
  maxMpg: MINUTES_MAX,
  position: 'All',
  competitions: COMPETITIONS,
  countries: countryList(players).map((c) => c.key),
  under20Only: false,
});

type Skip = 'country' | 'competition' | 'under20' | null;

function passes(p: BasketPlayer, f: BasketFilters, skip: Skip): boolean {
  if (p.mpg >= f.maxMpg) return false;
  if (f.position !== 'All' && p.position !== f.position) return false;
  if (skip !== 'competition' && !f.competitions.includes(p.competition)) return false;
  if (skip !== 'country' && !f.countries.includes(countryKey(p))) return false;
  if (skip !== 'under20' && f.under20Only && !p.flags.under20) return false;
  return true;
}

/** The players that fit every filter. */
export const applyFilters = (players: readonly BasketPlayer[], f: BasketFilters): BasketPlayer[] =>
  players.filter((p) => passes(p, f, null));

const TIER_ORDER = { A: 0, B: 1, C: 2 } as const;

/** Tier A, B, C; inside a tier the highest score first; ties by id. Returns a new list. */
export function sortRows(players: readonly BasketPlayer[]): BasketPlayer[] {
  return [...players].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export const NOT_KNOWN = 'Not known';

/** The countries of the pool sorted by name, "Not known" last. */
export function countryList(players: readonly BasketPlayer[]): { key: string; name: string }[] {
  const keys = new Set(players.map(countryKey));
  return [...keys]
    .map((key) => ({ key, name: key === '' ? NOT_KNOWN : key }))
    .sort((a, b) => Number(a.key === '') - Number(b.key === '') || a.name.localeCompare(b.name));
}

/** For each country, the players it would add under every other current filter. */
export function countryCounts(players: readonly BasketPlayer[], f: BasketFilters): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of players) if (passes(p, f, 'country')) out[countryKey(p)] = (out[countryKey(p)] ?? 0) + 1;
  return out;
}

/** For each competition, the players it would add under every other current filter. */
export function competitionCounts(players: readonly BasketPlayer[], f: BasketFilters): Record<Competition, number> {
  const out: Record<Competition, number> = { EuroLeague: 0, EuroCup: 0 };
  for (const p of players) if (passes(p, f, 'competition')) out[p.competition] += 1;
  return out;
}

/** How many players the under-20 switch would leave under the other current filters. */
export const under20Count = (players: readonly BasketPlayer[], f: BasketFilters): number =>
  players.filter((p) => passes(p, f, 'under20') && p.flags.under20).length;

/** The number of matching players and the number in tier A. */
export const titleCounts = (rows: readonly BasketPlayer[]): { total: number; tierA: number } => ({
  total: rows.length,
  tierA: rows.filter((p) => p.tier === 'A').length,
});

const WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** The count as a word up to twelve, a number above. */
export const countWord = (k: number): string => WORDS[k] ?? String(k);

/** The lede inputs: the season and the competitions that are ticked. */
export const ledeParts = (meta: Pick<BasketMeta, 'season'>, f: BasketFilters) => ({
  season: meta.season,
  competitions: f.competitions.length === 1 ? (f.competitions[0] as string) : COMPETITIONS.join(' and '),
});

/** The short position letter of a table row; "—" is the caller's. */
export const positionLetter = (p: BasketPlayer): string | null => (p.position ? p.position.charAt(0) : null);

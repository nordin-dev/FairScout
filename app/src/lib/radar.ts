import { monthYear } from './format';
import { ratingOf } from './rating';
import type { Player, Tier } from './types';

/** The five regional leagues the radar starts with: Croatia, Serbia, Poland, Czech Republic, Romania. */
export const REGIONAL_LEAGUES: readonly string[] = ['KR1', 'SER1', 'PL1', 'TS1', 'RO1'];

export type PositionFilter = 'all' | Player['position_group'];

export type Filters = {
  budget: number;
  position: PositionFilter;
  /** The regional leagues that are switched on. */
  leagues: readonly string[];
  /** Switches every league outside the five on or off together. */
  others: boolean;
  contractEnding: boolean;
  adultOnly: boolean;
  mine: boolean;
  hideNames: boolean;
};

export type ViewFilters = Omit<Filters, 'budget'>;

/** Every filter except the budget, which the app shares. */
export const defaultView = (): ViewFilters => ({
  position: 'all',
  leagues: REGIONAL_LEAGUES,
  others: false,
  contractEnding: false,
  adultOnly: false,
  mine: false,
  hideNames: false,
});

export const defaultFilters = (budget: number): Filters => ({ budget, ...defaultView() });

const isRegional = (id: string) => REGIONAL_LEAGUES.includes(id);

type Skip = 'league' | null;

function passes(p: Player, f: Filters, picks: ReadonlySet<string>, skip: Skip): boolean {
  if (!p.in_pool || p.value_eur > f.budget) return false;
  if (f.position !== 'all' && p.position_group !== f.position) return false;
  if (skip !== 'league' && !(isRegional(p.league_id) ? f.leagues.includes(p.league_id) : f.others)) return false;
  if (f.contractEnding && !p.flags.contract_ending) return false;
  if (f.adultOnly && p.flags.under18) return false;
  if (f.mine && !picks.has(p.id)) return false;
  return true;
}

/** The pool players that fit every filter. `picks` are the ids the scout chose in the blind pick. */
export function applyFilters(players: readonly Player[], f: Filters, picks: ReadonlySet<string> = new Set()): Player[] {
  return players.filter((p) => passes(p, f, picks, null));
}

const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2 };
const tierRank = (t: Tier | null) => (t ? TIER_ORDER[t] : 3);

/** Tier A, then B, then C; inside a tier the highest rating first; ties by id. Returns a new list. */
export function sortRows(players: readonly Player[]): Player[] {
  return [...players].sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier) || ratingOf(b) - ratingOf(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export type LeagueCounts = { byLeague: Record<string, number>; others: number };

/** For each league, the players it would add under every other current filter. */
export function leagueCounts(players: readonly Player[], f: Filters, picks: ReadonlySet<string> = new Set()): LeagueCounts {
  const byLeague: Record<string, number> = {};
  let others = 0;
  for (const p of players) {
    if (!passes(p, f, picks, 'league')) continue;
    if (isRegional(p.league_id)) byLeague[p.league_id] = (byLeague[p.league_id] ?? 0) + 1;
    else others += 1;
  }
  return { byLeague, others };
}

/** How many players an availability filter would leave under the other current filters. */
export function availabilityCounts(players: readonly Player[], f: Filters, picks: ReadonlySet<string> = new Set()) {
  return {
    contract: applyFilters(players, { ...f, contractEnding: true }, picks).length,
    adult: applyFilters(players, { ...f, adultOnly: true }, picks).length,
  };
}

/** Twelve months after the source's last date, for example "2026-07-06" gives "Jul 2027". */
export function contractCutoff(sourceLastDate: string): string | null {
  const m = /^(\d{4})(-\d{2})-\d{2}/.exec(sourceLastDate);
  return m ? monthYear(`${Number(m[1]) + 1}${m[2]}-01`) : null;
}

/** The number of matching players and the number in tier A. */
export function titleCounts(rows: readonly Player[]): { total: number; tierA: number } {
  return { total: rows.length, tierA: rows.filter((p) => p.tier === 'A').length };
}

const SHORT: Record<string, string> = {
  Goalkeeper: 'GK',
  'Centre-Back': 'CB',
  'Left-Back': 'LB',
  'Right-Back': 'RB',
  'Defensive Midfield': 'DM',
  'Central Midfield': 'CM',
  'Attacking Midfield': 'AM',
  'Left Midfield': 'LM',
  'Right Midfield': 'RM',
  'Left Winger': 'LW',
  'Right Winger': 'RW',
  'Second Striker': 'SS',
  'Centre-Forward': 'CF',
};
const GROUP_SHORT: Record<Player['position_group'], string> = { Attack: 'FW', Midfield: 'MF', Defender: 'DF', Goalkeeper: 'GK' };

/** The short code of a position: "Right Winger" gives "RW". Falls back to the position group. */
export function positionCode(p: Pick<Player, 'position' | 'position_group'>): string {
  return SHORT[p.position] ?? GROUP_SHORT[p.position_group];
}

/** How many leagues the selection covers, given the ids of all leagues. */
export function selectedLeagueCount(f: Filters, allIds: readonly string[]): number {
  return allIds.filter((id) => (isRegional(id) ? f.leagues.includes(id) : f.others)).length;
}

/** The citizenship that the passport view lists. */
export const BOSNIAN = 'Bosnia-Herzegovina';

/** Every player with Bosnian citizenship, in or out of the pool, youngest first; ties by id. */
export function bosnianPlayers(players: readonly Player[]): Player[] {
  return players
    .filter((p) => p.citizenship === BOSNIAN)
    .sort((a, b) => a.age - b.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The rating is shown for attackers, wingers and attacking midfielders only; the rest rest on role and team context. */
export function showsRating(p: Pick<Player, 'position' | 'position_group'>): boolean {
  return p.position_group === 'Attack' || p.position === 'Attacking Midfield';
}

/** True when the price is at most the budget. */
export const inBudget = (p: Pick<Player, 'value_eur'>, budget: number): boolean => p.value_eur <= budget;

/** The oldest age, in whole years today, that the passport title counts as young. */
export const PASSPORT_YOUNG_AGE = 21;

/** The three figures of the passport title: all, 21 or younger today in whole years (so 21.9 counts and 22.0 does not), inside the budget. */
export function passportCounts(list: readonly Player[], budget: number): { total: number; young: number; budget: number } {
  return {
    total: list.length,
    young: list.filter((p) => Math.floor(p.age) <= PASSPORT_YOUNG_AGE).length,
    budget: list.filter((p) => inBudget(p, budget)).length,
  };
}

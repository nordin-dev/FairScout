import type { MetaFile, Player } from './types';

export type Position = 'winger' | 'striker' | 'midfielder' | 'defender' | 'goalkeeper';
export type MaxAge = 19 | 21;
export type Matter = 'creates' | 'scores' | 'plays';

export const POSITIONS: readonly Position[] = ['winger', 'striker', 'midfielder', 'defender', 'goalkeeper'];
export const MAX_AGES: readonly MaxAge[] = [19, 21];
/** The age limit of the radar pool: under 21 in the radar season, by year of birth. */
export const POOL_AGE_LIMIT = 21;

/** First birth year inside the pool: the start year of a season such as "2025/26", minus the age limit. Null when the season is unreadable. */
export function poolBornFrom(season: string | null | undefined): number | null {
  const start = Number(/^(\d{4})\//.exec(season ?? '')?.[1]);
  return Number.isFinite(start) && start > 0 ? start - POOL_AGE_LIMIT : null;
}
export const MATTERS: readonly Matter[] = ['creates', 'scores', 'plays'];
export const MIN_MATCHES = 3;
export const MAX_MATTERS = 2;

export type BriefCriteria = { position: Position; maxAge: MaxAge; budget: number };

const BY_POSITION: Record<string, Position> = {
  'Left Winger': 'winger',
  'Right Winger': 'winger',
  'Left Midfield': 'winger',
  'Right Midfield': 'winger',
  'Centre-Forward': 'striker',
  'Second Striker': 'striker',
  'Attacking Midfield': 'midfielder',
  'Central Midfield': 'midfielder',
  'Defensive Midfield': 'midfielder',
  'Centre-Back': 'defender',
  'Left-Back': 'defender',
  'Right-Back': 'defender',
  Goalkeeper: 'goalkeeper',
};

const BY_GROUP: Record<Player['position_group'], Position> = {
  Attack: 'striker',
  Midfield: 'midfielder',
  Defender: 'defender',
  Goalkeeper: 'goalkeeper',
};

/** The brief position a player falls under: his `position` field, else his `position_group`. */
export function positionOf(player: Pick<Player, 'position' | 'position_group'>): Position {
  return BY_POSITION[player.position] ?? BY_GROUP[player.position_group];
}

type Matchable = Pick<Player, 'in_pool' | 'position' | 'position_group' | 'age' | 'value_eur'>;

/** True when a pool player fits the position, the age limit and the budget. */
export function matches(player: Matchable, brief: BriefCriteria): boolean {
  if (!player.in_pool) return false;
  if (positionOf(player) !== brief.position) return false;
  if (brief.maxAge === 19 && player.age >= 20) return false;
  return player.value_eur <= brief.budget;
}

/** How many players match the brief. */
export function countMatches(players: readonly Matchable[], brief: BriefCriteria): number {
  let n = 0;
  for (const p of players) if (matches(p, brief)) n += 1;
  return n;
}

/** Chooses or un-chooses a priority. A third one drops the oldest of the two. */
export function toggleMatter(current: readonly Matter[], matter: Matter): Matter[] {
  if (current.includes(matter)) return current.filter((m) => m !== matter);
  return [...current, matter].slice(-MAX_MATTERS);
}

/** The button is enabled with at least three matches and at least one priority. */
export function canShowThree(count: number, matters: readonly Matter[]): boolean {
  return count >= MIN_MATCHES && matters.length > 0;
}

const MATTER_ALIASES: Record<string, Matter> = {
  creates: 'creates',
  creating: 'creates',
  scores: 'scores',
  scoring: 'scores',
  plays: 'plays',
  playing: 'plays',
  role: 'plays',
};

export type DefaultBrief = { position: Position | null; maxAge: MaxAge | null; matters: Matter[] };

/** Reads `meta.default_brief`; a value the screen does not offer comes back as null or is left out. */
export function readDefaultBrief(meta: MetaFile['default_brief']): DefaultBrief {
  const position = POSITIONS.find((p) => p === meta.position) ?? null;
  const maxAge = MAX_AGES.find((a) => a === meta.max_age) ?? null;
  const matters: Matter[] = [];
  for (const m of meta.matters) {
    const known = MATTER_ALIASES[m];
    if (known && !matters.includes(known)) matters.push(known);
  }
  return { position, maxAge, matters: matters.slice(0, MAX_MATTERS) };
}

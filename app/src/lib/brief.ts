import type { Player } from './types';

export type Position = 'winger' | 'striker' | 'midfielder' | 'defender' | 'goalkeeper';

export const POSITIONS: readonly Position[] = ['winger', 'striker', 'midfielder', 'defender', 'goalkeeper'];
/** The age limit of the radar pool: under 21 in the radar season, by year of birth. */
export const POOL_AGE_LIMIT = 21;

/** First birth year inside the pool: the start year of a season such as "2025/26", minus the age limit. Null when the season is unreadable. */
export function poolBornFrom(season: string | null | undefined): number | null {
  const start = Number(/^(\d{4})\//.exec(season ?? '')?.[1]);
  return Number.isFinite(start) && start > 0 ? start - POOL_AGE_LIMIT : null;
}

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

/** The position a player falls under: his `position` field, else his `position_group`. */
export function positionOf(player: Pick<Player, 'position' | 'position_group'>): Position {
  return BY_POSITION[player.position] ?? BY_GROUP[player.position_group];
}

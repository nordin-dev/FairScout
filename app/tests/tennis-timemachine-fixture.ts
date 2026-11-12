import type { TennisFile, TennisPastPlayer, TennisPastYear } from '../src/lib/tennis/types';
import { META } from './tennis-radar-fixture';

const p = (id: string, name: string, s: Partial<TennisPastPlayer> = {}): TennisPastPlayer => ({
  id,
  name,
  country: 'Norway',
  age: 19.6,
  rank: 200,
  tier: 'A',
  hit: false,
  best_later: 250,
  reached: null,
  ...s,
});

export const Y2019: TennisPastYear = {
  year: 2019,
  date: '2019-05-27',
  pool: 93,
  pool_hits: 15,
  tier_a: [
    p('a1', 'Ada Hit', { rank: 215, best_later: 9, hit: true, reached: '2021-07-12' }),
    p('a2', 'Bo Miss', { rank: 300, best_later: 180 }),
    p('a3', 'Cy None', { rank: 410, best_later: null }),
  ],
  tier_a_hits: 1,
  missed: [
    p('m1', 'Dan Late', { tier: 'B', rank: 520, best_later: 40, hit: true, reached: '2022-02-01' }),
    p('m2', 'Eli Late', { tier: 'C', rank: 800, best_later: 88, hit: true, reached: '2022-05-01', country: 'France' }),
  ],
};

export const Y2022: TennisPastYear = {
  year: 2022,
  date: '2022-06-06',
  pool: 80,
  pool_hits: 10,
  tier_a: [p('b1', 'Finn Two', { rank: 150, best_later: 70, hit: true, reached: '2023-03-06' }), p('b2', 'Gus Two', { rank: 160 })],
  tier_a_hits: 1,
  missed: [p('m3', 'Hal Only', { tier: 'B', rank: 400, best_later: 90, hit: true, reached: '2024-01-01' })],
};

export const Y2021: TennisPastYear = {
  year: 2021,
  date: '2021-06-07',
  pool: 70,
  pool_hits: 5,
  tier_a: [p('c1', 'Ivo One', { hit: true, best_later: 50, reached: '2022-01-10' })],
  tier_a_hits: 1,
  missed: [],
};

export const TM_FILE: TennisFile = { meta: META, players: [], timemachine: [Y2019, Y2021, Y2022] };

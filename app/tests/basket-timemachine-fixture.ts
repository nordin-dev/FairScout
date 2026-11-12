import type { BasketFile, BasketPastPlayer, BasketPastYear } from '../src/lib/basketball/types';
import { META } from './basket-evidence-fixture';

const p = (id: string, name: string, s: Partial<BasketPastPlayer> = {}): BasketPastPlayer => ({
  id,
  name,
  country: 'Serbia',
  team: 'Club One',
  competition: 'EuroLeague',
  age: 19.6,
  mpg: 12.3,
  tier: 'A',
  hit: false,
  best_later: 14.2,
  reached: null,
  ...s,
});

export const Y2016: BasketPastYear = {
  year: 2016,
  season: '2016/17',
  pool: 44,
  pool_hits: 10,
  tier_a: [
    p('a1', 'Ada Hit', { mpg: 15.3, age: 21.9, best_later: 27.9, hit: true, reached: '2017/18' }),
    p('a2', 'Bo Miss', { mpg: 10.1, best_later: 14.2, team: 'Club Two', competition: 'EuroCup' }),
    p('a3', 'Cy None', { mpg: 8.4, best_later: null }),
  ],
  tier_a_hits: 1,
  missed: [
    p('m1', 'Dan Late', { tier: 'B', mpg: 9.5, best_later: 21.4, hit: true, reached: '2019/20' }),
    p('m2', 'Eli Late', { tier: 'C', mpg: 6.7, best_later: 20.2, hit: true, reached: '2018/19' }),
  ],
};

export const Y2022: BasketPastYear = {
  year: 2022,
  season: '2022/23',
  pool: 53,
  pool_hits: 17,
  tier_a: [p('b1', 'Finn Two', { hit: true, best_later: 22, reached: '2023/24' }), p('b2', 'Gus Two')],
  tier_a_hits: 1,
  missed: [p('m3', 'Hal Only', { tier: 'B', hit: true, best_later: 24, reached: '2024/25' })],
};

export const Y2021: BasketPastYear = {
  year: 2021,
  season: '2021/22',
  pool: 61,
  pool_hits: 9,
  tier_a: [p('c1', 'Ivo One', { hit: true, best_later: 25, reached: '2022/23' })],
  tier_a_hits: 1,
  missed: [],
};

export const TM_FILE: BasketFile = { meta: META, players: [], timemachine: [Y2016, Y2021, Y2022] };

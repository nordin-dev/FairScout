import type { BasketFile, BasketPlayer } from '../src/lib/basketball/types';

type Spec = Partial<Omit<BasketPlayer, 'flags'>> & { flags?: Partial<BasketPlayer['flags']> };
export const make = (id: string, s: Spec = {}): BasketPlayer => {
  const { flags, ...rest } = s;
  return {
    id,
    name: `Name ${id}`,
    country: 'Spain',
    team: 'Club X',
    competition: 'EuroLeague',
    position: 'Guard',
    height_cm: 195,
    age: 20.5,
    games: 20,
    mpg: 10,
    ppg: 4.2,
    rpg: 1.5,
    apg: 1.1,
    pirpg: 3.4,
    pts40: 16,
    pir40: 13,
    score: 0.3,
    score_rank_pct: 50,
    tier: 'C',
    pct: { scoring: 50, impact: 50, trust: 50 },
    rating: 50,
    drivers: [
      { key: 'a', sign: '+', text: 'Scores a lot for his minutes' },
      { key: 'b', sign: '-', text: 'Plays few minutes' },
    ],
    flags: { under20: false, low_sample: false, ...flags },
    history: [],
    ...rest,
  };
};

export const PLAYERS: BasketPlayer[] = [
  make('b1', { tier: 'A', score: 0.9, mpg: 15, country: 'Spain', position: 'Guard', rating: 90, flags: { under20: true } }),
  make('b2', { tier: 'A', score: 0.8, mpg: 12.5, country: 'France', position: 'Forward', competition: 'EuroCup', rating: 80 }),
  make('b3', { tier: 'B', score: 0.5, mpg: 9, country: 'France', position: 'Center', flags: { low_sample: true } }),
  make('b4', { tier: 'C', score: 0.2, mpg: 7, country: null, position: null, age: 19.2, flags: { under20: true } }),
  make('b5', { tier: 'C', score: 0.25, mpg: 17, country: 'Spain', position: 'Forward', competition: 'EuroCup' }),
  make('b6', { tier: 'B', score: 0.55, mpg: 11, country: 'Serbia', position: 'Guard' }),
  make('b7', { tier: 'C', score: 0.1, mpg: 6, country: 'Serbia', position: 'Center', competition: 'EuroCup' }),
];

export const META: BasketFile['meta'] = {
  sport: 'basketball',
  source: 'Test source caption',
  season: '2025/26',
  pool_rule: 'under 23, at least five games, under 18 minutes per game',
  outcome: 'a rotation season within three seasons',
  target_minutes: 20,
  pool: 7,
  model: 'logistic',
  trained_on: { years: [2007, 2022], players: 1044 },
  weights: {},
  backtest: {
    years: [2013, 2014],
    by_year: [],
    pool: 500,
    pool_hits: 74,
    pool_rate_pct: 14.9,
    picked: 71,
    margin_pct: 34.4,
    rules: [
      { key: 'model', label: 'Model', hits: 35, rate_pct: 49.3 },
      { key: 'minutes', label: 'Most minutes', hits: 21, rate_pct: 29.6 },
    ],
    tiers: { A: { n: 71, hits: 35 }, B: { n: 71, hits: 20 }, C: { n: 358, hits: 19 } },
  },
};

export const FILE: BasketFile = { meta: META, players: PLAYERS, timemachine: [] };

import type { TennisFile, TennisPlayer } from '../src/lib/tennis/types';

type Spec = Partial<Omit<TennisPlayer, 'flags'>> & { flags?: Partial<TennisPlayer['flags']> };
export const make = (id: string, s: Spec = {}): TennisPlayer => {
  const { flags, ...rest } = s;
  return {
    id,
    name: `Name ${id}`,
    country_code: 'NOR',
    country: 'Norway',
    hand: 'Right',
    height_cm: 185,
    age: 19.5,
    rank: 200,
    rank_year_ago: 300,
    matches: 40,
    wins: 25,
    losses: 15,
    upper_matches: 30,
    upper_wins: 18,
    top200_wins: 1,
    best_win_rank: 150,
    score: 0.3,
    score_rank_pct: 50,
    tier: 'C',
    pct: { wins: 50, level: 50, rise: 50 },
    rating: 50,
    drivers: [
      { key: 'a', sign: '+', text: 'Wins most of his matches' },
      { key: 'b', sign: '-', text: 'Older than most of the pool' },
    ],
    flags: { under18: false, low_sample: false, ...flags },
    rank_history: [
      { date: '2025-06-01', rank: 400 },
      { date: '2026-06-08', rank: 200 },
    ],
    ...rest,
  };
};

export const PLAYERS: TennisPlayer[] = [
  make('t1', { tier: 'A', score: 0.9, rank: 120, country_code: 'NOR', country: 'Norway', rating: 90, top200_wins: 5 }),
  make('t2', { tier: 'A', score: 0.8, rank: 150, country_code: 'FRA', country: 'France', hand: 'Left', rating: 80 }),
  make('t3', { tier: 'B', score: 0.5, rank: 300, country_code: 'FRA', country: 'France', rank_year_ago: null, flags: { low_sample: true } }),
  make('t4', { tier: 'C', score: 0.2, rank: 450, country_code: 'ARG', country: 'Argentina', age: 17.6, flags: { under18: true } }),
  make('t5', { tier: 'C', score: 0.25, rank: 600, country_code: 'NOR', country: 'Norway', hand: 'Left' }),
  make('t6', { tier: 'B', score: 0.55, rank: 260, country_code: 'ARG', country: 'Argentina' }),
  make('t7', { tier: 'C', score: 0.1, rank: 900, country_code: 'FRA', country: 'France', hand: null }),
];

export const META: TennisFile['meta'] = {
  sport: 'tennis',
  source: 'Test source caption',
  source_last_date: '2026-06-08',
  matches_last_date: '2026-06-07',
  pool_rule: 'men under 21, ranked 101 to 1000',
  outcome: 'top 100 within three years',
  pool: 7,
  model: 'logistic',
  trained_on: { years: [2017, 2023], players: 971 },
  weights: {},
  backtest: {
    years: [2017, 2018, 2019, 2020, 2021, 2022, 2023],
    by_year: [],
    pool: 971,
    pool_hits: 131,
    pool_rate_pct: 13.5,
    picked: 99,
    margin_pct: 6.7,
    rules: [
      { key: 'model', label: 'Model', hits: 70, rate_pct: 70.7 },
      { key: 'rank', label: 'Best ranking', hits: 64, rate_pct: 64.6 },
      { key: 'wins', label: 'Most wins', hits: 33, rate_pct: 33.3 },
      { key: 'age', label: 'Youngest', hits: 30, rate_pct: 30.3 },
    ],
    tiers: { A: { n: 99, hits: 70 }, B: { n: 99, hits: 23 }, C: { n: 773, hits: 38 } },
  },
};

export const FILE: TennisFile = { meta: META, players: PLAYERS, timemachine: [] };

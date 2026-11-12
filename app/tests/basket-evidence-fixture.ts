import type { BasketBacktest, BasketFile, BasketMeta } from '../src/lib/basketball/types';

export const BACKTEST: BasketBacktest = {
  years: [2013, 2014, 2015],
  pool: 272,
  pool_hits: 34,
  pool_rate_pct: 12.5,
  picked: 28,
  margin_pct: 15,
  rules: [
    { key: 'model', label: 'Model', hits: 14, rate_pct: 50 },
    { key: 'minutes', label: 'Most minutes', hits: 8, rate_pct: 28.6 },
    { key: 'pir', label: 'Best index rating per game', hits: 10, rate_pct: 35.7 },
    { key: 'age', label: 'Youngest', hits: 3, rate_pct: 10.7 },
  ],
  tiers: { A: { n: 28, hits: 14 }, B: { n: 28, hits: 6 }, C: { n: 216, hits: 14 } },
  by_year: [
    { year: 2013, pool: 106, pool_hits: 10, picked: 11, model_hits: 5, rank_hits: 2 },
    { year: 2014, pool: 80, pool_hits: 11, picked: 8, model_hits: 2, rank_hits: 2 },
    { year: 2015, pool: 86, pool_hits: 13, picked: 9, model_hits: 3, rank_hits: 4 },
  ],
};

export const WEIGHTS = { age: 0.25, mpg: 0.56, pir40: -0.2, pts40: 0.13, games: 0.18, euroleague: 0.67 };

export const META: BasketMeta = {
  sport: 'basketball',
  source: 'Test source caption',
  season: '2025/26',
  pool_rule: 'Players under 23 with a small role.',
  outcome: 'A season of 20 minutes a game within three seasons.',
  target_minutes: 20,
  pool: 45,
  model: 'logistic regression',
  trained_on: { years: [2007, 2008], players: 1044 },
  weights: WEIGHTS,
  backtest: BACKTEST,
};

export const FILE: BasketFile = { meta: META, players: [], timemachine: [] };

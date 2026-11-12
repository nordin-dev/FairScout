export type TennisTier = 'A' | 'B' | 'C';
export type TennisDriver = { key: string; sign: '+' | '-'; text: string };
export type RankPoint = { date: string; rank: number };

/** One player of the tennis pool, as written by scripts/tennis_data.py. */
export type TennisPlayer = {
  id: string;
  name: string;
  country_code: string;
  country: string;
  hand: 'Right' | 'Left' | null;
  height_cm: number | null;
  age: number;
  /** ATP ranking on the ranking date; a lower number is better. */
  rank: number;
  rank_year_ago: number | null;
  /** Matches, wins and losses of the last 52 weeks, all levels. */
  matches: number;
  wins: number;
  losses: number;
  /** Matches and wins at Challenger level or higher. */
  upper_matches: number;
  upper_wins: number;
  top200_wins: number;
  best_win_rank: number | null;
  /** The model's probability of a top-100 ranking within three years, 0 to 1. */
  score: number;
  score_rank_pct: number;
  tier: TennisTier;
  /** Percentiles inside the pool, 1 to 100. */
  pct: { wins: number; level: number; rise: number };
  rating: number;
  drivers: TennisDriver[];
  flags: { under18: boolean; low_sample: boolean };
  rank_history: RankPoint[];
};

export type TennisRule = { key: string; label: string; hits: number; rate_pct: number };

export type TennisBacktest = {
  years: number[];
  pool: number;
  pool_hits: number;
  pool_rate_pct: number;
  /** The size of the top 10% summed over the years. */
  picked: number;
  margin_pct: number;
  rules: TennisRule[];
  tiers: Record<TennisTier, { n: number; hits: number }>;
  /** One entry per tested year: the pool, its hits, the size of the top 10% and the hits of two rules inside it. */
  by_year: { year: number; pool: number; pool_hits: number; picked: number; model_hits: number; rank_hits: number }[];
};

/** A player of a past pool with what happened in the three years after it. */
export type TennisPastPlayer = {
  id: string;
  name: string;
  country: string;
  age: number;
  /** The ranking on the pool's date. */
  rank: number;
  tier: TennisTier;
  /** True when he was ranked inside the top 100 at any time in the three years after. */
  hit: boolean;
  /** His best ranking in those three years; null when he had none. */
  best_later: number | null;
  /** The first date inside the top 100; null when he did not reach it. */
  reached: string | null;
};

/** One past year of the time machine: tier A as the model ranked it then (best score first), and the players outside tier A who reached the top 100 all the same. */
export type TennisPastYear = {
  year: number;
  date: string;
  pool: number;
  pool_hits: number;
  tier_a: TennisPastPlayer[];
  tier_a_hits: number;
  missed: TennisPastPlayer[];
};

export type TennisMeta = {
  sport: 'tennis';
  source: string;
  source_last_date: string;
  matches_last_date: string;
  pool_rule: string;
  outcome: string;
  pool: number;
  model: string;
  trained_on: { years: number[]; players: number };
  weights: Record<string, number>;
  backtest: TennisBacktest;
};

export type TennisFile = { meta: TennisMeta; players: TennisPlayer[]; timemachine: TennisPastYear[] };

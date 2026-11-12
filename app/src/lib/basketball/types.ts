export type BasketTier = 'A' | 'B' | 'C';
export type BasketDriver = { key: string; sign: '+' | '-'; text: string };
export type BasketSeason = { season: string; team: string; competition: string; games: number; mpg: number; ppg: number };

/** One player of the basketball pool, as written by scripts/basketball_data.py. All figures are of the season in `meta.season`, EuroLeague and EuroCup together. */
export type BasketPlayer = {
  id: string;
  name: string;
  country: string | null;
  team: string;
  competition: 'EuroLeague' | 'EuroCup';
  position: 'Guard' | 'Forward' | 'Center' | null;
  height_cm: number | null;
  /** Age at the start of the season. */
  age: number;
  games: number;
  /** Per game: minutes, points, rebounds, assists, performance index rating. */
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  pirpg: number;
  /** Per 40 minutes on the floor: points and performance index rating. */
  pts40: number;
  pir40: number;
  /** The model's score, 0 to 1, for becoming a rotation player within three seasons. */
  score: number;
  score_rank_pct: number;
  tier: BasketTier;
  /** Percentiles inside the pool, 1 to 100: points per 40 minutes, index rating per 40 minutes, minutes per game. */
  pct: { scoring: number; impact: number; trust: number };
  rating: number;
  drivers: BasketDriver[];
  flags: { under20: boolean; low_sample: boolean };
  /** His seasons in the two competitions up to this one, oldest first. */
  history: BasketSeason[];
};

export type BasketRule = { key: string; label: string; hits: number; rate_pct: number };

export type BasketBacktest = {
  /** The start years of the tested seasons: 2013 is the season 2013/14. */
  years: number[];
  pool: number;
  pool_hits: number;
  pool_rate_pct: number;
  /** The size of the top 10% summed over the seasons. */
  picked: number;
  margin_pct: number;
  rules: BasketRule[];
  tiers: Record<BasketTier, { n: number; hits: number }>;
  /** One entry per tested season; `rank_hits` are the hits of the "most minutes" rule. */
  by_year: { year: number; pool: number; pool_hits: number; picked: number; model_hits: number; rank_hits: number }[];
};

/** A player of a past pool with what happened in the three seasons after it. */
export type BasketPastPlayer = {
  id: string;
  name: string;
  country: string | null;
  team: string;
  competition: string;
  age: number;
  /** Minutes per game in the pool's season. */
  mpg: number;
  tier: BasketTier;
  /** True when he had a season with at least ten games and `meta.target_minutes` minutes per game in the three seasons after. */
  hit: boolean;
  /** His best minutes per game in such a season of ten games or more; null when he had none in the two competitions (for example after a move to the NBA). */
  best_later: number | null;
  /** The first season in which he reached the target, like "2017/18"; null when he did not. */
  reached: string | null;
};

export type BasketPastYear = {
  year: number;
  season: string;
  pool: number;
  pool_hits: number;
  /** Tier A as the model ranked it then, best score first. */
  tier_a: BasketPastPlayer[];
  tier_a_hits: number;
  /** Players outside tier A who reached the target all the same, most minutes first. */
  missed: BasketPastPlayer[];
};

export type BasketMeta = {
  sport: 'basketball';
  source: string;
  /** The season of today's pool, like "2025/26". */
  season: string;
  pool_rule: string;
  outcome: string;
  target_minutes: number;
  pool: number;
  model: string;
  trained_on: { years: number[]; players: number };
  weights: Record<string, number>;
  backtest: BasketBacktest;
};

export type BasketFile = { meta: BasketMeta; players: BasketPlayer[]; timemachine: BasketPastYear[] };

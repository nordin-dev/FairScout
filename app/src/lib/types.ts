/** Types of the five data files, from contract/*.schema.json. */

export type League = {
  id: string;
  name: string;
  seasons: number;
  factor: number;
  factor_source: 'moves' | 'estimate';
  pool_1m: number;
  pool_500k: number;
};
export type LeaguesFile = { leagues: League[] };

export type Tier = 'A' | 'B' | 'C';
export type Driver = { sign: '+' | '-'; key: string; text: string };
export type Similar = { id: string; similarity: number; diff: string };
export type Flags = {
  under18: boolean;
  low_sample: boolean;
  contract_ending: boolean;
  born_q4: boolean;
  limited_position_data: boolean;
};
export type ValuePoint = [date: string, value: number];

export type Player = {
  id: string;
  name: string;
  club: string;
  league_id: string;
  league_name: string;
  position_group: 'Attack' | 'Midfield' | 'Defender' | 'Goalkeeper';
  position: string;
  age: number;
  birth_quarter: number;
  height_cm: number | null;
  foot: string | null;
  value_eur: number;
  value_date: string;
  contract_until: string | null;
  minutes: number;
  matches: number;
  goals: number;
  assists: number;
  ga90: number;
  league_factor: number;
  league_factor_source: 'moves' | 'estimate';
  ga90_adj: number;
  involvement: number;
  role: number;
  pct: { output: number; scoring: number; creating: number; involvement: number; role: number };
  score: number | null;
  score_rank_pct: number | null;
  tier: Tier | null;
  drivers: Driver[];
  flags: Flags;
  similar: Similar[];
  note: string | null;
  note_source: 'model' | 'template' | null;
  citizenship: string;
  value_history: ValuePoint[];
  in_pool: boolean;
};
export type PlayersFile = Player[];

export type RuleRow = { rule: string; label: string; hits: number; picks: number; rate: number };
export type BudgetBacktest = {
  budget_eur: number;
  players: number;
  picks_per_rule: number;
  margin_pp: number;
  base_rate: number;
  rows: RuleRow[];
  rows_top20: RuleRow[];
};
export type TierEvidence = {
  share: string;
  hits: number;
  n: number;
  rate: number;
  multiple_p25: number;
  multiple_p50: number;
  multiple_p75: number;
  no_later_value: number;
};
export type EvidenceFile = {
  generated: string;
  definitions: Record<string, string>;
  backtest: {
    test_seasons: string[];
    pick_share: number;
    budgets: BudgetBacktest[];
    by_season: { season: string; hits: number; picks: number }[];
  };
  tiers: Record<Tier, TierEvidence>;
  league_moves: { total: number; used_for_factors: number };
  same_players_two_leagues: {
    league_a: string;
    league_b: string;
    players: number;
    ga90_a: number;
    ga90_b: number;
  };
  birth_months: {
    players: number;
    pct_by_month: number[];
    pct_by_quarter: number[];
    born_on_1_jan_pct: number;
  };
  birth_quarter_young: {
    players_by_quarter: number[];
    odds_ratio_q4_vs_q1: number;
    ci95: [number, number];
  };
  minutes_check: {
    leagues: string[];
    season: string;
    appearances: number;
    within_5_min: number;
    goals_exact: number;
  };
};

export type OutcomeRange = {
  n: number;
  hits: number;
  rate: number;
  unknown_outcome: number;
  multiple_p25: number;
  multiple_p50: number;
  multiple_p75: number;
  share_lost_value: number;
};
export type TimeMachinePick = {
  rank: number;
  id: string;
  name: string;
  club: string;
  league: string;
  position: string;
  age: number;
  value_then: number;
  value_3y: number | null;
  made_it: boolean;
  value_peak: number;
  value_latest: number;
  history: ValuePoint[];
};
export type TimeMachineSeason = {
  season: string;
  decision_date: string;
  outcome_date: string;
  trained_on: string;
  training_rows: number;
  pool: number;
  pool_rate: number;
  hits: number;
  picks: TimeMachinePick[];
};
export type TimeMachineFile = {
  as_of: string;
  six_seasons: {
    tier_a_hits: number;
    tier_a_picks: number;
    pool_hits: number;
    pool_players: number;
    by_season: Record<string, string>;
  };
  outcome_ranges: Record<Tier, OutcomeRange>;
  seasons: TimeMachineSeason[];
};

export type MetaFile = {
  built: string;
  source: string;
  source_last_date: string;
  leagues: number;
  seasons: string;
  radar_season: string;
  pool: { up_to_1m: number; up_to_500k: number; regional_up_to_500k: number };
  model: { type: string; features: number; training_rows: number; trained_on_seasons: string };
  validation: string;
  status: string;
  default_brief: { position: string; max_age: number; budget_eur: number; matters: string[] };
};

export type AppData = {
  players: PlayersFile;
  leagues: LeaguesFile;
  evidence: EvidenceFile;
  timemachine: TimeMachineFile;
  meta: MetaFile;
};

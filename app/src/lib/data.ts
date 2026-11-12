import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AppData,
  EvidenceFile,
  LeaguesFile,
  MetaFile,
  PlayersFile,
  TimeMachineFile,
} from './types';

export type FileName = 'players' | 'leagues' | 'evidence' | 'timemachine' | 'meta';
export const FILE_NAMES: FileName[] = ['players', 'leagues', 'evidence', 'timemachine', 'meta'];

/** A data file that is missing (network or HTTP error) or malformed (bad JSON or wrong shape). */
export class DataError extends Error {
  readonly file: string;
  readonly kind: 'missing' | 'malformed';
  /** The files that did load next to the failed one, so a screen can still show what it can. */
  loaded: Partial<AppData> = {};
  constructor(file: string, kind: 'missing' | 'malformed', detail: string) {
    super(`${file}.json: ${detail}`);
    this.name = 'DataError';
    this.file = `${file}.json`;
    this.kind = kind;
  }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const orNull = (f: (v: unknown) => boolean) => (v: unknown) => v === null || f(v);
const oneOf = (...values: unknown[]) => (v: unknown) => values.includes(v);

type Shape = Record<string, (v: unknown) => boolean>;
const has = (v: unknown, shape: Shape): v is Rec =>
  isRec(v) && Object.entries(shape).every(([k, check]) => k in v && check(v[k]));
const arrayOf = (check: (v: unknown) => boolean) => (v: unknown) => isArr(v) && v.every(check);
const shape = (s: Shape) => (v: unknown) => has(v, s);

const isRuleRow = shape({ rule: isStr, label: isStr, hits: isNum, picks: isNum, rate: isNum });
const isHistory = arrayOf((p) => isArr(p) && p.length === 2 && isStr(p[0]) && isNum(p[1]));
const isTierEvidence = shape({
  share: isStr, hits: isNum, n: isNum, rate: isNum,
  multiple_p25: isNum, multiple_p50: isNum, multiple_p75: isNum, no_later_value: isNum,
});
const isOutcomeRange = shape({
  n: isNum, hits: isNum, rate: isNum, unknown_outcome: isNum,
  multiple_p25: isNum, multiple_p50: isNum, multiple_p75: isNum, share_lost_value: isNum,
});

const isPlayer = shape({
  id: isStr, name: isStr, club: isStr, league_id: isStr, league_name: isStr,
  position_group: oneOf('Attack', 'Midfield', 'Defender', 'Goalkeeper'),
  position: isStr, age: isNum, birth_quarter: isNum,
  height_cm: orNull(isNum), foot: orNull(isStr),
  value_eur: isNum, value_date: isStr, contract_until: orNull(isStr),
  minutes: isNum, matches: isNum, goals: isNum, assists: isNum,
  ga90: isNum, league_factor: isNum, league_factor_source: oneOf('moves', 'estimate'),
  ga90_adj: isNum, involvement: isNum, role: isNum,
  pct: shape({ output: isNum, scoring: isNum, creating: isNum, involvement: isNum, role: isNum }),
  score: orNull(isNum), score_rank_pct: orNull(isNum), tier: oneOf('A', 'B', 'C', null),
  drivers: arrayOf(shape({ sign: oneOf('+', '-'), key: isStr, text: isStr })),
  flags: shape({
    under18: isBool, low_sample: isBool, contract_ending: isBool, born_q4: isBool,
    limited_position_data: isBool,
  }),
  similar: arrayOf(shape({ id: isStr, similarity: isNum, diff: isStr })),
  note: orNull(isStr), note_source: oneOf('model', 'template', null),
  citizenship: isStr, value_history: isHistory, in_pool: isBool,
});

const isPlayers = (v: unknown): v is PlayersFile => isArr(v) && v.every(isPlayer);

const isLeagues = (v: unknown): v is LeaguesFile =>
  has(v, {
    leagues: arrayOf(shape({
      id: isStr, name: isStr, seasons: isNum, factor: isNum,
      factor_source: oneOf('moves', 'estimate'), pool_1m: isNum, pool_500k: isNum,
    })),
  });

const isEvidence = (v: unknown): v is EvidenceFile =>
  has(v, {
    generated: isStr,
    definitions: (d) => isRec(d) && Object.values(d).every(isStr),
    backtest: shape({
      test_seasons: arrayOf(isStr),
      pick_share: isNum,
      budgets: arrayOf(shape({
        budget_eur: isNum, players: isNum, picks_per_rule: isNum, margin_pp: isNum, base_rate: isNum,
        rows: arrayOf(isRuleRow), rows_top20: arrayOf(isRuleRow),
      })),
      by_season: arrayOf(shape({ season: isStr, hits: isNum, picks: isNum })),
    }),
    tiers: shape({ A: isTierEvidence, B: isTierEvidence, C: isTierEvidence }),
    league_moves: shape({ total: isNum, used_for_factors: isNum }),
    same_players_two_leagues: shape({
      league_a: isStr, league_b: isStr, players: isNum, ga90_a: isNum, ga90_b: isNum,
    }),
    birth_months: shape({
      players: isNum,
      pct_by_month: (a) => isArr(a) && a.length === 12 && a.every(isNum),
      pct_by_quarter: (a) => isArr(a) && a.length === 4 && a.every(isNum),
      born_on_1_jan_pct: isNum,
    }),
    birth_quarter_young: shape({
      players_by_quarter: (a) => isArr(a) && a.length === 4 && a.every(isNum),
      odds_ratio_q4_vs_q1: isNum,
      ci95: (a) => isArr(a) && a.length === 2 && a.every(isNum),
    }),
    minutes_check: shape({
      leagues: arrayOf(isStr), season: isStr, appearances: isNum, within_5_min: isNum, goals_exact: isNum,
    }),
  });

const isPick = shape({
  rank: isNum, id: isStr, name: isStr, club: isStr, league: isStr, position: isStr, age: isNum,
  value_then: isNum, value_3y: orNull(isNum), made_it: isBool, value_peak: isNum, value_latest: isNum,
  history: isHistory,
});
const isTimeMachine = (v: unknown): v is TimeMachineFile =>
  has(v, {
    as_of: isStr,
    six_seasons: shape({
      tier_a_hits: isNum, tier_a_picks: isNum, pool_hits: isNum, pool_players: isNum,
      by_season: (d) => isRec(d) && Object.values(d).every(isStr),
    }),
    outcome_ranges: shape({ A: isOutcomeRange, B: isOutcomeRange, C: isOutcomeRange }),
    seasons: arrayOf(shape({
      season: isStr, decision_date: isStr, outcome_date: isStr, trained_on: isStr,
      training_rows: isNum, pool: isNum, pool_rate: isNum, hits: isNum, picks: arrayOf(isPick),
    })),
  });

const isMeta = (v: unknown): v is MetaFile =>
  has(v, {
    built: isStr, source: isStr, source_last_date: isStr, leagues: isNum, seasons: isStr,
    radar_season: isStr,
    pool: shape({ up_to_1m: isNum, up_to_500k: isNum, regional_up_to_500k: isNum }),
    model: shape({ type: isStr, features: isNum, training_rows: isNum, trained_on_seasons: isStr }),
    validation: isStr, status: isStr,
    default_brief: shape({ position: isStr, max_age: isNum, budget_eur: isNum, matters: arrayOf(isStr) }),
  });

const GUARDS: { [K in FileName]: (v: unknown) => v is AppData[K] } = {
  players: isPlayers,
  leagues: isLeagues,
  evidence: isEvidence,
  timemachine: isTimeMachine,
  meta: isMeta,
};

/** Fetches one file and checks its shape. Throws a DataError that names the file. */
export async function loadFile<K extends FileName>(
  name: K,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<AppData[K]> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}data/${name}.json`);
  } catch (error) {
    throw new DataError(name, 'missing', error instanceof Error ? error.message : 'network error');
  }
  if (!response.ok) throw new DataError(name, 'missing', `HTTP ${response.status}`);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new DataError(name, 'malformed', 'not valid JSON');
  }
  if (!GUARDS[name](json)) throw new DataError(name, 'malformed', 'required fields are missing or have the wrong type');
  return json as AppData[K];
}

/** Loads all five files. A failure rejects with a DataError that names the first failed file and carries the files that loaded. */
export async function loadAll(baseUrl?: string): Promise<AppData> {
  const results = await Promise.allSettled(FILE_NAMES.map((n) => loadFile(n, baseUrl)));
  const loaded: Record<string, unknown> = {};
  let failure: DataError | null = null;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') loaded[FILE_NAMES[i]] = r.value;
    else if (failure === null) failure = r.reason instanceof DataError ? r.reason : new DataError(FILE_NAMES[i], 'malformed', String(r.reason));
  });
  if (failure !== null) {
    (failure as DataError).loaded = loaded as Partial<AppData>;
    throw failure;
  }
  return loaded as unknown as AppData;
}

export type DataState =
  | { status: 'loading' }
  | { status: 'ready'; data: AppData }
  | { status: 'error'; error: DataError };

export type DataContextValue = DataState & { retry: () => void };

const DataContext = createContext<DataContextValue | null>(null);

/** Loads the five data files once and shares them with the whole app. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    loadAll().then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) => {
        if (!current) return;
        setState({
          status: 'error',
          error: error instanceof DataError ? error : new DataError('data', 'malformed', String(error)),
        });
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo<DataContextValue>(() => ({ ...state, retry }), [state, retry]);
  return createElement(DataContext.Provider, { value }, children);
}

/** The data state: loading, ready (with `data`) or error (with `error.file`), plus `retry()`. */
export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider.');
  return value;
}

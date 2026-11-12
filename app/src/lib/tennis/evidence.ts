import type { TennisBacktest, TennisMeta, TennisTier } from './types';

export type Verdict = 'inside' | 'ahead' | 'behind' | 'none';

export type EvidenceRule = { key: string; label: string; hits: number; percent: number };
export type TierLine = { tier: TennisTier; n: number; hits: number; percent: number };
export type YearRow = { year: number; pool: number; poolHits: number; picked: number; modelHits: number; rankHits: number };
export type Tally = { ahead: number; level: number; behind: number; years: number };
export type WeightLine = { key: string; positive: boolean };

export type Evidence = {
  years: [number, number] | null;
  pool: number;
  poolHits: number;
  poolRatePct: number;
  picked: number;
  modelHits: number;
  modelPercent: number;
  rules: EvidenceRule[];
  /** The best rule other than the model. */
  rival: EvidenceRule | null;
  marginPct: number;
  /** The model's rate minus the rival's, in points; null without a rival. */
  leadPct: number | null;
  verdict: Verdict;
  tiers: TierLine[];
  byYear: YearRow[];
  tally: Tally;
};

/** A whole-number percentage; 0 when there is nothing to divide by. */
export const percentOf = (hits: number, n: number): number => (n > 0 ? Math.round((hits / n) * 100) : 0);

/** How the model's lead over a rival compares with the margin. */
export function verdictOf(leadPct: number | null, marginPct: number): Verdict {
  if (leadPct === null) return 'none';
  if (leadPct <= 0) return 'behind';
  return leadPct <= marginPct ? 'inside' : 'ahead';
}

/** In how many years the model's top 10% held more, as many or fewer hits than the best ranking's. */
export function tallyOf(rows: YearRow[]): Tally {
  const t: Tally = { ahead: 0, level: 0, behind: 0, years: rows.length };
  for (const r of rows) {
    if (r.modelHits > r.rankHits) t.ahead += 1;
    else if (r.modelHits === r.rankHits) t.level += 1;
    else t.behind += 1;
  }
  return t;
}

const TIERS: TennisTier[] = ['A', 'B', 'C'];

/** Everything the evidence screen shows, computed from the backtest. */
export function evidenceOf(b: TennisBacktest): Evidence {
  const rules = b.rules.map((r) => ({ key: r.key, label: r.label, hits: r.hits, percent: percentOf(r.hits, b.picked) }));
  const model = b.rules.find((r) => r.key === 'model');
  const rivalRule = b.rules.filter((r) => r.key !== 'model').sort((a, c) => c.hits - a.hits)[0];
  const rival = rivalRule ? (rules.find((r) => r.key === rivalRule.key) ?? null) : null;
  const leadPct = model && rivalRule ? Math.round((model.rate_pct - rivalRule.rate_pct) * 10) / 10 : null;
  const modelHits = model?.hits ?? 0;
  const byYear = (b.by_year ?? []).map((y) => ({
    year: y.year, pool: y.pool, poolHits: y.pool_hits, picked: y.picked, modelHits: y.model_hits, rankHits: y.rank_hits,
  }));
  return {
    years: b.years.length > 0 ? [Math.min(...b.years), Math.max(...b.years)] : null,
    pool: b.pool,
    poolHits: b.pool_hits,
    poolRatePct: b.pool_rate_pct,
    picked: b.picked,
    modelHits,
    modelPercent: percentOf(modelHits, b.picked),
    rules,
    rival,
    marginPct: b.margin_pct,
    leadPct,
    verdict: verdictOf(leadPct, b.margin_pct),
    tiers: TIERS.filter((t) => b.tiers?.[t]).map((t) => ({ tier: t, n: b.tiers[t].n, hits: b.tiers[t].hits, percent: percentOf(b.tiers[t].hits, b.tiers[t].n) })),
    byYear,
    tally: tallyOf(byYear),
  };
}

/** The inputs in a fixed order; `positive` is true when a higher value of the input raises the score. A key the file lacks is left out. */
const INPUT_KEYS = ['age', 'log_rank', 'win_pct', 'upper_share', 'log_top200_wins'] as const;
export function weightLines(weights: TennisMeta['weights']): WeightLine[] {
  const out: WeightLine[] = [];
  for (const key of INPUT_KEYS) {
    const w = weights[key];
    if (typeof w === 'number' && Number.isFinite(w)) out.push({ key, positive: w > 0 });
  }
  return out;
}

import type { EvidenceFile, Player } from './types';

export type Projection = {
  low: number;
  high: number;
  typical: number;
  /** Share of the tier's past players with no market value three years later, 0 to 1. */
  noLaterValue: number;
  tier: 'A' | 'B' | 'C';
  multiples: { p25: number; p50: number; p75: number };
  /** Past players in the tier. */
  n: number;
};

/** An ISO date three years later; 29 February becomes 28 February. */
export function threeYearsLater(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  const day = m === '02' && d === '29' ? '28' : d;
  return `${Number(y) + 3}-${m}-${day}`;
}

/**
 * The range in which half of past players of the tier ended three years later: today's value times the tier's
 * quartile multiples, and the typical outcome times the median. Null when there is nothing honest to show.
 */
export function projectionOf(p: Player, evidence: EvidenceFile): Projection | null {
  if (!p.in_pool || p.tier === null) return null;
  if (!Number.isFinite(p.value_eur) || p.value_eur <= 0) return null;
  const row = evidence.tiers[p.tier];
  if (!row || row.n <= 0) return null;
  return {
    low: p.value_eur * row.multiple_p25,
    high: p.value_eur * row.multiple_p75,
    typical: p.value_eur * row.multiple_p50,
    noLaterValue: row.no_later_value / row.n,
    tier: p.tier,
    multiples: { p25: row.multiple_p25, p50: row.multiple_p50, p75: row.multiple_p75 },
    n: row.n,
  };
}

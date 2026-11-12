import type { EvidenceFile, Flags, Player, Tier } from './types';

/** The budget of the context row: young players valued up to 1,000,000 euros. */
export const CONTEXT_BUDGET_EUR = 1_000_000;
export const MAX_PLUS = 3;
export const MAX_MINUS = 1;

export type Outlook = {
  tier: Tier;
  like: number;
  average: number;
  tierHits: number;
  tierN: number;
  poolHits: number;
  poolPlayers: number;
  madeIt: string;
};

/** A rate between 0 and 1 as dots out of ten. */
export const dotsOf = (rate: number): number => Math.max(0, Math.min(10, Math.round(rate * 10)));

/** The numbers of the Outlook panel, or null when the evidence has no entry for the tier or the budget. */
export function outlookOf(evidence: EvidenceFile, tier: Tier): Outlook | null {
  const row = evidence.tiers[tier];
  const budget = evidence.backtest.budgets.find((b) => b.budget_eur === CONTEXT_BUDGET_EUR);
  if (!row || !budget) return null;
  return {
    tier,
    like: dotsOf(row.rate),
    average: dotsOf(budget.base_rate),
    tierHits: row.hits,
    tierN: row.n,
    poolHits: Math.round(budget.base_rate * budget.players),
    poolPlayers: budget.players,
    madeIt: evidence.definitions.hit ?? '',
  };
}

/** First-quarter share divided by last-quarter share of birthdays, one decimal. */
export function bornLateTimes(evidence: EvidenceFile): string {
  const q = evidence.birth_months.pct_by_quarter;
  return (q[0] / q[3]).toFixed(1);
}

/** Up to three reasons for and one against, in the file's order. */
export function pickDrivers(p: Pick<Player, 'drivers'>) {
  return [
    ...p.drivers.filter((d) => d.sign === '+').slice(0, MAX_PLUS),
    ...p.drivers.filter((d) => d.sign === '-').slice(0, MAX_MINUS),
  ];
}

export const FLAG_ORDER: (keyof Flags)[] = ['born_q4', 'low_sample', 'limited_position_data', 'under18', 'contract_ending'];

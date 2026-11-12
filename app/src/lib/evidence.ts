import { evidence as t } from './text.en';
import { hasToday, madeIt } from './timemachine';
import type { BudgetBacktest, EvidenceFile, RuleRow, TimeMachineFile, TimeMachinePick, TimeMachineSeason } from './types';

/** One bar of the chart, ready to draw. */
export type EvidenceBar = {
  key: string;
  label: string;
  /** The bar runs to this rate (0 to 1). */
  value: number;
  /** The light extension runs up to this rate; only the model row has one. */
  upper?: number;
  /** The text printed beside the bar. */
  printed: string;
  /** The hover and focus text: hits and picks. */
  tip: string;
  emphasis?: boolean;
};

export type EvidenceChart = {
  bars: EvidenceBar[];
  reference: { value: number; label: string };
};

export const MAIN_BUDGET_EUR = 1_000_000;
export const SMALL_BUDGET_EUR = 500_000;

const MODEL_IDS = ['model_lr', 'model_gb'] as const;
const RULE_IDS = ['most_minutes', 'most_goals_assists', 'youngest', 'cheapest'] as const;

const pct = (rate: number): number => Math.round(rate * 100);

function modelBar(rows: RuleRow[]): EvidenceBar | null {
  const found = MODEL_IDS.map((id) => rows.find((r) => r.rule === id)).filter((r): r is RuleRow => r !== undefined);
  if (found.length === 0) return null;
  const rates = found.map((r) => r.rate);
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  const printed = pct(low) === pct(high) ? `${pct(low)}%` : `${pct(low)}–${pct(high)}%`;
  const tip = t.modelTip(found.map((r) => t.modelPart(t.modelTypes[r.rule as (typeof MODEL_IDS)[number]], pct(r.rate), r.hits, r.picks)));
  return { key: 'model', label: t.rows.model, value: low, upper: high, printed, tip, emphasis: true };
}

/** The five bars of one budget in the fixed order; a rule missing from the file is left out. */
export function chartForBudget(budget: BudgetBacktest, short = false): EvidenceChart {
  const bars: EvidenceBar[] = [];
  const model = modelBar(budget.rows);
  if (model) bars.push(model);
  for (const id of RULE_IDS) {
    const row = budget.rows.find((r) => r.rule === id);
    if (row) bars.push({ key: id, label: t.rows[id], value: row.rate, printed: `${pct(row.rate)}%`, tip: t.ruleTip(row.hits, row.picks) });
  }
  const label = short ? t.averageShort(pct(budget.base_rate)) : t.average(pct(budget.base_rate));
  return { bars, reference: { value: budget.base_rate, label } };
}

/** The budget entry with test rows, or null when the file holds none. */
export function budgetEntry(file: EvidenceFile, budgetEur: number): BudgetBacktest | null {
  const entry = file.backtest.budgets.find((b) => b.budget_eur === budgetEur);
  return entry && entry.rows.length > 0 ? entry : null;
}

/** The pick with the highest later value; a pick without one never wins and a tie goes to the better rank. Null when no pick has a later value. */
export function biggestRiser(season: TimeMachineSeason): TimeMachinePick | null {
  let best: TimeMachinePick | null = null;
  for (const pick of season.picks) {
    if (pick.value_3y === null) continue;
    if (best === null || best.value_3y === null || pick.value_3y > best.value_3y || (pick.value_3y === best.value_3y && pick.rank < best.rank)) best = pick;
  }
  return best;
}

export type Riser = { season: TimeMachineSeason; pick: TimeMachinePick; showToday: boolean };

/** One riser per season that has any later value, in the file's order. */
export function risers(file: TimeMachineFile): Riser[] {
  const out: Riser[] = [];
  for (const season of file.seasons) {
    const pick = biggestRiser(season);
    if (pick) out.push({ season, pick, showToday: hasToday(season, file.as_of) });
  }
  return out;
}

export type RiserTotals = { picks: number; then: number; later: number; missed: number; noLater: number };

/** The totals over every pick of the seasons that show a tile. A missing later value counts as zero and as not made it. */
export function riserTotals(shown: Riser[]): RiserTotals {
  const picks = shown.flatMap((r) => r.season.picks);
  return {
    picks: picks.length,
    then: picks.reduce((a, p) => a + p.value_then, 0),
    later: picks.reduce((a, p) => a + (p.value_3y ?? 0), 0),
    missed: picks.filter((p) => !madeIt(p)).length,
    noLater: picks.filter((p) => p.value_3y === null).length,
  };
}

/** The address of the time machine at a season with the player selected and the outcome shown. */
export function riserLink(season: string, playerId: string): string {
  return `/time-machine?${new URLSearchParams({ season, player: playerId, revealed: '1' }).toString()}`;
}

export type Edge = { points: number; margin: number; within: boolean };

/** The logistic regression's rate (the product model, taken by its rule id) minus the rate of most minutes, in points, against the margin. Null when the file lacks either row. */
export function edgeOverMinutes(budget: BudgetBacktest): Edge | null {
  const model = budget.rows.find((r) => r.rule === 'model_lr');
  const minutes = budget.rows.find((r) => r.rule === 'most_minutes');
  if (!model || !minutes) return null;
  const exact = (model.rate - minutes.rate) * 100;
  return { points: Math.round(exact), margin: budget.margin_pp, within: Math.abs(exact) <= budget.margin_pp };
}

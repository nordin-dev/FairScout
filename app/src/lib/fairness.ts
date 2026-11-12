import type { Player } from './types';

/**
 * Reasons a young player is easy to overlook, each read from the player's own data:
 * - `young_for_year`: born October to December. Youth selection favours players born early in the
 *   year, who are older and more developed than their peers (the birth-month finding on the evidence screen).
 * - `short_of_chances`: strong output in little playing time. Minutes reward the chances a player was
 *   given, not only what he did with them.
 * Each one fits about one pool player in six, so a sign sets a player apart. (A "regional league"
 * sign was tried and dropped: most cheap young players in the pool play in one, so it said nothing.)
 */
export type Signal = 'young_for_year' | 'short_of_chances';
export const SIGNALS: readonly Signal[] = ['young_for_year', 'short_of_chances'];

/** "Little playing time": a share of team minutes in the lowest 40% of his peers. */
export const SHORT_ROLE_PCT = 40;
/** "Strong output": scoring or creating in the top 30% of his peers. */
export const STRONG_OUTPUT_PCT = 70;

type SignalFields = Pick<Player, 'birth_quarter' | 'pct'>;

/** The overlooked signals of one player, in a fixed order. */
export function signalsOf(p: SignalFields): Signal[] {
  const out: Signal[] = [];
  if (p.birth_quarter === 4) out.push('young_for_year');
  if (p.pct.role < SHORT_ROLE_PCT && Math.max(p.pct.scoring, p.pct.creating) >= STRONG_OUTPUT_PCT) out.push('short_of_chances');
  return out;
}

/** One blind pick: who the scout chose, the model's choice, and the three that were shown. */
export type PickRecord = { scoutId: string; modelId: string; shown: readonly string[] };

/** A count of picks next to what chance alone would give. */
export type Lean = { hits: number; picks: number; chance: number };
/** A share of the scout's picks next to the same share among everyone shown. */
export type Share = { picked: number; pickedOf: number; shown: number; shownOf: number };

export type BiasSummary = {
  picks: number;
  /** Picks that agree with the model. */
  model: Lean;
  /** Picks that had the most goals plus assists of their three. */
  output: Lean;
  /** Picks that had the most minutes of their three. */
  minutes: Lean;
  /** Born January to June, among picks and among everyone shown. */
  bornEarly: Share;
  /** With at least one overlooked signal, among picks and among everyone shown. */
  overlooked: Share;
  /** Overlooked players the model picked and the scout passed. */
  passedOverlooked: string[];
};

/** Picks needed before the summary is shown. */
export const SUMMARY_MIN_PICKS = 3;
/** Under this many picks the summary is labelled as a hint. */
export const SUMMARY_SOLID_PICKS = 10;

type SummaryFields = SignalFields & Pick<Player, 'id' | 'goals' | 'assists' | 'minutes'>;

/** True when `id` holds the highest value among `ids` (a tie counts for every player in it). */
function isTop(id: string, ids: readonly string[], byId: ReadonlyMap<string, SummaryFields>, value: (p: SummaryFields) => number): boolean {
  const me = byId.get(id);
  if (!me) return false;
  return ids.every((other) => {
    const p = byId.get(other);
    return !p || value(p) <= value(me);
  });
}

/**
 * What drove the scout's picks so far. Picks whose players are no longer known are skipped.
 * Returns null under SUMMARY_MIN_PICKS usable picks.
 */
export function biasSummary(records: readonly PickRecord[], byId: ReadonlyMap<string, SummaryFields>): BiasSummary | null {
  const usable = records.filter((r) => r.shown.length === 3 && r.shown.every((id) => byId.has(id)) && byId.has(r.scoutId));
  if (usable.length < SUMMARY_MIN_PICKS) return null;
  const n = usable.length;
  const lean = (hits: number): Lean => ({ hits, picks: n, chance: n / 3 });
  let model = 0;
  let output = 0;
  let minutes = 0;
  const bornEarly: Share = { picked: 0, pickedOf: n, shown: 0, shownOf: 0 };
  const overlooked: Share = { picked: 0, pickedOf: n, shown: 0, shownOf: 0 };
  const passed: string[] = [];
  for (const r of usable) {
    const pick = byId.get(r.scoutId) as SummaryFields;
    if (r.scoutId === r.modelId) model += 1;
    if (isTop(r.scoutId, r.shown, byId, (p) => p.goals + p.assists)) output += 1;
    if (isTop(r.scoutId, r.shown, byId, (p) => p.minutes)) minutes += 1;
    if (pick.birth_quarter <= 2) bornEarly.picked += 1;
    if (signalsOf(pick).length > 0) overlooked.picked += 1;
    for (const id of r.shown) {
      const p = byId.get(id) as SummaryFields;
      bornEarly.shownOf += 1;
      overlooked.shownOf += 1;
      if (p.birth_quarter <= 2) bornEarly.shown += 1;
      if (signalsOf(p).length > 0) overlooked.shown += 1;
    }
    const modelPlayer = byId.get(r.modelId);
    if (modelPlayer && r.scoutId !== r.modelId && signalsOf(modelPlayer).length > 0 && !passed.includes(r.modelId)) passed.push(r.modelId);
  }
  return { picks: n, model: lean(model), output: lean(output), minutes: lean(minutes), bornEarly, overlooked, passedOverlooked: passed };
}

/** A lean is worth naming when it is at least twice what chance gives and covers at least half the picks. */
export function leans(l: Lean): boolean {
  return l.hits >= 2 * l.chance && l.hits * 2 >= l.picks;
}

/** A share differs enough to name when the scout's share is 20 points or more away from the shown share. */
export function shareGap(s: Share): number {
  if (s.pickedOf === 0 || s.shownOf === 0) return 0;
  return Math.round((100 * s.picked) / s.pickedOf - (100 * s.shown) / s.shownOf);
}
export const SHARE_GAP_PP = 20;

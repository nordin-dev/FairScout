import { ratingOf } from './rating';
import { blind } from './text.en';
import type { Player, Tier } from './types';

export type RowKey = 'tier' | 'rating' | 'price' | 'age' | 'minutes';
export type Side = 'model' | 'scout' | null;
export type ReasonRow = {
  key: RowKey;
  model: number | Tier | null;
  scout: number | Tier | null;
  ahead: Side;
};
export type PickReason = {
  rows: ReasonRow[];
  modelTier: Tier | null;
  scoutTier: Tier | null;
  modelAhead: RowKey[];
  modelBehind: RowKey[];
  /** True when the model's score of its pick is the higher of the two. */
  modelScoresHigher: boolean;
};

const TIER_RANK: Record<Tier, number> = { A: 0, B: 1, C: 2 };

/** Who is ahead on one row, where `better` says which direction wins. Equal or unknown values are ahead for no one. */
function lead(model: number | null, scout: number | null, better: 'high' | 'low'): Side {
  if (model === null || scout === null || model === scout) return null;
  return (model > scout) === (better === 'high') ? 'model' : 'scout';
}

/** The five rows of the comparison and the facts the sentence is built from. Ages compare as shown, in whole years. */
export function pickReason(modelPick: Player, scoutPick: Player): PickReason {
  const rank = (p: Player): number | null => (p.tier ? TIER_RANK[p.tier] : null);
  const rows: ReasonRow[] = [
    { key: 'tier', model: modelPick.tier, scout: scoutPick.tier, ahead: lead(rank(modelPick), rank(scoutPick), 'low') },
    { key: 'rating', model: ratingOf(modelPick), scout: ratingOf(scoutPick), ahead: lead(ratingOf(modelPick), ratingOf(scoutPick), 'high') },
    { key: 'price', model: modelPick.value_eur, scout: scoutPick.value_eur, ahead: lead(modelPick.value_eur, scoutPick.value_eur, 'low') },
    { key: 'age', model: Math.floor(modelPick.age), scout: Math.floor(scoutPick.age), ahead: lead(Math.floor(modelPick.age), Math.floor(scoutPick.age), 'low') },
    { key: 'minutes', model: modelPick.minutes, scout: scoutPick.minutes, ahead: lead(modelPick.minutes, scoutPick.minutes, 'high') },
  ];
  const others = rows.filter((r) => r.key !== 'tier');
  return {
    rows,
    modelTier: modelPick.tier,
    scoutTier: scoutPick.tier,
    modelAhead: others.filter((r) => r.ahead === 'model').map((r) => r.key),
    modelBehind: others.filter((r) => r.ahead === 'scout').map((r) => r.key),
    modelScoresHigher: modelPick.score !== null && scoutPick.score !== null && modelPick.score > scoutPick.score,
  };
}

/** The one or two sentences that say why the model prefers its pick, from the facts of `pickReason` only. */
export function reasonSentence(reason: PickReason, modelName: string, scoutName: string): string {
  const better = reason.rows.some((r) => r.key === 'tier' && r.ahead === 'model');
  const tiers =
    reason.modelTier && reason.scoutTier
      ? (better ? blind.reasonTiersBetter : blind.reasonTiers)(modelName, reason.modelTier, scoutName, reason.scoutTier)
      : blind.reasonTierUnknown(modelName, scoutName);
  const words = (keys: RowKey[], table: Record<string, string>): string => blind.reasonList(keys.map((k) => table[k]));
  const rows = blind.reasonRowsAhead(
    modelName,
    words(reason.modelAhead, blind.reasonAhead),
    words(reason.modelBehind, blind.reasonBehind),
  );
  const sameTier = reason.modelTier !== null && reason.modelTier === reason.scoutTier;
  const lead = sameTier && reason.modelScoresHigher ? `${tiers} ${blind.reasonScoreHigher(modelName)}` : tiers;
  return rows ? `${lead} ${rows}` : lead;
}

/** What the model counts in a player's favour, in the words of the data file. */
export function positiveDrivers(player: Pick<Player, 'drivers'>): string[] {
  return player.drivers.filter((d) => d.sign === '+').map((d) => d.text);
}

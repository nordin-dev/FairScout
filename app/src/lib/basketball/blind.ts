import { dataText } from '../dataText';
import { shuffled } from '../trio';
import type { BasketPlayer, BasketTier } from './types';
import { basketBlind as t } from './blindText';

export type BasketMatter = 'scoring' | 'impact' | 'trust';
export const BASKET_MATTERS: readonly BasketMatter[] = ['scoring', 'impact', 'trust'];
export const MAX_MATTERS = 2;
export const MIN_MATCHES = 3;
export const POSITIONS = ['Any', 'Guard', 'Forward', 'Center'] as const;
export type BasketPosition = (typeof POSITIONS)[number];
export const AGE_LIMITS = [21, 23] as const;
export const HIDDEN_LIMITS = [18, 12, 8] as const;

export type BasketBrief = { position: BasketPosition; maxAge: number; hidden: number; matters: readonly BasketMatter[] };

export const DEFAULT_BRIEF: BasketBrief = { position: 'Any', maxAge: 23, hidden: 18, matters: [] };

/** The pct field each priority reads. */
export const pctOf = (p: BasketPlayer, m: BasketMatter): number => p.pct[m];

/** Chooses or un-chooses a priority. A third one drops the oldest of the two. */
export function toggleMatter(current: readonly BasketMatter[], matter: BasketMatter): BasketMatter[] {
  if (current.includes(matter)) return current.filter((m) => m !== matter);
  return [...current, matter].slice(-MAX_MATTERS);
}

/** Position fits (a player without one fits only "Any"), his age is under the limit, and his minutes per game are under the number. */
export const matches = (p: BasketPlayer, b: Pick<BasketBrief, 'position' | 'maxAge' | 'hidden'>): boolean =>
  (b.position === 'Any' || p.position === b.position) && Math.floor(p.age) < b.maxAge && p.mpg < b.hidden;

export const countMatches = (players: readonly BasketPlayer[], b: BasketBrief): number =>
  players.filter((p) => matches(p, b)).length;

export const canShowThree = (count: number): boolean => count >= MIN_MATCHES;

/** The mean of the chosen percentiles; with no choice, of all three. */
export function fitScore(p: BasketPlayer, matters: readonly BasketMatter[]): number {
  const chosen = matters.length > 0 ? matters : BASKET_MATTERS;
  return chosen.reduce((acc, m) => acc + pctOf(p, m), 0) / chosen.length;
}

/** The first by `cmp` (negative: a first); ties go to the lower id. */
function best(players: readonly BasketPlayer[], cmp: (a: BasketPlayer, b: BasketPlayer) => number): BasketPlayer | undefined {
  return [...players].sort((a, b) => cmp(a, b) || (a.id < b.id ? -1 : 1))[0];
}

export function briefSeed(b: BasketBrief): number {
  const text = `basketball|${b.position}|${b.maxAge}|${b.hidden}|${b.matters.join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type BasketTrio = {
  modelTop: BasketPlayer;
  mostMinutes: BasketPlayer;
  bestFit: BasketPlayer;
  order: [BasketPlayer, BasketPlayer, BasketPlayer];
};

/** The model's top, the one with the most minutes of the rest, the best remaining fit; no player twice. Null with fewer than three. */
export function pickTrio(players: readonly BasketPlayer[], b: BasketBrief): BasketTrio | null {
  const pool = players.filter((p) => matches(p, b));
  const modelTop = best(pool, (x, y) => y.score - x.score);
  const mostMinutes = best(
    pool.filter((p) => p.id !== modelTop?.id),
    (x, y) => y.mpg - x.mpg,
  );
  const bestFit = best(
    pool.filter((p) => p.id !== modelTop?.id && p.id !== mostMinutes?.id),
    (x, y) => fitScore(y, b.matters) - fitScore(x, b.matters) || y.mpg - x.mpg,
  );
  if (!modelTop || !mostMinutes || !bestFit) return null;
  const [a, bb, c] = shuffled([modelTop, mostMinutes, bestFit], briefSeed(b));
  return { modelTop, mostMinutes, bestFit, order: [a, bb, c] };
}

/* ---- the reason ---- */

export type RowKey = 'tier' | 'mpg' | 'ppg' | 'pir40' | 'age';
export type Side = 'model' | 'scout' | null;
export type ReasonRow = { key: RowKey; model: number | BasketTier; scout: number | BasketTier; ahead: Side };
export type PickReason = {
  rows: ReasonRow[];
  modelTier: BasketTier;
  scoutTier: BasketTier;
  modelAhead: RowKey[];
  modelBehind: RowKey[];
  modelScoresHigher: boolean;
};

const TIER_RANK: Record<BasketTier, number> = { A: 0, B: 1, C: 2 };

function lead(model: number, scout: number, better: 'high' | 'low'): Side {
  if (model === scout) return null;
  return (model > scout) === (better === 'high') ? 'model' : 'scout';
}

export function pickReason(model: BasketPlayer, scout: BasketPlayer): PickReason {
  const ma = Math.floor(model.age);
  const sa = Math.floor(scout.age);
  const rows: ReasonRow[] = [
    { key: 'tier', model: model.tier, scout: scout.tier, ahead: lead(TIER_RANK[model.tier], TIER_RANK[scout.tier], 'low') },
    { key: 'mpg', model: model.mpg, scout: scout.mpg, ahead: lead(model.mpg, scout.mpg, 'high') },
    { key: 'ppg', model: model.ppg, scout: scout.ppg, ahead: lead(model.ppg, scout.ppg, 'high') },
    { key: 'pir40', model: model.pir40, scout: scout.pir40, ahead: lead(model.pir40, scout.pir40, 'high') },
    { key: 'age', model: ma, scout: sa, ahead: lead(ma, sa, 'low') },
  ];
  const others = rows.filter((r) => r.key !== 'tier');
  return {
    rows,
    modelTier: model.tier,
    scoutTier: scout.tier,
    modelAhead: others.filter((r) => r.ahead === 'model').map((r) => r.key),
    modelBehind: others.filter((r) => r.ahead === 'scout').map((r) => r.key),
    modelScoresHigher: model.score > scout.score,
  };
}

export function reasonSentence(reason: PickReason, modelName: string, scoutName: string): string {
  const better = reason.rows.some((r) => r.key === 'tier' && r.ahead === 'model');
  const tiers = (better ? t.reasonTiersBetter : t.reasonTiers)(modelName, reason.modelTier, scoutName, reason.scoutTier);
  const words = (keys: RowKey[], table: Record<string, string>): string => t.reasonList(keys.map((k) => table[k]));
  const rows = t.reasonRowsAhead(modelName, words(reason.modelAhead, t.reasonAhead), words(reason.modelBehind, t.reasonBehind));
  const sameTier = reason.modelTier === reason.scoutTier;
  const first = sameTier && reason.modelScoresHigher ? `${tiers} ${t.reasonScoreHigher(modelName)}` : tiers;
  return rows ? `${first} ${rows}` : first;
}

export const positiveDrivers = (p: Pick<BasketPlayer, 'drivers'>): string[] =>
  p.drivers.filter((d) => d.sign === '+').map((d) => dataText(d.text));

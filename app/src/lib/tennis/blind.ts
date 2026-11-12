import { shuffled } from '../trio';
import type { TennisPlayer, TennisTier } from './types';
import { tennisBlind as t } from './blindText';

export type TennisMatter = 'wins' | 'level' | 'rise';
export const TENNIS_MATTERS: readonly TennisMatter[] = ['wins', 'level', 'rise'];
export const MAX_MATTERS = 2;
export const MIN_MATCHES = 3;
export const AGE_LIMITS = [19, 20] as const;
export const HIDDEN_LIMITS = [150, 250, 400] as const;

export type TennisBrief = { maxAge: number; hidden: number; matters: readonly TennisMatter[] };

export const DEFAULT_BRIEF: TennisBrief = { maxAge: 20, hidden: 150, matters: [] };

/** The pct field each priority reads. */
export const pctOf = (p: TennisPlayer, m: TennisMatter): number => p.pct[m];

/** Chooses or un-chooses a priority. A third one drops the oldest of the two. */
export function toggleMatter(current: readonly TennisMatter[], matter: TennisMatter): TennisMatter[] {
  if (current.includes(matter)) return current.filter((m) => m !== matter);
  return [...current, matter].slice(-MAX_MATTERS);
}

/** Age in whole years is at most the limit, and the rank is outside the number. */
export const matches = (p: TennisPlayer, b: Pick<TennisBrief, 'maxAge' | 'hidden'>): boolean =>
  Math.floor(p.age) <= b.maxAge && p.rank > b.hidden;

export const countMatches = (players: readonly TennisPlayer[], b: TennisBrief): number =>
  players.filter((p) => matches(p, b)).length;

export const canShowThree = (count: number): boolean => count >= MIN_MATCHES;

/** The mean of the chosen percentiles; with no choice, of all three. */
export function fitScore(p: TennisPlayer, matters: readonly TennisMatter[]): number {
  const chosen = matters.length > 0 ? matters : TENNIS_MATTERS;
  return chosen.reduce((acc, m) => acc + pctOf(p, m), 0) / chosen.length;
}

/** The first by `better` (negative: a first); ties go to the lower id. */
function best(players: readonly TennisPlayer[], cmp: (a: TennisPlayer, b: TennisPlayer) => number): TennisPlayer | undefined {
  return [...players].sort((a, b) => cmp(a, b) || (a.id < b.id ? -1 : 1))[0];
}

export function briefSeed(b: TennisBrief): number {
  const text = `tennis|${b.maxAge}|${b.hidden}|${b.matters.join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type TennisTrio = {
  modelTop: TennisPlayer;
  bestRanked: TennisPlayer;
  bestFit: TennisPlayer;
  order: [TennisPlayer, TennisPlayer, TennisPlayer];
};

/** The model's top, the best ranked of the rest, the best remaining fit; no player twice. Null with fewer than three. */
export function pickTrio(players: readonly TennisPlayer[], b: TennisBrief): TennisTrio | null {
  const pool = players.filter((p) => matches(p, b));
  const modelTop = best(pool, (x, y) => y.score - x.score);
  const bestRanked = best(
    pool.filter((p) => p.id !== modelTop?.id),
    (x, y) => x.rank - y.rank,
  );
  const bestFit = best(
    pool.filter((p) => p.id !== modelTop?.id && p.id !== bestRanked?.id),
    (x, y) => fitScore(y, b.matters) - fitScore(x, b.matters) || x.rank - y.rank,
  );
  if (!modelTop || !bestRanked || !bestFit) return null;
  const [a, bb, c] = shuffled([modelTop, bestRanked, bestFit], briefSeed(b));
  return { modelTop, bestRanked, bestFit, order: [a, bb, c] };
}

/* ---- the reason ---- */

export type RowKey = 'tier' | 'rank' | 'winRate' | 'age' | 'top200';
export type Side = 'model' | 'scout' | null;
export type ReasonRow = { key: RowKey; model: number | TennisTier | null; scout: number | TennisTier | null; ahead: Side };
export type PickReason = {
  rows: ReasonRow[];
  modelTier: TennisTier;
  scoutTier: TennisTier;
  modelAhead: RowKey[];
  modelBehind: RowKey[];
  modelScoresHigher: boolean;
};

const TIER_RANK: Record<TennisTier, number> = { A: 0, B: 1, C: 2 };

function lead(model: number | null, scout: number | null, better: 'high' | 'low'): Side {
  if (model === null || scout === null || model === scout) return null;
  return (model > scout) === (better === 'high') ? 'model' : 'scout';
}

/** The win rate in whole percent; null without matches. */
export const winRate = (p: TennisPlayer): number | null => (p.matches > 0 ? Math.round((p.wins / p.matches) * 100) : null);

export function pickReason(model: TennisPlayer, scout: TennisPlayer): PickReason {
  const ma = Math.floor(model.age);
  const sa = Math.floor(scout.age);
  const rows: ReasonRow[] = [
    { key: 'tier', model: model.tier, scout: scout.tier, ahead: lead(TIER_RANK[model.tier], TIER_RANK[scout.tier], 'low') },
    { key: 'rank', model: model.rank, scout: scout.rank, ahead: lead(model.rank, scout.rank, 'low') },
    { key: 'winRate', model: winRate(model), scout: winRate(scout), ahead: lead(winRate(model), winRate(scout), 'high') },
    { key: 'age', model: ma, scout: sa, ahead: lead(ma, sa, 'low') },
    { key: 'top200', model: model.top200_wins, scout: scout.top200_wins, ahead: lead(model.top200_wins, scout.top200_wins, 'high') },
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

export const positiveDrivers = (p: Pick<TennisPlayer, 'drivers'>): string[] =>
  p.drivers.filter((d) => d.sign === '+').map((d) => d.text);

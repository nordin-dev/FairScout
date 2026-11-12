import { matches, MATTERS, type BriefCriteria, type Matter } from './brief';
import type { Player } from './types';

export type TrioBrief = BriefCriteria & { matters: readonly Matter[] };

export type Trio = {
  /** The model's top match: the highest score. */
  modelTop: Player;
  /** The top by raw output: the most goals plus assists among the rest. */
  rawTop: Player;
  /** The best remaining match for the scout's priorities. */
  bestFit: Player;
  /** The same three in the order the scout sees them, fixed by the brief. */
  order: [Player, Player, Player];
};

const FIELD: Record<Matter, 'creating' | 'scoring' | 'role'> = {
  creates: 'creating',
  scores: 'scoring',
  plays: 'role',
};

/** The mean of the scores the scout chose; with no choice, of all three. */
export function fitScore(player: Player, matters: readonly Matter[]): number {
  const chosen = matters.length > 0 ? matters : MATTERS;
  const sum = chosen.reduce((acc, m) => acc + player.pct[FIELD[m]], 0);
  return sum / chosen.length;
}

/** Highest value first; a tie goes to the higher ga90, then to the lower id. */
function best(players: readonly Player[], value: (p: Player) => number): Player | undefined {
  let top: Player | undefined;
  for (const p of players) {
    if (!top) {
      top = p;
      continue;
    }
    const diff = value(p) - value(top);
    if (diff > 0 || (diff === 0 && (p.ga90 > top.ga90 || (p.ga90 === top.ga90 && p.id < top.id)))) top = p;
  }
  return top;
}

/** A 32-bit FNV-1a hash of the brief, used as the seed of the order. */
export function briefSeed(brief: TrioBrief): number {
  const text = `${brief.position}|${brief.maxAge}|${brief.budget}|${brief.matters.join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small deterministic generator (mulberry32): the same seed gives the same sequence. */
function generator(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Puts the three in an order fixed by the seed. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const next = generator(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Chooses the three candidates among the players that match the brief: the model's top, the top
 * by goals plus assists, and the best remaining match for the priorities, no player twice.
 * Returns null when fewer than three players match.
 */
export function pickTrio(players: readonly Player[], brief: TrioBrief): Trio | null {
  const pool = players.filter((p) => matches(p, brief));
  const modelTop = best(pool, (p) => p.score ?? -1);
  const rawTop = best(
    pool.filter((p) => p.id !== modelTop?.id),
    (p) => p.goals + p.assists,
  );
  const bestFit = best(
    pool.filter((p) => p.id !== modelTop?.id && p.id !== rawTop?.id),
    (p) => fitScore(p, brief.matters),
  );
  if (!modelTop || !rawTop || !bestFit) return null;
  const [a, b, c] = shuffled([modelTop, rawTop, bestFit], briefSeed(brief));
  return { modelTop, rawTop, bestFit, order: [a, b, c] };
}

/** A key that changes whenever the brief or the budget changes; rounds belong to one key. */
export function briefKey(brief: TrioBrief): string {
  return `${brief.position}|${brief.maxAge}|${brief.budget}|${brief.matters.join(',')}`;
}

/** How many players match the brief and have not been shown yet. */
export function unseenCount(players: readonly Player[], brief: TrioBrief, seen: ReadonlySet<string>): number {
  let n = 0;
  for (const p of players) if (matches(p, brief) && !seen.has(p.id)) n += 1;
  return n;
}

/**
 * A later round: three players drawn at random (fixed by the brief and the round) from the matching
 * players not shown yet. Unlike the first round they are not chosen to make a point, so the scout's
 * picks over several rounds say something about the scout. The roles are given afterwards: the
 * highest model score of the three, the most goals plus assists of the other two, and the last one.
 * Returns null when fewer than three unseen players match.
 */
export function drawTrio(players: readonly Player[], brief: TrioBrief, seen: ReadonlySet<string>, round: number): Trio | null {
  const pool = players.filter((p) => matches(p, brief) && !seen.has(p.id)).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  if (pool.length < 3) return null;
  const seed = (briefSeed(brief) + Math.imul(round, 0x9e3779b1)) >>> 0;
  const three = shuffled(pool, seed).slice(0, 3);
  const modelTop = best(three, (p) => p.score ?? -1) as Player;
  const rest = three.filter((p) => p.id !== modelTop.id);
  const rawTop = best(rest, (p) => p.goals + p.assists) as Player;
  const bestFit = rest.find((p) => p.id !== rawTop.id) as Player;
  const [a, b, c] = shuffled([modelTop, rawTop, bestFit], seed ^ 0x5bd1e995);
  return { modelTop, rawTop, bestFit, order: [a, b, c] };
}

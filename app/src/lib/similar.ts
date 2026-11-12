import type { Player } from './types';

export type SimilarPlayer = { player: Player; similarity: number; diff: string };

const MAX_SIMILAR = 3;

/**
 * The similar players of a player that are in the file and cost at most the budget,
 * most similar first (ties by id), at most three. Entries pointing at himself or at an unknown id are left out.
 */
export function similarInBudget(from: Player, players: readonly Player[], budget: number): SimilarPlayer[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const found: SimilarPlayer[] = [];
  for (const entry of from.similar) {
    const other = byId.get(entry.id);
    if (!other || other.id === from.id || other.value_eur > budget) continue;
    found.push({ player: other, similarity: entry.similarity, diff: entry.diff });
  }
  found.sort((a, b) => b.similarity - a.similarity || (a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0));
  return found.slice(0, MAX_SIMILAR);
}

/**
 * The first two sentences of a note. A sentence ends at ".", "!" or "?" that is followed by white space and a capital
 * letter or digit, or by the end of the text; a period between two digits never ends one.
 */
export function shortNote(note: string | null | undefined): string {
  const text = (note ?? '').trim();
  if (!text) return '';
  const ends: number[] = [];
  const end = /[.!?]+(?=\s+[\p{Lu}\d]|\s*$)/gu;
  for (let m = end.exec(text); m; m = end.exec(text)) ends.push(m.index + m[0].length);
  const cut = ends[1] ?? text.length;
  return text.slice(0, cut).trim();
}

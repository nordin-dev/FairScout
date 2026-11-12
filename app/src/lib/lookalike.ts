/**
 * "Similar, but within reach": the rule behind section 01, the same for every sport.
 *
 * A player is compared on scores of 0 to 100 only. His name, club, country and price are
 * not part of the comparison, so a player of a small league stands next to one of a big league.
 */

export type LookTier = 'A' | 'B' | 'C' | null;

/** One player as the screen needs him, whatever the sport. */
export type LookRow = {
  id: string;
  name: string;
  /** One line under the name: club and league, or country. */
  line: string;
  /** Only players of the same group are compared: the position. Empty when the sport has none. */
  group: string;
  /** The three scores shown on his card; null when one of them is not known. */
  scores: readonly [number, number, number] | null;
  /** The scores the comparison uses: the shown ones, or a part of them. Null when one is not known. */
  compare: readonly number[] | null;
  /**
   * What keeps a player out of reach, as a number where larger is further away: the price in
   * football, the height of the ranking in tennis, the minutes per game in basketball.
   */
  cost: number;
  /** The cost as shown: "€300k", "No. 512", "6.2 min". */
  costText: string;
  /** Position and age in a few words. */
  facts: string;
  tier: LookTier;
  /** True for a player of the pool: only these are offered as a match. */
  eligible: boolean;
  /** Output before and after the league adjustment, where the sport has one. */
  adjust: { where: string; raw: string; adjusted: string } | null;
  /** Short warnings: few minutes, born late in the year. */
  flags: readonly string[];
};

export type LookMatch = { row: LookRow; similarity: number };

export const MAX_MATCHES = 3;
export const MAX_SUGGESTIONS = 6;

/** 100 minus the mean gap of the compared scores, whole. 0 when a score is missing. */
export function similarity(a: LookRow, b: LookRow): number {
  const [x, y] = [a.compare, b.compare];
  if (!x || !y || x.length === 0 || x.length !== y.length) return 0;
  const gap = x.reduce((sum, v, i) => sum + Math.abs(v - y[i]), 0) / x.length;
  return Math.round(100 - gap);
}

/**
 * The players most like `ref` that are within reach: of the pool, of the same group, at or under
 * the limit and cheaper than `ref` himself. Most similar first; ties go to the cheaper, then the lower id.
 */
export function lookalikes(ref: LookRow, rows: readonly LookRow[], limit: number): LookMatch[] {
  if (!ref.compare) return [];
  return rows
    .filter((r) => r.eligible && r.compare && r.id !== ref.id && r.group === ref.group && r.cost <= limit && r.cost < ref.cost)
    .map((row) => ({ row, similarity: similarity(ref, row) }))
    .sort((a, b) => b.similarity - a.similarity || a.row.cost - b.row.cost || (a.row.id < b.row.id ? -1 : 1))
    .slice(0, MAX_MATCHES);
}

/** The players a scout is most likely to name: the furthest out of reach first. */
export function suggestions(rows: readonly LookRow[]): LookRow[] {
  return rows
    .filter((r) => r.compare)
    .sort((a, b) => b.cost - a.cost || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_SUGGESTIONS);
}

const plain = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

/** Players whose name contains the typed text, accents ignored ("demirovic" finds "Demirović"). */
export function searchRows(rows: readonly LookRow[], query: string): LookRow[] {
  const q = plain(query.trim());
  if (!q) return [];
  return rows
    .filter((r) => r.compare && plain(r.name).includes(q))
    .sort((a, b) => b.cost - a.cost || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_SUGGESTIONS);
}

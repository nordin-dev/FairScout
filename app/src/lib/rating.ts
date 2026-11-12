import type { Player } from './types';

/** The league adjustment as a fraction: 1 over the factor, minus 1. Factor 1.36 gives about -0.26; a factor below 1 gives a plus. */
export function leagueAdjustment(factor: number): number {
  return 1 / factor - 1;
}

/** Output after the league adjustment: ga90 × (1 + adjustment), which equals ga90 / factor. */
export function adjustedOutput(ga90: number, factor: number): number {
  return ga90 * (1 + leagueAdjustment(factor));
}

const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return (Math.sign(n) * Math.round(Math.abs(n) * f)) / f;
};

/** The adjustment as the whole percentage shown on the card, rounded away from zero at .5. */
export function adjustmentPercent(factor: number): number {
  return round(leagueAdjustment(factor) * 100, 0);
}

/** Adds the shown percentage to the shown output: the figure a scout gets by hand, to two decimals. */
export function reconciledByHand(ga90: number, factor: number): number {
  return round(ga90 * (1 + adjustmentPercent(factor) / 100), 2);
}

/** Signed percentage text with a true minus sign: "−26%", "+12%", "0%". */
export function signedPercent(pct: number): string {
  if (pct === 0) return '0%';
  return `${pct < 0 ? '−' : '+'}${Math.abs(pct)}%`;
}

export const fixed2 = (n: number): string => round(n, 2).toFixed(2);

/**
 * Defenders and goalkeepers are rated on role and team context, not on goals. The data preparation decides
 * who that is and says so in the flag; the app reads the flag and has no rule of its own.
 */
export const isLimitedPosition = (p: Pick<Player, 'flags'>): boolean => p.flags.limited_position_data;

/** The one rating of a player: role percentile where goals say little (limited position data), output percentile otherwise. */
export const ratingOf = (p: Pick<Player, 'flags' | 'pct'>): number => (isLimitedPosition(p) ? p.pct.role : p.pct.output);

/** True when the shown percentage and the shown output agree within one hundredth. */
export function displayReconciles(ga90: number, factor: number, shownAdjusted: number): boolean {
  return Math.abs(reconciledByHand(ga90, factor) - round(shownAdjusted, 2)) <= 0.0100001;
}

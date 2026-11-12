import { basketTimeMachine as t } from './timeMachineText';
import type { BasketPastYear } from './types';

/** The season to open with: 2016 (2016/17) when the file has it, else the latest; null when there is none. */
export function defaultYear(years: readonly BasketPastYear[]): number | null {
  if (!years.length) return null;
  return years.some((y) => y.year === 2016) ? 2016 : Math.max(...years.map((y) => y.year));
}

/** A start year as a season: 2016 is "2016/17". */
export const seasonOf = (year: number): string => `${year}/${String((year + 1) % 100).padStart(2, '0')}`;

/** The season that ends three seasons after the one starting in `year`: 2016 gives "2019/20". */
export const threeSeasonsLater = (year: number): string => seasonOf(year + 3);

export const bestSince = (n: number | null): string => (n === null ? t.noLater : t.minutes(n));

export function outcomeText(p: { hit: boolean; reached: string | null; best_later: number | null }, target = 20): string {
  if (p.hit) return p.reached ? t.reached(p.reached) : t.reachedNoSeason;
  return p.best_later === null ? t.noLaterSeason : t.notReached(target);
}

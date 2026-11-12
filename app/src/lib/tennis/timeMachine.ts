import { monthYearWords } from '../i18n';
import { tennisTimeMachine as t } from './timeMachineText';
import type { TennisPastYear } from './types';

/** The year to open with: 2019 when the file has it, else the latest; null when there is none. */
export function defaultYear(years: readonly TennisPastYear[]): number | null {
  if (!years.length) return null;
  return years.some((y) => y.year === 2019) ? 2019 : Math.max(...years.map((y) => y.year));
}

const parts = (iso: string): { y: number; m: number; d: number } | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** "June 2019" from an ISO date. */
export function monthYear(iso: string): string {
  const p = parts(iso);
  const month = p ? t.months[p.m - 1] : undefined;
  return p && month ? `${month} ${p.y}` : iso;
}

/** "27 May 2019" from an ISO date. */
export function dayMonthYear(iso: string): string {
  const p = parts(iso);
  const month = p ? t.months[p.m - 1] : undefined;
  return p && month ? `${p.d} ${month} ${p.y}` : iso;
}

/** "Jul 2021": a short month and the year. */
export function shortMonthYear(iso: string): string {
  const p = parts(iso);
  return p ? monthYearWords(p.m - 1, p.y) : iso;
}

/** The date three years after an ISO date, as "June 2022". */
export function threeYearsLater(iso: string): string {
  const p = parts(iso);
  return p ? monthYear(`${p.y + 3}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`) : iso;
}

export const bestSince = (n: number | null): string => (n === null ? t.noRanking : t.rankNo(n));

export function outcomeText(p: { hit: boolean; reached: string | null }): string {
  return p.hit ? (p.reached ? t.reached(shortMonthYear(p.reached)) : t.reachedNoDate) : t.notReached;
}

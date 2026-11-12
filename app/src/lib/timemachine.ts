import { thousands } from './format';
import { time as t } from './text.en';
import type { TimeMachineFile, TimeMachineSeason } from './types';

const HALF_YEAR_MS = 0.5 * 365.25 * 24 * 3600 * 1000;

/** The latest season in the file: the default, never the best one. Null when the file has none. */
export function defaultSeason(file: TimeMachineFile): string | null {
  return file.seasons.length ? file.seasons[file.seasons.length - 1].season : null;
}

/** "June 2020" from an ISO date. */
export function longMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec(iso);
  const month = m ? t.months[Number(m[2]) - 1] : undefined;
  return m && month ? `${month} ${m[1]}` : iso;
}

/** True when the outcome date lies more than half a year before the file's as_of date. */
export function hasToday(season: TimeMachineSeason, asOf: string): boolean {
  return Date.parse(asOf) - Date.parse(season.outcome_date) > HALF_YEAR_MS;
}

/** A pick counts as made it only with a later value; a missing later value never counts. */
export const madeIt = (pick: { made_it: boolean; value_3y: number | null }): boolean => pick.made_it && pick.value_3y !== null;

export const yearOf = (iso: string): string => iso.slice(0, 4);

export function title(season: TimeMachineSeason, revealed: boolean): string {
  const n = season.picks.length;
  return revealed
    ? t.revealedTitle(longMonthYear(season.outcome_date), season.hits, n)
    : t.thenTitle(longMonthYear(season.decision_date), n);
}

export function lede(season: TimeMachineSeason, revealed: boolean): string {
  return revealed ? t.poolLine(season.pool, Math.round(season.pool_rate * 10)) : t.thenLede;
}

export function revealLabel(season: TimeMachineSeason, revealed: boolean): string {
  return revealed ? t.back(longMonthYear(season.decision_date)) : t.reveal;
}

export function resultLabel(season: TimeMachineSeason): string {
  return t.result(season.hits, season.picks.length);
}

/** The method text for the Details switch, every figure read from the file. */
export function detailText(season: TimeMachineSeason, file: TimeMachineFile): { how: string; total: string } {
  const six = file.six_seasons;
  const bySeason = Object.entries(six.by_season)
    .map(([s, r]) => `${s} ${r.replace('/', ' of ')}`)
    .join(', ');
  return {
    how: t.detail.how(
      season.season,
      longMonthYear(season.decision_date),
      season.trained_on,
      thousands(season.training_rows),
      season.pool,
    ),
    total: t.detail.total(bySeason, six.tier_a_hits, six.tier_a_picks, thousands(six.pool_hits), thousands(six.pool_players)),
  };
}

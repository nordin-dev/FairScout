import type { ValuePoint } from './types';

/** A point on the chart: time in years (decimal), value in euro. */
export type Pt = [t: number, v: number];

export type Multiples = { p25: number; p50: number; p75: number };

export type ChartInput = {
  history: readonly ValuePoint[];
  decisionDate: string;
  decisionValue: number;
  multiples: Multiples;
  /** Three seasons later. Value null when the player has none. */
  outcome: { date: string; value: number | null };
  /** Today's value, for seasons old enough to show it. */
  today?: { date: string; value: number };
  revealed: boolean;
  /** 'compact' is the small tile chart: no fan, no labels. Omitted for the full chart. */
  size?: 'compact';
};

export const WIDTH = 340;
export const HEIGHT = 250;
export const MARGIN = { l: 10, r: 66, t: 26, b: 30 };
export const COMPACT = { width: 200, height: 72, margin: { l: 6, r: 6, t: 6, b: 6 } };
/** The chart starts this many years before the radar's date. */
export const YEARS_BEFORE = 2.5;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** An ISO date as a decimal year, so that the time scale is linear in days. */
export function yearFraction(iso: string): number {
  return 1970 + Date.parse(iso) / YEAR_MS;
}

/** The expected values at the outcome date: value then times the tier's quartile multiples. */
export function fanValues(valueThen: number, m: Multiples): { lo: number; mid: number; hi: number } {
  return { lo: valueThen * m.p25, mid: valueThen * m.p50, hi: valueThen * m.p75 };
}

export type Layout = {
  flagT: number;
  endT: number;
  nowT: number | null;
  fan: { lo: number; mid: number; hi: number };
  /** The line, oldest first. In the then state nothing later than the decision date is in it. */
  points: Pt[];
  x0: number;
  x1: number;
  ymax: number;
  x: (t: number) => number;
  y: (v: number) => number;
  width: number;
  height: number;
};

/** Everything the chart draws, as numbers: the points of the line, both scales and the fan. */
export function layout(o: ChartInput): Layout {
  const flagT = yearFraction(o.decisionDate);
  const endT = yearFraction(o.outcome.date);
  const nowT = o.revealed && o.today ? yearFraction(o.today.date) : null;
  const fan = fanValues(o.decisionValue, o.multiples);
  const hist: Pt[] = o.history.map(([d, v]) => [yearFraction(d), v]);
  let points: Pt[] = hist.filter((p) => p[0] >= flagT - YEARS_BEFORE && p[0] < flagT);
  points.push([flagT, o.decisionValue]);
  if (o.revealed) {
    points = points.concat(hist.filter((p) => p[0] > flagT && p[0] < endT));
    if (o.outcome.value !== null) points.push([endT, o.outcome.value]);
    if (nowT !== null && o.today) {
      points = points.concat(hist.filter((p) => p[0] > endT && p[0] < nowT));
      points.push([nowT, o.today.value]);
    }
  }
  const compact = o.size === 'compact';
  const width = compact ? COMPACT.width : WIDTH;
  const height = compact ? COMPACT.height : HEIGHT;
  const m = compact ? COMPACT.margin : MARGIN;
  const ymax = Math.max(compact ? 0 : fan.hi, ...points.map((p) => p[1])) * (compact ? 1.12 : 1.14);
  const x0 = flagT - YEARS_BEFORE;
  const x1 = (nowT ?? endT) + (compact ? 0 : 0.1);
  const x = (t: number) => m.l + (width - m.l - m.r) * ((t - x0) / (x1 - x0));
  const y = (v: number) => m.t + (height - m.t - m.b) * (1 - v / ymax);
  return { flagT, endT, nowT, fan, points, x0, x1, ymax, x, y, width, height };
}

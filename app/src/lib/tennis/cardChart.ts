import type { RankPoint } from './types';

export const CHART_W = 640;
export const CHART_H = 260;
const PAD = { l: 16, r: 64, t: 18, b: 22 };

export type ChartLayout = {
  path: string;
  first: { x: number; y: number; point: RankPoint };
  last: { x: number; y: number; point: RankPoint };
  refY: number;
  refX1: number;
  refX2: number;
};

/** Scales for the ranking chart: x by date, y on a log scale with the better ranking higher. Null with fewer than two points. */
export function chartLayout(points: readonly RankPoint[], reference: number): ChartLayout | null {
  const pts = points.filter((p) => p.rank > 0 && Number.isFinite(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const [first, last] = [pts[0], pts[pts.length - 1]];
  if (!first || !last || pts.length < 2) return null;
  const ranks = pts.map((p) => p.rank);
  const top = Math.log(Math.min(...ranks, reference));
  let bottom = Math.log(Math.max(...ranks, reference));
  if (bottom - top < 1e-6) bottom = top + 1;
  const t0 = Date.parse(first.date);
  const span = Math.max(Date.parse(last.date) - t0, 1);
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / span) * (CHART_W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + ((Math.log(r) - top) / (bottom - top)) * (CHART_H - PAD.t - PAD.b);
  return {
    path: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.rank).toFixed(1)}`).join(' '),
    first: { x: x(first.date), y: y(first.rank), point: first },
    last: { x: x(last.date), y: y(last.rank), point: last },
    refY: y(reference),
    refX1: PAD.l,
    refX2: CHART_W - PAD.r,
  };
}

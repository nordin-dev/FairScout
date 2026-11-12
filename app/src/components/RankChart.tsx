import { chartLayout, CHART_H, CHART_W } from '../lib/tennis/cardChart';
import type { RankPoint } from '../lib/tennis/types';
import './RankChart.css';

type Props = {
  points: readonly RankPoint[];
  /** The ranking the dashed line marks, for example 100. */
  reference: number;
  referenceLabel: string;
  /** Text for a rank value, for example "No. 122". */
  rankLabel: (rank: number) => string;
  /** Text alternative from the first and last point. */
  describe: (first: RankPoint, last: RankPoint) => string;
  /** One line shown instead of the chart when there are fewer than two points. */
  empty: string;
};

/** A ranking over time as an inline SVG: better ranking higher, log scale, one labelled reference line. */
export function RankChart({ points, reference, referenceLabel, rankLabel, describe, empty }: Props) {
  const L = chartLayout(points, reference);
  if (!L) return <p className="caption">{empty}</p>;
  const startsLow = L.first.y > L.last.y;
  return (
    <svg className="rc" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={describe(L.first.point, L.last.point)}>
      <line className="rc-ref" x1={L.refX1} x2={L.refX2} y1={L.refY} y2={L.refY} />
      <text className="rc-lab" x={L.refX2 + 6} y={L.refY + 4}>
        {referenceLabel}
      </text>
      <path className="rc-line" d={L.path} />
      <circle className="rc-dot" cx={L.first.x} cy={L.first.y} r={4} />
      <circle className="rc-dot" cx={L.last.x} cy={L.last.y} r={5} />
      <text className="rc-val" x={L.first.x + 8} y={L.first.y + (startsLow ? 18 : -10)}>
        {rankLabel(L.first.point.rank)}
      </text>
      <text className="rc-val" x={L.last.x + 8} y={L.last.y + 4}>
        {rankLabel(L.last.point.rank)}
      </text>
    </svg>
  );
}

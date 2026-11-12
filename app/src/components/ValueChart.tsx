import { money } from '../lib/format';
import { time as t } from '../lib/text.en';
import { HEIGHT, WIDTH, layout, type ChartInput } from '../lib/valuechart';
import './ValueChart.css';

type Props = ChartInput & {
  /** Whether the player made it; read only when revealed. */
  madeIt: boolean;
  /** Replaces the accessible text of the chart, for a place where the time machine's wording does not fit. */
  label?: string;
};

const year = (iso: string) => iso.slice(0, 4);

/** One player's value up to the radar's date, the expected fan, and once revealed the actual course. Pure: everything comes in as props. */
export function ValueChart(props: Props) {
  const { decisionDate, decisionValue, outcome, today, revealed, madeIt, label: given } = props;
  const L = layout(props);
  const { x, y, fan, flagT, endT, nowT } = L;
  const base = y(0);
  const small = y(fan.lo) - y(fan.hi) < 18;
  const path = L.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const showToday = nowT !== null && today !== undefined;
  if (props.size === 'compact') {
    return (
      <svg className="vc" viewBox={`0 0 ${L.width} ${L.height}`} aria-hidden="true">
        <line className="axis" x1={6} x2={L.width - 6} y1={base} y2={base} />
        <path className="line" d={path} />
        <circle className="dot" cx={x(flagT)} cy={y(decisionValue)} r={4.5} />
        {revealed && outcome.value !== null ? <circle className="dot-out" cx={x(endT)} cy={y(outcome.value)} r={5} /> : null}
      </svg>
    );
  }
  const label = given ?? (revealed
    ? t.chart.revealed(money(decisionValue), outcome.value === null ? null : money(outcome.value), madeIt, showToday ? money(today.value) : null)
    : t.chart.then(money(decisionValue), money(fan.lo), money(fan.hi), money(fan.mid)));

  return (
    <svg className="vc" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label}>
      <line className="axis" x1={10} x2={WIDTH - 66} y1={base} y2={base} />
      <line className="guide" x1={x(flagT)} x2={x(flagT)} y1={20} y2={base} />
      <polygon className="fan" points={`${x(flagT)},${y(decisionValue)} ${x(endT)},${y(fan.hi)} ${x(endT)},${y(fan.lo)}`} />
      <line className="mid" x1={x(flagT)} y1={y(decisionValue)} x2={x(endT)} y2={y(fan.mid)} />
      <rect className="band" x={x(endT) - 6} y={y(fan.hi)} width={12} height={Math.max(y(fan.lo) - y(fan.hi), 3)} rx={2} />
      <line className="tick" x1={x(endT) - 10} x2={x(endT) + 10} y1={y(fan.mid)} y2={y(fan.mid)} />
      {small ? (
        nowT === null ? (
          <text x={x(endT) + 12} y={Math.min(y(fan.mid) + 14, base + 12)} fontSize={10}>
            {money(fan.lo)}–{money(fan.hi)}
          </text>
        ) : null
      ) : (
        <>
          <text x={x(endT) + 14} y={y(fan.hi) + 4}>{money(fan.hi)}</text>
          <text x={x(endT) + 14} y={Math.min(y(fan.lo) + 4, base - 2)}>{money(fan.lo)}</text>
        </>
      )}
      <text x={x(flagT)} y={HEIGHT - 9} textAnchor="middle">{year(decisionDate)}</text>
      <text x={x(endT)} y={HEIGHT - 9} textAnchor="middle">{year(outcome.date)}</text>
      <path className="line" d={path} />
      <circle className="dot" cx={x(flagT)} cy={y(decisionValue)} r={5} />
      <text className="dl" x={x(flagT) - 9} y={Math.max(y(decisionValue) - 10, 26)} textAnchor="end">{money(decisionValue)}</text>
      {revealed && outcome.value !== null ? (
        <>
          <circle className="dot-out" cx={x(endT)} cy={y(outcome.value)} r={6} />
          <text className="dl" x={x(endT)} y={Math.max(y(outcome.value) - 12, 12)} textAnchor="middle">{money(outcome.value)}</text>
        </>
      ) : null}
      {showToday && nowT !== null ? (
        <>
          <circle className="dot" cx={x(nowT)} cy={y(today.value)} r={5} />
          <text className="dl" x={x(nowT) + 9} y={y(today.value) + 4}>{money(today.value)}</text>
          <text x={x(nowT)} y={HEIGHT - 9} textAnchor="middle">{t.today}</text>
        </>
      ) : null}
    </svg>
  );
}

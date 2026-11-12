import { evidence as t } from '../lib/text.en';
import './DotScale.css';

export type DotItem = {
  key: string;
  label: string;
  value: number;
  mark: 'filled' | 'hollow';
  /** The tip on hover and on focus. */
  tip: string;
};

export type DotScaleProps = {
  items: DotItem[];
  reference: { value: number; label: string };
  /** Names the scale for assistive technology. */
  title?: string;
};

/** Room left on both sides of the extreme values, as a share of their span. */
const ROOM = 0.08;
/** A scale of a single value still needs a span. */
const MIN_SPAN = 0.1;

export type Scale = { min: number; max: number };

/** The one horizontal scale: it always holds the reference and every value, with a little room on both sides. */
export function scaleOf(values: number[], referenceValue: number): Scale {
  const lo = Math.min(referenceValue, ...values);
  const hi = Math.max(referenceValue, ...values);
  const span = Math.max(hi - lo, MIN_SPAN);
  return { min: lo - span * ROOM, max: hi + span * ROOM };
}

/** Where a value sits on the track, from 0 to 100 percent. */
export function positionOf(value: number, scale: Scale): number {
  return Math.round(((value - scale.min) / (scale.max - scale.min)) * 10000) / 100;
}

/** The left offset of the shared axis: label column plus gap, and the printed-value column plus gap. */
const LEFT_PX = 128;
const RIGHT_PX = 50;

/** One row per item: its name, an axis with its dot on the common scale, and its value; a hollow dot is an estimate. */
export function DotScale({ items, reference, title = t.scaleAlt }: DotScaleProps) {
  const scale = scaleOf(items.map((i) => i.value), reference.value);
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const frac = positionOf(reference.value, scale) / 100;
  return (
    <div className="lg-wrap" role="group" aria-label={title}>
      <div
        className="lg-ref"
        data-testid="dscale-ref"
        style={{ left: `calc(${LEFT_PX}px + (100% - ${LEFT_PX + RIGHT_PX}px) * ${frac})` }}
      >
        <span>{reference.label}</span>
      </div>
      {sorted.map((i) => (
        <div className="lg-row" key={i.key} data-testid="dscale-row" data-tip={i.tip}>
          <span>{i.label}</span>
          <div className="lg-axis">
            <span
              className={i.mark === 'hollow' ? 'lg-dot est' : 'lg-dot'}
              data-testid="dscale-dot"
              data-mark={i.mark}
              tabIndex={0}
              role="img"
              aria-label={i.mark === 'hollow' ? t.dotNameEstimated(i.tip) : i.tip}
              style={{ left: `${positionOf(i.value, scale)}%` }}
            />
          </div>
          <span className="num">{i.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

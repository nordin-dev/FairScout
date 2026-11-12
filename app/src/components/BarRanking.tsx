import type { CSSProperties } from 'react';
import { evidence as t } from '../lib/text.en';
import './BarRanking.css';

export type BarRankingRow = {
  key: string;
  label: string;
  /** Where the bar ends, as a rate from 0 to 1. */
  value: number;
  /** Where the light extension ends; leave out for a plain bar. */
  upper?: number;
  /** The text printed right after the bar. */
  printed: string;
  /** Shown on hover and on focus. */
  tip: string;
  /** The model's row: accent colour and heavier label. */
  emphasis?: boolean;
};

export type BarRankingProps = {
  rows: BarRankingRow[];
  /** One vertical line, on the same scale as the bars. */
  reference: { value: number; label: string };
  size?: 'normal' | 'small';
  /** Width of the label column in pixels. */
  labelWidth?: number;
  /** Names the chart for assistive technology. */
  title?: string;
};

const STEP = 0.05;
const HEADROOM = 1.1;
/** The horizontal scale: the largest value plus a tenth, rounded up to the next 5 points, so the longest bar takes most of the track. */
export function scaleMax(rows: BarRankingRow[], referenceValue: number): number {
  const largest = Math.max(referenceValue, ...rows.map((r) => Math.max(r.value, r.upper ?? 0)));
  return Math.ceil((largest * HEADROOM) / STEP - 1e-9) * STEP;
}

const GAP = 12;
const pctOf = (v: number, max: number): number => Math.round((v / max) * 10000) / 100;

/** Horizontal bars with a printed value, an optional range extension and one reference line. */
export function BarRanking({ rows, reference, size = 'normal', labelWidth = 200, title = t.chartAlt }: BarRankingProps) {
  const max = scaleMax(rows, reference.value);
  const offset = labelWidth + GAP;
  return (
    <div
      className={size === 'small' ? 'bars small' : 'bars'}
      style={{ '--lab': `${labelWidth}px` } as CSSProperties}
      role="group"
      aria-label={title}
    >
      <div
        className="bar-ref"
        data-testid="bar-ref"
        style={{ left: `calc(${offset}px + (100% - ${offset}px) * ${pctOf(reference.value, max) / 100})` }}
      >
        <span>{reference.label}</span>
      </div>
      {rows.map((row) => {
        const end = pctOf(row.upper ?? row.value, max);
        const start = pctOf(row.value, max);
        return (
          <div
            key={row.key}
            className={row.emphasis ? 'bar-row is-model' : 'bar-row'}
            data-tip={row.tip}
            tabIndex={0}
            role="img"
            aria-label={`${t.altRow(row.label, row.printed)}. ${row.tip}`}
          >
            <span aria-hidden="true">{row.label}</span>
            <div className="bar-track" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${start}%` }} />
              {row.upper !== undefined && end > start ? (
                <div className="bar-ext" style={{ left: `${start}%`, width: `${end - start}%` }} />
              ) : null}
              <span className="bar-val" style={{ left: `${end}%` }}>
                {row.printed}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

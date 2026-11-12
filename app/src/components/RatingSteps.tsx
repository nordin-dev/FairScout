import { Fragment, type ReactNode } from 'react';
import './RatingSteps.css';

export type RatingStep = {
  /** For example "01 What he did". */
  label: string;
  /** The one large figure. */
  figure: ReactNode;
  /** At most two short lines. */
  caption: string[];
  /** Hover text, also shown on keyboard focus. */
  tip?: string;
  /** The last step, drawn with the accent edge. */
  final?: boolean;
};

/** The steps of a rating, left to right, joined by arrows. */
export function RatingSteps({ steps }: { steps: RatingStep[] }) {
  const columns = steps.map((s) => (s.final ? '1.2fr' : '1fr')).join(' auto ');
  return (
    <div className="flow" style={{ gridTemplateColumns: columns }}>
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 ? (
            <div className="arrow" aria-hidden="true">
              →
            </div>
          ) : null}
          <div className={s.final ? 'step final' : 'step'} data-tip={s.tip} tabIndex={s.tip ? 0 : undefined}>
            <span className="label">{s.label}</span>
            <b>{s.figure}</b>
            <span className="cap">
              {s.caption.slice(0, 2).map((line, j) => (
                <Fragment key={line}>
                  {j > 0 ? <br /> : null}
                  {line}
                </Fragment>
              ))}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

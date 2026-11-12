import { evidence as t } from '../lib/text.en';
import './MonthColumns.css';

export type MonthColumnsProps = {
  /** The share of each month, twelve numbers from January. */
  shares: number[];
  /** The twelve month names, from January. */
  months: string[];
  /** The text alternative; left out, it lists the twelve shares. */
  description?: string;
};

/** Twelve small columns, one per month, as tall as the month's share of the largest one. */
export function MonthColumns({ shares, months, description }: MonthColumnsProps) {
  const largest = Math.max(...shares);
  const text = description ?? t.monthsAlt(months.map((m, i) => `${m} ${shares[i]}%`));
  return (
    <div role="img" aria-label={text}>
      <div className="months" aria-hidden="true">
        {shares.map((share, i) => (
          <div
            key={months[i]}
            className="col"
            data-testid="month-col"
            data-tip={`${months[i]}: ${share}%`}
            style={{ height: `${Math.round((share / largest) * 10000) / 100}%` }}
          />
        ))}
      </div>
      <div className="month-ends" aria-hidden="true">
        {months.map((m) => (
          <span key={m}>{m.slice(0, 1)}</span>
        ))}
      </div>
    </div>
  );
}

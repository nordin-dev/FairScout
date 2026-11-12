import { evidence as t } from '../lib/text.en';
import './NumberPair.css';

export type NumberPairProps = {
  first: { figure: string; label: string };
  second: { figure: string; label: string };
};

/** Two large figures with their labels, set against each other. */
export function NumberPair({ first, second }: NumberPairProps) {
  return (
    <div className="pair">
      <div><b data-testid="pair-figure">{first.figure}</b><span>{first.label}</span></div>
      <i aria-hidden="true">{t.versus}</i>
      <div><b data-testid="pair-figure">{second.figure}</b><span>{second.label}</span></div>
    </div>
  );
}

import { player as t } from '../lib/text.en';
import './DotRow.css';

type DotRowProps = {
  /** How many of the ten dots are filled. */
  filled: number;
  /** The grey variant for the context row. */
  context?: boolean;
  /** The bold start of the sentence, for example "5 in 10". */
  strong: string;
  /** The rest of the sentence. */
  rest: string;
};

/** Ten dots, the first N filled, with the sentence beside them and a text alternative. */
export function DotRow({ filled, context = false, strong, rest }: DotRowProps) {
  return (
    <div className="dotrow">
      <div className={context ? 'dots ctx' : 'dots'} role="img" aria-label={t.dotsAlt(filled)}>
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < filled ? 'on' : undefined} />
        ))}
      </div>
      <p>
        <b>{strong}</b>
        {rest}
      </p>
    </div>
  );
}

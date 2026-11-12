import type { CSSProperties } from 'react';
import { blind } from '../lib/text.en';
import './RedactionBar.css';

type RedactionBarProps = {
  /** The hidden text. It is not in the page until `revealed` is true. */
  text: string;
  /** Width of the bar in characters. */
  width: number;
  revealed: boolean;
};

/** A black bar over a secret. The text is absent from the page (and from screen readers) until the reveal. */
export function RedactionBar({ text, width, revealed }: RedactionBarProps) {
  const style = { '--w': `${width}ch` } as CSSProperties;
  return revealed ? (
    <span className="redact is-open" data-open="true" style={style}>
      <span className="secret">{text}</span>
    </span>
  ) : (
    <span className="redact" data-open="false" style={style} role="img" aria-label={blind.hiddenLabel} />
  );
}

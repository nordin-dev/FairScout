import type { ReactNode } from 'react';
import './Flag.css';

type FlagProps = {
  children: ReactNode;
  size?: 'normal' | 'large';
  /** Shows the warning triangle before the text. */
  warning?: boolean;
  /** Text shown in the tooltip on hover and on keyboard focus. */
  tip?: string;
};

/** A small outlined mark such as "Limited data". With a tip it can be reached by keyboard. */
export function Flag({ children, size = 'normal', warning = false, tip }: FlagProps) {
  return (
    <span className={size === 'large' ? 'chip lg' : 'chip'} data-tip={tip} tabIndex={tip ? 0 : undefined}>
      {warning ? (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path className="warn" d="M6 1 11.5 11H.5Z" />
        </svg>
      ) : null}
      {children}
    </span>
  );
}

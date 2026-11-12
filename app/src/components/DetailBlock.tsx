import type { ReactNode } from 'react';
import { useDetails } from '../lib/store';
import './DetailBlock.css';

/** Method detail. Its children are in the page only while the Details switch is on. */
export function DetailBlock({ children }: { children: ReactNode }) {
  const on = useDetails();
  return on ? <div className="detail">{children}</div> : null;
}

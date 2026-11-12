import type { ComponentPropsWithoutRef } from 'react';
import './Sheet.css';

type SheetProps = ComponentPropsWithoutRef<'section'>;

/** The card every chart and block sits on. */
export function Sheet({ className, ...rest }: SheetProps) {
  return <section {...rest} className={className ? `sheet ${className}` : 'sheet'} />;
}

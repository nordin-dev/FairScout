import type { ComponentPropsWithoutRef } from 'react';
import './Button.css';

type ButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>;

/** The primary button. Disabled buttons stay in the layout and cannot be activated. */
export function Button({ className, ...rest }: ButtonProps) {
  return <button {...rest} type="button" className={className ? `btn ${className}` : 'btn'} />;
}

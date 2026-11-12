import type { ReactNode } from 'react';
import './Tag.css';

type TagProps = {
  variant: 'model' | 'goals';
  children: ReactNode;
};

/** A small label on a dossier: the model's pick or the top scorer. */
export function Tag({ variant, children }: TagProps) {
  return <span className={`tag tag-${variant}`}>{children}</span>;
}

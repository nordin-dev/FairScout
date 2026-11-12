import type { ReactNode } from 'react';
import './Tag.css';

type TagProps = {
  variant: 'model' | 'goals' | 'signal';
  children: ReactNode;
  title?: string;
};

/** A small label on a dossier: the model's pick, the top scorer or an easy-to-overlook sign. */
export function Tag({ variant, children, title }: TagProps) {
  return (
    <span className={`tag tag-${variant}`} title={title}>
      {children}
    </span>
  );
}

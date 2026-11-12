import type { CSSProperties, ReactNode } from 'react';
import type { DataError } from '../lib/data';
import { states } from '../lib/text.en';
import { Button } from './Button';
import './ScreenState.css';

/** A grey placeholder bar for loading layouts. Give it the size of the thing it stands for. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={className ? `sk ${className}` : 'sk'} style={style} aria-hidden="true" />;
}

/** The loading note under a skeleton layout. */
export function LoadingNote({ children = states.loading }: { children?: ReactNode }) {
  return (
    <p className="state-note" role="status">
      {children}
    </p>
  );
}

type ErrorStateProps = {
  /** The file name shown under the message, for example `players.json`. */
  file: string;
  /** Why it failed, in a few words. */
  reason: string;
  onRetry: () => void;
};

/** The error block: message, file name, Try again. It shows no numbers. */
export function ErrorState({ file, reason, onRetry }: ErrorStateProps) {
  return (
    <div className="sheet state-block" role="alert">
      <h2>{states.errorTitle}</h2>
      <p>
        {reason} {states.errorNote}
      </p>
      <p className="file">{file}</p>
      <Button onClick={onRetry}>{states.tryAgain}</Button>
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  text: string;
  action?: ReactNode;
};

/** The empty block: a title, one sentence and, where it helps, an action. */
export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="sheet state-block">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}

/** The frame's own loading layout: a heading, a lede and a few lines. */
export function LoadingScreen() {
  return (
    <div aria-busy="true">
      <Skeleton className="sk-h1" />
      <Skeleton className="sk-lede" />
      <div className="sk-lines">
        <Skeleton className="sk-line" />
        <Skeleton className="sk-line" />
        <Skeleton className="sk-line" style={{ width: '60%' }} />
      </div>
      <LoadingNote />
    </div>
  );
}

type DataErrorStateProps = {
  /** The error of a failed data load, as `useData()` hands it out. */
  error: DataError;
  onRetry: () => void;
};

/** The error block for a failed data load: the file name and the reason follow from the error. */
export function DataErrorState({ error, onRetry }: DataErrorStateProps) {
  const reason = error.kind === 'missing' ? states.errorMissing : states.errorMalformed;
  return <ErrorState file={error.file} reason={reason} onRetry={onRetry} />;
}

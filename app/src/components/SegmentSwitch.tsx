import type { KeyboardEvent } from 'react';
import './SegmentSwitch.css';

export type Segment<V extends string> = { value: V; label: string; count: number };

type Props<V extends string> = {
  /** The accessible name of the group. */
  label: string;
  segments: readonly Segment<V>[];
  value: V;
  onChange: (value: V) => void;
};

/** Two or more buttons, one pressed at a time, each with its label and count. Arrow keys move and choose; Tab, Enter and Space work as on any button. */
export function SegmentSwitch<V extends string>({ label, segments, value, onChange }: Props<V>) {
  const keyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = segments[(index + step + segments.length) % segments.length];
    if (!next) return;
    onChange(next.value);
    const buttons = e.currentTarget.parentElement?.querySelectorAll('button');
    buttons?.[segments.indexOf(next)]?.focus();
  };
  return (
    <div className="seg-row" role="group" aria-label={label}>
      {segments.map((s, i) => (
        <button
          key={s.value}
          type="button"
          className={s.value === value ? 'seg on' : 'seg'}
          aria-pressed={s.value === value}
          onClick={() => onChange(s.value)}
          onKeyDown={(e) => keyDown(e, i)}
        >
          {s.label} <b>{s.count}</b>
        </button>
      ))}
    </div>
  );
}

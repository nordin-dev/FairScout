import './ChoiceChips.css';

export type ChoiceOption<V extends string> = {
  value: V;
  label: string;
  /** A small text after the label, for example a count. */
  suffix?: string;
};

type Props<V extends string> = {
  /** The accessible name of the row. */
  label: string;
  options: readonly ChoiceOption<V>[];
  /** The chosen value; for multiple choice, the chosen values. */
  selected: V | readonly V[] | null;
  /** Called with the value that was pressed. The owner decides what the choice means. */
  onChange: (value: V) => void;
  /** Marks the row as multiple choice; the pressed state is the same, the owner keeps the limit. */
  multiple?: boolean;
  /** Switches every button off. */
  disabled?: boolean;
};

/** A row of buttons. The chosen ones carry `aria-pressed` and the `on` class, so colour is never the only sign. */
export function ChoiceChips<V extends string>({ label, options, selected, onChange, multiple = false, disabled = false }: Props<V>) {
  const chosen = (v: V) => (Array.isArray(selected) ? (selected as readonly V[]).includes(v) : selected === v);
  return (
    <div className="choices" role="group" aria-label={label} data-multiple={multiple || undefined}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={chosen(o.value) ? 'choice on' : 'choice'}
          aria-pressed={chosen(o.value)}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.suffix ? <small>{o.suffix}</small> : null}
        </button>
      ))}
    </div>
  );
}

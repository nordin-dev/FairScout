import './Meter.css';

type MeterProps = {
  label: string;
  /** 0 to 100. Sets the bar and the figure. */
  value: number;
};

/** A labelled bar with its figure. Wrap several in `<div className="meters">`. */
export function Meter({ label, value }: MeterProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <span>{label}</span>
      <span className="m-bar">
        <i style={{ width: `${v}%` }} />
      </span>
      <span className="m-val">{v}</span>
    </div>
  );
}

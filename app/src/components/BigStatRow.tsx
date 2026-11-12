import './BigStatRow.css';

type BigStatRowProps = {
  label: string;
  /** The score out of 100. */
  value: number;
  /** True for a score the scout did not ask for. */
  dim?: boolean;
};

/** One score cell: label, big figure, small bar. */
export function BigStatRow({ label, value, dim = false }: BigStatRowProps) {
  return (
    <div className={dim ? 'dim' : undefined}>
      <span className="label">{label}</span>
      <b>{value}</b>
      <span className="mini" aria-hidden="true">
        <i style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

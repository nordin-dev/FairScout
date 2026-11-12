import type { TimeMachinePick } from '../lib/types';
import { money } from '../lib/format';
import { madeIt } from '../lib/timemachine';
import { time as t } from '../lib/text.en';
import './PastRadarList.css';

type Props = {
  picks: readonly TimeMachinePick[];
  /** Year of the radar, the header of the price column. */
  thenYear: string;
  /** Year three seasons later, the header of the later-value column. */
  laterYear: string;
  revealed: boolean;
  /** Show today's value too (only for seasons that ended more than half a year before the data date). */
  showToday: boolean;
  /** Id of the selected row. */
  selectedId: string;
  onSelect: (id: string) => void;
};

type RowProps = {
  pick: TimeMachinePick;
  rank: number;
  revealed: boolean;
  showToday: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
};

function Row({ pick, rank, revealed, showToday, selected, onSelect }: RowProps) {
  const hit = madeIt(pick);
  const cls = ['tm-row', hit && revealed ? 'hit' : '', selected ? 'sel' : ''].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      role="row"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(pick.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(pick.id);
        }
      }}
    >
      <span className="rk">{rank}</span>
      <span className="who">
        <b>{pick.name}</b>
        <small>
          {pick.club} · {pick.league}
        </small>
      </span>
      <span className="then">{money(pick.value_then)}</span>
      {revealed ? (
        <>
          <span className="later">{pick.value_3y === null ? t.noValue : money(pick.value_3y)}</span>
          <span className="mark" role="img" aria-label={hit ? t.madeIt : t.notMadeIt} />
          {showToday ? <span className="today">{money(pick.value_latest)}</span> : null}
        </>
      ) : (
        <>
          <span className="later" />
          <span className="mark" />
          <span className="today" />
        </>
      )}
    </div>
  );
}

/** The past radar in two columns, in the model's order; a row can be selected. The later value, the mark and today's value exist only once revealed. */
export function PastRadarList({ picks, thenYear, laterYear, revealed, showToday, selectedId, onSelect }: Props) {
  const half = Math.ceil(picks.length / 2);
  const columns = [picks.slice(0, half), picks.slice(half)];
  return (
    <div className={`tm-list${revealed ? ' tm-revealed' : ''}${showToday && revealed ? '' : ' no-today'}`} role="table" aria-label={t.listLabel}>
      {columns.map((col, c) => (
        <div key={c}>
          <div className="tm-row tm-head" role="row">
            <span />
            <span />
            <span>{thenYear}</span>
            <span>{revealed ? laterYear : ''}</span>
            <span />
            <span className="today">{revealed && showToday ? t.today : ''}</span>
          </div>
          {col.map((p, i) => (
            <Row key={p.id} pick={p} rank={c * half + i + 1} revealed={revealed} showToday={showToday} selected={p.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </div>
  );
}

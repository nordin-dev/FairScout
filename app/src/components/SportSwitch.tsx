import { SPORTS, setSport, useSport } from '../lib/store';
import { frame } from '../lib/text.en';
import './SegmentSwitch.css';
import './SportSwitch.css';

/** The choice of sport above the blind pick and the radar: one pressed at a time. */
export function SportSwitch() {
  const sport = useSport();
  return (
    <div className="sport-switch">
      <span className="label" id="sport-switch-label">
        {frame.sportQuestion}
      </span>
      <div className="seg-row" role="group" aria-labelledby="sport-switch-label">
        {SPORTS.map((s) => (
          <button key={s} type="button" className={s === sport ? 'seg on' : 'seg'} aria-pressed={s === sport} onClick={() => setSport(s)}>
            {frame.sports[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

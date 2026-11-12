import { player } from '../lib/text.en';
import './FactTile.css';

type FactTileProps = {
  label: string;
  /** The figure. Null or undefined shows a dash, never a zero. */
  value: string | null | undefined;
  /** The line under the figure. Shown only when there is a value; otherwise "not known". */
  caption: string;
};

/** One of the three facts beside the player's name. */
export function FactTile({ label, value, caption }: FactTileProps) {
  const known = value !== null && value !== undefined && value !== '';
  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="tile-v">{known ? value : player.dash}</span>
      <span className="tile-c">{known ? caption : player.unknown}</span>
    </div>
  );
}

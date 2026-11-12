import { dataText } from '../../lib/dataText';
import { Link } from 'react-router-dom';
import { DetailBlock } from '../../components/DetailBlock';
import { Sheet } from '../../components/Sheet';
import { money } from '../../lib/format';
import { similarInBudget } from '../../lib/similar';
import { useBudget } from '../../lib/store';
import { player as t } from '../../lib/text.en';
import type { Player } from '../../lib/types';

/** Up to three similar players inside the shared budget; each row is a link to his card. */
export function SimilarPanel({ p, players }: { p: Player; players: Player[] }) {
  const budget = useBudget();
  const rows = similarInBudget(p, players, budget);
  return (
    <Sheet>
      <p className="label">{t.similarLabel}</p>
      {rows.length === 0 ? (
        <p className="lede">{t.similarNone}</p>
      ) : (
        <div className="simrows">
          {rows.map((r) => (
            <Link key={r.player.id} className="simrow" to={`/player/${encodeURIComponent(r.player.id)}`}>
              <span>
                <span className="sim-name">{r.player.name}</span>
                <span className="sim-meta">{t.similarMeta(r.player.league_name, money(r.player.value_eur))}</span>
                <span className="sim-meta">{dataText(r.diff)}</span>
              </span>
              <span className="pct">{t.similarPercent(Math.round(r.similarity))}</span>
            </Link>
          ))}
        </div>
      )}
      <DetailBlock>
        <p className="caption d-note">{t.similarDetail}</p>
      </DetailBlock>
    </Sheet>
  );
}

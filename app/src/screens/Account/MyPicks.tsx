import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cardPath, removePick, useAccount, type PickSport, type SavedPick } from '../../lib/account';
import { myPicks as t, pickDate } from '../../lib/accountText';
import { report } from '../../lib/reportText';
import { setSport } from '../../lib/store';
import { ChoiceChips } from '../../components/ChoiceChips';
import { EmptyState } from '../../components/ScreenState';
import { TierBadge } from '../../components/TierBadge';
import './Account.css';

const ORDER: PickSport[] = ['football', 'tennis', 'basketball'];
type Filter = 'all' | PickSport;

/** My picks at /my-picks: the signed-in scout's saved players, grouped by sport. */
export function MyPicks() {
  const who = useAccount();
  const [filter, setFilter] = useState<Filter>('all');

  if (!who) {
    return (
      <>
        <p className="kicker">{t.kicker}</p>
        <h1>{t.kicker}</h1>
        <EmptyState
          title={t.signedOutTitle}
          text={t.signedOutText}
          action={
            <Link className="btn" to="/account">
              {t.signedOutAction}
            </Link>
          }
        />
      </>
    );
  }

  const count = (s: PickSport) => who.picks.filter((p) => p.sport === s).length;
  const groups = ORDER.filter((s) => (filter === 'all' || filter === s) && count(s) > 0).map((s) => ({
    sport: s,
    picks: who.picks.filter((p) => p.sport === s).sort((a, b) => b.added.localeCompare(a.added)),
  }));

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{t.title(who.picks.length)}</h1>
      <p className="lede">{t.lede(who.name)}</p>
      {who.picks.length === 0 ? (
        <p className="caption">{t.emptyText}</p>
      ) : (
        <>
          <div className="picks-filter">
            <ChoiceChips<Filter>
              label={t.filterLabel}
              selected={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t.all, suffix: String(who.picks.length) },
                ...ORDER.map((s) => ({ value: s, label: t.sports[s], suffix: String(count(s)) })),
              ]}
            />
          </div>
          <Link className="btn picks-report" to={filter === 'all' ? '/my-picks/report' : `/my-picks/report?sport=${filter}`}>
            {report.open}
          </Link>
          {groups.map((g) => (
            <section key={g.sport} className="picks-group" aria-labelledby={`picks-${g.sport}`}>
              <h2 id={`picks-${g.sport}`}>{t.group(t.sports[g.sport], g.picks.length)}</h2>
              <ul className="picks-list">
                {g.picks.map((p) => (
                  <PickRow key={`${p.sport}:${p.id}`} pick={p} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}

function PickRow({ pick }: { pick: SavedPick }) {
  return (
    <li className="pick-row">
      <div className="pick-main">
        <Link to={cardPath(pick)} onClick={() => setSport(pick.sport)}>
          {pick.name}
        </Link>
        <span className="pick-line">{pick.line}</span>
      </div>
      <span className="pick-tier" aria-label={t.outlook}>
        {pick.tier ? <TierBadge tier={pick.tier} /> : t.noOutlook}
      </span>
      <span className="pick-from">{t.from[pick.from]}</span>
      <span className="pick-date">{pickDate(pick.added)}</span>
      <button type="button" className="pick-remove" aria-label={t.removeLabel(pick.name)} onClick={() => removePick(pick.sport, pick.id)}>
        {t.remove}
      </button>
    </li>
  );
}

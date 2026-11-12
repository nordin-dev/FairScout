import { Link, useNavigate, useParams } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { Button } from '../../components/Button';
import { FactTile } from '../../components/FactTile';
import { Flag } from '../../components/Flag';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import { basketCard as t } from '../../lib/basketball/cardText';
import { useBasket } from '../../lib/basketball/data';
import type { BasketFile, BasketPlayer } from '../../lib/basketball/types';
import { useOrigin } from '../../lib/store';
import '../PlayerCard/PlayerCard.css';
import './BasketCard.css';

function BackLink() {
  const origin = useOrigin();
  return (
    <Link className="back" to={origin === 'blind' ? '/blind' : '/radar'}>
      {origin === 'blind' ? t.backToBlind : t.backToRadar}
    </Link>
  );
}

function Seasons({ p }: { p: BasketPlayer }) {
  return (
    <Sheet className="t-chart">
      <p className="label">{t.seasonsLabel}</p>
      {p.history.length === 0 ? (
        <p className="say">{t.noSeasons}</p>
      ) : (
        <>
          <div className="bk-scroll">
            <table className="bk-seasons">
              <caption className="sr-only">{t.seasonsCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.colSeason}</th>
                  <th scope="col">{t.colClub}</th>
                  <th scope="col">{t.colCompetition}</th>
                  <th scope="col" className="num">{t.colGames}</th>
                  <th scope="col" className="num">{t.colMinutes}</th>
                  <th scope="col" className="num">{t.colPoints}</th>
                </tr>
              </thead>
              <tbody>
                {p.history.map((s) => (
                  <tr key={`${s.season}-${s.team}-${s.competition}`}>
                    <th scope="row">{s.season}</th>
                    <td>{s.team}</td>
                    <td>{s.competition}</td>
                    <td className="num">{s.games}</td>
                    <td className="num">{t.figure(s.mpg)}</td>
                    <td className="num">{t.figure(s.ppg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.history.length === 1 ? <p className="caption">{t.oneSeason}</p> : null}
        </>
      )}
    </Sheet>
  );
}

function Card({ p, file }: { p: BasketPlayer; file: BasketFile }) {
  const tier = file.meta.backtest.tiers[p.tier];
  const caption = t.caption(file.meta.season, p.games);
  return (
    <>
      <div className="p-head t-head">
        <div>
          <BackLink />
          <h1>{p.name}</h1>
          <p className="lede">{t.headline(p.position, Math.floor(p.age), p.team, p.competition, p.country)}</p>
        <AddPickButton sport="basketball" id={p.id} name={p.name} line={`${p.team} · ${p.competition}`} tier={p.tier} from="card" />
        </div>
      </div>
      <div className="t-facts">
        <FactTile label={t.minutes} value={t.figure(p.mpg)} caption={caption} />
        <FactTile label={t.points} value={t.figure(p.ppg)} caption={caption} />
        <FactTile label={t.rebounds} value={t.figure(p.rpg)} caption={caption} />
        <FactTile label={t.assists} value={t.figure(p.apg)} caption={caption} />
        <FactTile label={t.rating} value={t.figure(p.pirpg)} caption={caption} />
      </div>
      <div className="p-row2">
        <Sheet>
          <p className="label">{t.outlookLabel}</p>
          <p className="t-tier">
            <TierBadge tier={p.tier} size="xl" />
            <span className="hero-fig">{Math.round(p.score * 100)}/100</span>
          </p>
          <p className="say">{t.gives(Math.round(p.score * 100))}</p>
          {tier ? <p className="say">{t.tierLine(p.tier, tier.n, tier.hits)}</p> : null}
          <p className="caption">{t.caution}</p>
        </Sheet>
        <Sheet>
          <p className="label">{t.whyLabel}</p>
          <ul className="drivers">
            {p.drivers.map((d) => (
              <li key={d.key} className={d.sign === '+' ? 'plus' : 'minus'}>
                <span className="sign" aria-hidden="true">
                  {d.sign === '+' ? t.plusSign : t.minusSign}
                </span>
                <span>
                  <span className="sr-only">{d.sign === '+' ? t.plusLabel : t.minusLabel}: </span>
                  {d.text}
                </span>
              </li>
            ))}
          </ul>
          {p.flags.under20 || p.flags.low_sample ? (
            <p className="p-flags">
              {p.flags.under20 ? <Flag size="large">{t.flagUnder20}</Flag> : null}
              {p.flags.low_sample ? (
                <Flag size="large" warning>
                  {t.flagLow}
                </Flag>
              ) : null}
            </p>
          ) : null}
        </Sheet>
      </div>
      <Seasons p={p} />
    </>
  );
}

function CardLoading() {
  return (
    <div aria-busy="true">
      <BackLink />
      <Skeleton className="sk-name" />
      <Skeleton className="sk-sub" />
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

/** The card of one basketball player at /basketball/:id. */
export function BasketCard() {
  const { id } = useParams();
  const state = useBasket();
  const navigate = useNavigate();
  if (state.status === 'loading') return <CardLoading />;
  if (state.status === 'error') {
    return (
      <>
        <BackLink />
        <ErrorState file={t.errorFile} reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  const p = state.data.players.find((x) => x.id === id);
  if (!p) {
    return (
      <EmptyState
        title={t.notFoundTitle}
        text={t.notFoundText}
        action={<Button onClick={() => navigate('/radar')}>{t.notFoundButton}</Button>}
      />
    );
  }
  return <Card p={p} file={state.data} />;
}

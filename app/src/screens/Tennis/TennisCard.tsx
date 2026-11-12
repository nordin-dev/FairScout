import { Link, useNavigate, useParams } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { Button } from '../../components/Button';
import { FactTile } from '../../components/FactTile';
import { Flag } from '../../components/Flag';
import { RankChart } from '../../components/RankChart';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import { useOrigin } from '../../lib/store';
import { tennisCard as t } from '../../lib/tennis/cardText';
import { useTennis } from '../../lib/tennis/data';
import { dayMonthYear } from '../../lib/tennis/radar';
import type { TennisFile, TennisPlayer } from '../../lib/tennis/types';
import '../PlayerCard/PlayerCard.css';
import './TennisCard.css';

function BackLink() {
  const origin = useOrigin();
  return (
    <Link className="back" to={origin === 'blind' ? '/blind' : '/radar'}>
      {origin === 'blind' ? t.backToBlind : t.backToRadar}
    </Link>
  );
}

const rankText = (n: number | null) => (n === null ? null : t.rankFigure(n));

function Card({ p, file }: { p: TennisPlayer; file: TennisFile }) {
  const tier = file.meta.backtest.tiers[p.tier];
  return (
    <>
      <div className="p-head t-head">
        <div>
          <BackLink />
          <h1>{p.name}</h1>
          <p className="lede">{t.headline(Math.floor(p.age), p.country, p.hand)}</p>
        <AddPickButton sport="tennis" id={p.id} name={p.name} line={p.country} tier={p.tier} from="card" />
        </div>
      </div>
      <div className="t-facts">
        <FactTile label={t.ranking} value={rankText(p.rank)} caption={t.captions.ranking(dayMonthYear(file.meta.source_last_date))} />
        <FactTile label={t.yearAgo} value={rankText(p.rank_year_ago)} caption={t.captions.yearAgo} />
        <FactTile label={t.record} value={t.recordFigure(p.wins, p.losses)} caption={t.captions.record} />
        <FactTile label={t.top200} value={String(p.top200_wins)} caption={t.captions.top200} />
        <FactTile label={t.bestWin} value={rankText(p.best_win_rank)} caption={t.captions.bestWin} />
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
          {p.flags.under18 || p.flags.low_sample ? (
            <p className="p-flags">
              {p.flags.under18 ? <Flag size="large">{t.flagUnder18}</Flag> : null}
              {p.flags.low_sample ? (
                <Flag size="large" warning>
                  {t.flagLow}
                </Flag>
              ) : null}
            </p>
          ) : null}
        </Sheet>
      </div>
      <Sheet className="t-chart">
        <p className="label">{t.chartLabel}</p>
        <RankChart
          points={p.rank_history}
          reference={100}
          referenceLabel={t.topLine}
          rankLabel={t.rankFigure}
          describe={(a, b) => t.chartAlt(t.rankFigure(a.rank), dayMonthYear(a.date), t.rankFigure(b.rank), dayMonthYear(b.date))}
          empty={t.chartEmpty}
        />
        <p className="caption">{t.chartNote}</p>
      </Sheet>
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

/** The card of one tennis player at /tennis/:id. */
export function TennisCard() {
  const { id } = useParams();
  const state = useTennis();
  const navigate = useNavigate();
  if (state.status === 'loading') return <CardLoading />;
  if (state.status === 'error') {
    return (
      <>
        <BackLink />
        <ErrorState file="tennis.json" reason={t.errorReason} onRetry={state.retry} />
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { useBasket } from '../../lib/basketball/data';
import { bestSince, defaultYear, outcomeText, threeSeasonsLater } from '../../lib/basketball/timeMachine';
import { basketTimeMachine as t } from '../../lib/basketball/timeMachineText';
import type { BasketPastPlayer, BasketPastYear } from '../../lib/basketball/types';
import { useReveal } from '../../lib/keys';
import '../TimeMachine/TimeMachine.css';
import '../Tennis/TennisTimeMachine.css';

const Head = () => <p className="kicker">{t.kicker}</p>;

function Loading() {
  return (
    <div aria-busy="true">
      <Head />
      <Skeleton className="sk-h1" />
      <Skeleton className="sk-lede" />
      <div className="tm-bar">
        <div className="choices">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ width: 104, height: 43 }} />
          ))}
        </div>
        <Skeleton style={{ width: 300, height: 43 }} />
      </div>
      <Sheet aria-busy="true">
        <div className="sk-rows">
          {Array.from({ length: 10 }, (_, i) => (
            <div className="sk-row" key={i}>
              <Skeleton />
              <span className="sk-who">
                <Skeleton style={{ width: 150, height: 14 }} />
                <Skeleton style={{ width: 120, height: 10 }} />
              </span>
              <Skeleton />
              <Skeleton />
            </div>
          ))}
        </div>
      </Sheet>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

function Empty() {
  const navigate = useNavigate();
  return (
    <>
      <Head />
      <h1>{t.emptyTitle}</h1>
      <p className="lede">{t.emptyLede}</p>
      <EmptyState
        title={t.emptyBlockTitle}
        text={t.emptyBlockText}
        action={<Button onClick={() => navigate(t.evidencePath)}>{t.openEvidence}</Button>}
      />
    </>
  );
}

const Who = ({ p }: { p: BasketPastPlayer }) => (
  <td className="who">
    <b>{p.name}</b>
    <small>{`${p.team} · ${p.competition}`}</small>
  </td>
);

const Redacted = ({ wide }: { wide?: boolean }) => (
  <span className={wide ? 'ttm-redact wide' : 'ttm-redact'} role="img" aria-label={t.hiddenLabel} />
);

function Ready({ years, target }: { years: BasketPastYear[]; target: number }) {
  const [chosen, setChosen] = useState<number>(() => defaultYear(years) ?? years[0].year);
  const [revealed, setRevealed] = useState(false);
  const toggle = () => setRevealed((r) => !r);
  useReveal(toggle);

  const year = years.find((y) => y.year === chosen) ?? years[years.length - 1];
  const n = year.tier_a.length;
  const options = years.map((y) => ({ value: String(y.year), label: y.season }));

  return (
    <>
      <Head />
      <h1>{revealed ? t.revealedTitle(year.tier_a_hits, n) : t.thenTitle(year.season, n)}</h1>
      <p className="lede">{revealed ? t.revealedLede(year.pool, year.pool_hits) : t.thenLede(year.pool)}</p>
      <div className="tm-bar">
        <ChoiceChips
          label={t.seasonsLabel}
          options={options}
          selected={String(year.year)}
          onChange={(v) => {
            setChosen(Number(v));
            setRevealed(false);
          }}
        />
        <Button onClick={toggle}>{revealed ? t.hide : t.reveal(threeSeasonsLater(year.year))}</Button>
      </div>
      <Sheet className="ttm-scroll">
        <table className="ttm-table" aria-label={t.listLabel}>
          <thead>
            <tr>
              <th>#</th>
              <th>{t.head.player}</th>
              <th className="num">{t.head.age}</th>
              <th className="num">{t.head.minutes}</th>
              <th className="num">{t.head.later}</th>
              <th>{t.head.outcome}</th>
            </tr>
          </thead>
          <tbody>
            {year.tier_a.map((p, i) => (
              <tr key={p.id} className={revealed && p.hit ? 'hit' : undefined}>
                <td className="rk">{i + 1}</td>
                <Who p={p} />
                <td className="num">{Math.floor(p.age)}</td>
                <td className="num">{t.minutes(p.mpg)}</td>
                <td className="num">{revealed ? bestSince(p.best_later) : <Redacted />}</td>
                <td className="out">
                  {revealed ? (
                    <>
                      <i aria-hidden="true" />
                      {outcomeText(p, target)}
                    </>
                  ) : (
                    <Redacted wide />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Sheet>
      {revealed ? (
        <Sheet className="ttm-missed ttm-scroll">
          <h2>{t.missedTitle}</h2>
          <p className="lede">{t.missedLede(year.missed.length, n)}</p>
          {year.missed.length ? (
            <table className="ttm-table" aria-label={t.missedLabel}>
              <thead>
                <tr>
                  <th>{t.head.player}</th>
                  <th className="num">{t.head.minutes}</th>
                  <th>{t.head.tier}</th>
                  <th className="num">{t.head.later}</th>
                </tr>
              </thead>
              <tbody>
                {year.missed.map((p) => (
                  <tr key={p.id}>
                    <Who p={p} />
                    <td className="num">{t.minutes(p.mpg)}</td>
                    <td>{t.tierThen(p.tier)}</td>
                    <td className="num">{bestSince(p.best_later)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Sheet>
      ) : null}
      <p className="caption">{t.caption}</p>
    </>
  );
}

/** The basketball time machine at /time-machine when the sport is basketball. */
export function BasketTimeMachine() {
  const state = useBasket();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') {
    return (
      <>
        <Head />
        <ErrorState file="basketball.json" reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  if (!state.data.timemachine.length) return <Empty />;
  return <Ready years={state.data.timemachine} target={state.data.meta.target_minutes} />;
}

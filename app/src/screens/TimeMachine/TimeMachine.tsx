import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { DetailBlock } from '../../components/DetailBlock';
import { ValueChart } from '../../components/ValueChart';
import { PastRadarList } from '../../components/PastRadarList';
import { DataErrorState, EmptyState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { useData } from '../../lib/data';
import { useReveal } from '../../lib/keys';
import { time as t } from '../../lib/text.en';
import { defaultSeason, detailText, hasToday, madeIt, lede, resultLabel, revealLabel, title, yearOf } from '../../lib/timemachine';
import type { TimeMachineFile } from '../../lib/types';
import './TimeMachine.css';

const SKELETON_ROWS = 9;

function Head({ children }: { children: React.ReactNode }) {
  return <p className="kicker">{children}</p>;
}

function SkeletonColumn() {
  return (
    <div className="sk-rows">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
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
  );
}

function Loading() {
  return (
    <div aria-busy="true">
      <Head>{t.kicker}</Head>
      <Skeleton className="sk-h1" />
      <Skeleton className="sk-lede" />
      <div className="tm-bar">
        <div className="choices">
          {[104, 104, 104, 104].map((w, i) => (
            <Skeleton key={i} style={{ width: w, height: 43 }} />
          ))}
        </div>
        <Skeleton style={{ width: 230, height: 43 }} />
      </div>
      <div className="tm-grid">
        <Sheet aria-busy="true">
          <div className="tm-list">
            <SkeletonColumn />
            <SkeletonColumn />
          </div>
        </Sheet>
        <Sheet aria-busy="true">
          <Skeleton style={{ width: 120, height: 12, marginBottom: 10 }} />
          <Skeleton style={{ width: 200, height: 26, marginBottom: 14 }} />
          <Skeleton style={{ height: 230 }} />
        </Sheet>
      </div>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

function Empty() {
  const navigate = useNavigate();
  return (
    <>
      <Head>{t.kicker}</Head>
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

/** The season, player and reveal asked for in the address; anything unknown falls back to the defaults. */
function startFrom(file: TimeMachineFile, params: URLSearchParams): { season: string | null; player: string | null; revealed: boolean } {
  const asked = file.seasons.find((s) => s.season === params.get('season'));
  const player = asked?.picks.find((p) => p.id === params.get('player'));
  return {
    season: asked ? asked.season : defaultSeason(file),
    player: player ? player.id : null,
    revealed: params.get('revealed') === '1',
  };
}

function Ready({ file }: { file: TimeMachineFile }) {
  const [params] = useSearchParams();
  const [start] = useState(() => startFrom(file, params));
  const [chosen, setChosen] = useState<string | null>(start.season);
  const [selectedId, setSelectedId] = useState<string | null>(start.player);
  const [revealed, setRevealed] = useState(start.revealed);
  const [seen, setSeen] = useState(start.revealed);
  const toggle = () => {
    if (!revealed) setSeen(true);
    setRevealed(!revealed);
  };
  useReveal(toggle);

  const season = file.seasons.find((s) => s.season === chosen) ?? file.seasons[file.seasons.length - 1];
  const pick = season.picks.find((p) => p.id === selectedId) ?? season.picks[0];
  const range = file.outcome_ranges.A;
  const detail = detailText(season, file);
  const options = file.seasons.map((s) => ({
    value: s.season,
    label: s.season,
    suffix: seen ? resultLabel(s) : undefined,
  }));

  return (
    <>
      <Head>{t.kicker}</Head>
      <h1>{title(season, revealed)}</h1>
      <p className="lede">{lede(season, revealed)}</p>
      <div className="tm-bar">
        <ChoiceChips label={t.seasonsLabel} options={options} selected={season.season} onChange={(v) => {
          setChosen(v);
          setSelectedId(null);
        }} />
        <Button onClick={toggle}>{revealLabel(season, revealed)}</Button>
      </div>
      <div className="tm-grid">
        <Sheet>
          <PastRadarList
            picks={season.picks}
            thenYear={yearOf(season.decision_date)}
            laterYear={yearOf(season.outcome_date)}
            revealed={revealed}
            showToday={hasToday(season, file.as_of)}
            selectedId={pick.id}
            onSelect={setSelectedId}
          />
        </Sheet>
        <Sheet className="tm-panel">
          <p className="label">{t.pickLine(pick.rank, pick.club)}</p>
          <p className="tm-name">{pick.name}</p>
          {pick.history.length < 2 ? (
            <p className="tm-short">{t.tooLittleHistory}</p>
          ) : (
            <>
              <ValueChart
                history={pick.history}
                decisionDate={season.decision_date}
                decisionValue={pick.value_then}
                multiples={{ p25: range.multiple_p25, p50: range.multiple_p50, p75: range.multiple_p75 }}
                outcome={{ date: season.outcome_date, value: pick.value_3y }}
                today={hasToday(season, file.as_of) ? { date: file.as_of, value: pick.value_latest } : undefined}
                revealed={revealed}
                madeIt={madeIt(pick)}
              />
              <p className="caption">{t.chartLegend}</p>
            </>
          )}
        </Sheet>
      </div>
      <DetailBlock>
        <p className="caption tm-how">{detail.how} {detail.total}</p>
      </DetailBlock>
    </>
  );
}

/** The time machine: a past radar as it stood then, and what happened to its players. */
export function TimeMachine() {
  const state = useData();
  if (state.status === 'error') {
    return (
      <>
        <Head>{t.kicker}</Head>
        <DataErrorState error={state.error} onRetry={state.retry} />
      </>
    );
  }
  if (state.status !== 'ready') return <Loading />;
  if (!state.data.timemachine.seasons.length) return <Empty />;
  return <Ready file={state.data.timemachine} />;
}
